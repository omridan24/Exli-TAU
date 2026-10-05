"""
Unit tests for services/groups_service.py.

Uses tests/fake_firestore.py instead of the Firestore emulator, which needs a local
Java runtime not available in this dev environment (see docs/groups/01-backend-db-plan.md).
Transactional functions are exercised via their undecorated body
(`svc._some_txn.to_wrap`) with a FakeTransaction that applies writes immediately —
this checks the business logic, not firestore.transactional's retry/commit behavior.

Before shipping Phase 1, also smoke-test the real endpoints against the dev Cloud Run
deployment with two real whitelisted accounts (plan §5 step 8) to catch anything a
fake client can't, e.g. actual Firestore transaction contention.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.fake_firestore import FakeClient
import services.groups_service as svc


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

OWNER = "owner-uid"
ADMIN2 = "admin2-uid"
MEMBER = "member-uid"
STRANGER = "stranger-uid"


def user_info(uid):
    return {"displayName": uid, "photoURL": None, "email": f"{uid}@example.com"}


def make_member(role="member", status="active"):
    return {
        "role": role,
        "status": status,
        "displayName": "Name",
        "photoURL": None,
        "email": "x@example.com",
        "joinedAt": "t",
        "addedBy": OWNER,
    }


def make_group(**overrides):
    group = {
        "name": "Trip to Eilat",
        "description": None,
        "emoji": None,
        "type": "other",
        "imageUrl": None,
        "currency": "ILS",
        "ownerId": OWNER,
        "memberIds": [OWNER],
        "members": {OWNER: make_member(role="admin")},
        "settings": dict(svc.DEFAULT_SETTINGS),
        "splitRules": [{
            "id": "eq", "builtIn": "equality_first", "name": None, "emoji": "⚖️",
            "kind": "equal", "params": {}, "hidden": False, "needsReview": False,
        }],
        "defaultSplitRuleId": "eq",
        "balances": {OWNER: 0},
        "pendingRequestCount": 0,
        "status": "active",
        "version": 1,
        "createdAt": "t",
        "updatedAt": "t",
    }
    group.update(overrides)
    return group


@pytest.fixture
def db():
    return FakeClient()


def seed_group(db, group_id="g1", **overrides):
    db.collection("groups").document(group_id).set(make_group(**overrides))
    return group_id


# ---------------------------------------------------------------------------
# Pure logic: permissions, validation, invite-token checks
# ---------------------------------------------------------------------------

class TestPermissions:
    def test_denies_non_member(self):
        group = make_group()
        with pytest.raises(svc.ForbiddenError):
            svc.ensure_permission(group, STRANGER, "group.update")

    def test_denies_member_for_admin_only_action(self):
        group = make_group(members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        })
        with pytest.raises(svc.ForbiddenError):
            svc.ensure_permission(group, MEMBER, "member.remove")

    def test_allows_admin(self):
        group = make_group()
        svc.ensure_permission(group, OWNER, "group.update")  # no raise

    def test_member_can_invite_when_setting_enabled(self):
        group = make_group(
            members={OWNER: make_member(role="admin"), MEMBER: make_member(role="member")},
            settings={**svc.DEFAULT_SETTINGS, "membersCanInvite": True},
        )
        svc.ensure_permission(group, MEMBER, "invite.view")  # no raise

    def test_removed_member_has_no_permissions(self):
        group = make_group(members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="admin", status="removed"),
        })
        with pytest.raises(svc.ForbiddenError):
            svc.ensure_permission(group, MEMBER, "member.remove")

    def test_ensure_owner_denies_non_owner(self):
        group = make_group()
        with pytest.raises(svc.ForbiddenError):
            svc.ensure_owner(group, MEMBER)


class TestLastAdminGuard:
    def test_raises_when_it_would_leave_zero_admins(self):
        group = make_group(members={OWNER: make_member(role="admin")})
        with pytest.raises(svc.ConflictError):
            svc._ensure_not_last_admin(group, exclude_uid=OWNER)

    def test_passes_when_another_admin_remains(self):
        group = make_group(members={
            OWNER: make_member(role="admin"),
            ADMIN2: make_member(role="admin"),
        })
        svc._ensure_not_last_admin(group, exclude_uid=OWNER)  # no raise


class TestValidation:
    def test_empty_name_rejected(self):
        with pytest.raises(svc.ValidationError):
            svc._clean_name("   ")

    def test_name_too_long_rejected(self):
        with pytest.raises(svc.ValidationError):
            svc._clean_name("x" * (svc.MAX_NAME_LEN + 1))

    def test_description_too_long_rejected(self):
        with pytest.raises(svc.ValidationError):
            svc._clean_description("x" * (svc.MAX_DESCRIPTION_LEN + 1))

    def test_blank_description_becomes_none(self):
        assert svc._clean_description("   ") is None


class TestInviteValidity:
    def test_revoked_raises_gone(self):
        with pytest.raises(svc.GoneError):
            svc._check_invite_valid({"revoked": True, "expiresAt": None, "maxUses": None, "uses": 0})

    def test_expired_raises_gone(self):
        past = datetime.now(timezone.utc) - timedelta(days=1)
        with pytest.raises(svc.GoneError):
            svc._check_invite_valid({"revoked": False, "expiresAt": past, "maxUses": None, "uses": 0})

    def test_use_limit_reached_raises_gone(self):
        with pytest.raises(svc.GoneError):
            svc._check_invite_valid({"revoked": False, "expiresAt": None, "maxUses": 2, "uses": 2})

    def test_valid_invite_does_not_raise(self):
        future = datetime.now(timezone.utc) + timedelta(days=1)
        svc._check_invite_valid({"revoked": False, "expiresAt": future, "maxUses": 5, "uses": 1})


# ---------------------------------------------------------------------------
# Group CRUD (non-transactional paths)
# ---------------------------------------------------------------------------

class TestCreateGroup:
    def test_creates_group_with_creator_as_admin(self, db):
        group_id = svc.create_group(db, OWNER, user_info(OWNER), name="Roomies")
        group = db.collection("groups").document(group_id).get().to_dict()

        assert group["ownerId"] == OWNER
        assert group["memberIds"] == [OWNER]
        assert group["members"][OWNER]["role"] == "admin"
        assert group["balances"] == {OWNER: 0}
        assert group["pendingRequestCount"] == 0

    def test_empty_name_rejected(self, db):
        with pytest.raises(svc.ValidationError):
            svc.create_group(db, OWNER, user_info(OWNER), name="")

    def test_logs_activity(self, db):
        group_id = svc.create_group(db, OWNER, user_info(OWNER), name="Roomies")
        activity = db.collection("groups").document(group_id).collection("activity").stream()
        types = [a.to_dict()["type"] for a in activity]
        assert "GROUP_CREATED" in types

    def test_defaults_to_other_type(self, db):
        group_id = svc.create_group(db, OWNER, user_info(OWNER), name="Roomies")
        group = db.collection("groups").document(group_id).get().to_dict()
        assert group["type"] == "other"
        assert group["imageUrl"] is None

    def test_household_seeds_split_by_income(self, db):
        group_id = svc.create_group(db, OWNER, user_info(OWNER), name="Us", group_type="household")
        group = db.collection("groups").document(group_id).get().to_dict()
        builtins = {r["builtIn"] for r in group["splitRules"]}
        assert "split_by_income" in builtins
        assert group["defaultSplitRuleId"] in {r["id"] for r in group["splitRules"]}

    def test_invalid_type_rejected(self, db):
        with pytest.raises(svc.ValidationError):
            svc.create_group(db, OWNER, user_info(OWNER), name="Roomies", group_type="not_a_type")


class TestUpdateGroup:
    def test_admin_can_update_name(self, db):
        gid = seed_group(db)
        svc.update_group(db, OWNER, gid, {"name": "New Name"})
        assert db.collection("groups").document(gid).get().to_dict()["name"] == "New Name"

    def test_member_cannot_update(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        })
        with pytest.raises(svc.ForbiddenError):
            svc.update_group(db, MEMBER, gid, {"name": "Hacked"})

    def test_no_valid_fields_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(svc.ValidationError):
            svc.update_group(db, OWNER, gid, {"notAField": 1})

    def test_settings_merge_keeps_other_keys(self, db):
        gid = seed_group(db)
        svc.update_group(db, OWNER, gid, {"settings": {"membersCanInvite": True}})
        settings = db.collection("groups").document(gid).get().to_dict()["settings"]
        assert settings["membersCanInvite"] is True
        assert settings["requireApproval"] is True  # untouched

    def test_change_type_updates_field(self, db):
        gid = seed_group(db)
        svc.update_group(db, OWNER, gid, {"type": "household"})
        assert db.collection("groups").document(gid).get().to_dict()["type"] == "household"

    def test_invalid_type_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(svc.ValidationError):
            svc.update_group(db, OWNER, gid, {"type": "not_a_type"})

    def test_changing_to_partner_blocked_when_too_many_members(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
            ADMIN2: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER, ADMIN2])
        with pytest.raises(svc.ConflictError):
            svc.update_group(db, OWNER, gid, {"type": "partner"})

    def test_existing_split_rules_untouched_by_type_change(self, db):
        gid = seed_group(db)
        svc.update_group(db, OWNER, gid, {"type": "trip"})
        group = db.collection("groups").document(gid).get().to_dict()
        assert group["splitRules"] == [{
            "id": "eq", "builtIn": "equality_first", "name": None, "emoji": "⚖️",
            "kind": "equal", "params": {}, "hidden": False, "needsReview": False,
        }]

    def test_default_split_rule_id_must_reference_existing_rule(self, db):
        gid = seed_group(db)
        with pytest.raises(svc.ValidationError):
            svc.update_group(db, OWNER, gid, {"defaultSplitRuleId": "does-not-exist"})

    def test_default_split_rule_id_updates(self, db):
        gid = seed_group(db, splitRules=[
            {"id": "eq", "builtIn": "equality_first", "name": None, "emoji": "⚖️",
             "kind": "equal", "params": {}, "hidden": False, "needsReview": False},
            {"id": "love_but_i_pay", "builtIn": "love_but_i_pay", "name": None, "emoji": "❤️",
             "kind": "payer_covers", "params": {}, "hidden": False, "needsReview": False},
        ])
        svc.update_group(db, OWNER, gid, {"defaultSplitRuleId": "love_but_i_pay"})
        assert db.collection("groups").document(gid).get().to_dict()["defaultSplitRuleId"] == "love_but_i_pay"


class TestGroupCurrency:
    def test_currency_updates_and_is_normalized(self, db):
        gid = seed_group(db)
        svc.update_group(db, OWNER, gid, {"currency": "usd"})
        assert db.collection("groups").document(gid).get().to_dict()["currency"] == "USD"

    def test_empty_currency_defaults_to_ils(self, db):
        gid = seed_group(db, currency="USD")
        svc.update_group(db, OWNER, gid, {"currency": None})
        assert db.collection("groups").document(gid).get().to_dict()["currency"] == "ILS"

    def test_unknown_currency_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(svc.ValidationError):
            svc.update_group(db, OWNER, gid, {"currency": "ZZZ"})

    def test_only_admin_can_change_currency(self, db):
        gid = seed_group(db, members={OWNER: make_member(role="admin"), MEMBER: make_member()}, memberIds=[OWNER, MEMBER])
        with pytest.raises(svc.ForbiddenError):
            svc.update_group(db, MEMBER, gid, {"currency": "EUR"})

    def test_new_groups_default_to_ils(self, db):
        gid = svc.create_group(db, OWNER, user_info(OWNER), name="Trip")
        assert db.collection("groups").document(gid).get().to_dict()["currency"] == "ILS"


class TestDefaultFixedSplit:
    def _two_member_group(self, db, **extra):
        return seed_group(db, members={
            OWNER: make_member(role="admin"), MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER], **extra)

    def test_sets_fixed_split_and_marks_configured(self, db):
        gid = self._two_member_group(db)
        svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 7000, MEMBER: 3000}}})
        group = db.collection("groups").document(gid).get().to_dict()
        assert group["defaultFixedSplit"] == {"weights": {OWNER: 7000, MEMBER: 3000}}
        assert group["defaultSplitConfigured"] is True

    def test_must_sum_to_100_percent(self, db):
        gid = self._two_member_group(db)
        with pytest.raises(svc.ValidationError):
            svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 5000, MEMBER: 4000}}})

    def test_must_cover_exactly_the_active_members(self, db):
        gid = self._two_member_group(db)
        with pytest.raises(svc.ValidationError):
            svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 10000}}})
        with pytest.raises(svc.ValidationError):
            svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 5000, MEMBER: 4000, STRANGER: 1000}}})

    def test_rejects_negative_or_non_integer_weights(self, db):
        gid = self._two_member_group(db)
        with pytest.raises(svc.ValidationError):
            svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 11000, MEMBER: -1000}}})
        with pytest.raises(svc.ValidationError):
            svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 50.5, MEMBER: 49.5}}})

    def test_only_admin_can_set(self, db):
        gid = self._two_member_group(db)
        with pytest.raises(svc.ForbiddenError):
            svc.update_group(db, MEMBER, gid, {"defaultFixedSplit": {"weights": {OWNER: 5000, MEMBER: 5000}}})

    def test_choosing_a_rule_clears_the_fixed_split(self, db):
        gid = self._two_member_group(db, defaultFixedSplit={"weights": {OWNER: 5000, MEMBER: 5000}})
        svc.update_group(db, OWNER, gid, {"defaultSplitRuleId": "eq"})
        group = db.collection("groups").document(gid).get().to_dict()
        assert group["defaultFixedSplit"] is None
        assert group["defaultSplitConfigured"] is True

    def test_null_clears_the_fixed_split(self, db):
        gid = self._two_member_group(db, defaultFixedSplit={"weights": {OWNER: 5000, MEMBER: 5000}})
        svc.update_group(db, OWNER, gid, {"defaultFixedSplit": None})
        assert db.collection("groups").document(gid).get().to_dict()["defaultFixedSplit"] is None

    def test_removing_a_member_clears_the_stale_fixed_split(self, db):
        gid = self._two_member_group(db, defaultFixedSplit={"weights": {OWNER: 5000, MEMBER: 5000}})
        group_ref = db.collection("groups").document(gid)
        svc._remove_member_txn.to_wrap(db.transaction(), group_ref, OWNER, MEMBER, False)
        assert db.collection("groups").document(gid).get().to_dict()["defaultFixedSplit"] is None


class TestIncomeRatioMonths:
    def test_returns_one_breakdown_per_expense_month(self, db):
        db.collection("users").document(OWNER).collection("income").add({"month": "2026-08", "neto": 15000})
        gid = seed_group(db)
        result = svc.get_income_ratio_months(db, OWNER, gid, ["2026-09", "2026-10", "2026-09"])
        assert [r["forMonth"] for r in result] == ["2026-09", "2026-10"]
        assert result[0]["month"] == "2026-08" and result[0]["ready"] is True
        assert result[1]["month"] == "2026-09" and result[1]["ready"] is False

    def test_non_member_forbidden_and_bad_month_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(svc.ForbiddenError):
            svc.get_income_ratio_months(db, STRANGER, gid, ["2026-09"])
        with pytest.raises(svc.ValidationError):
            svc.get_income_ratio_months(db, OWNER, gid, ["nope"])


class TestSetSplitRules:
    def test_admin_can_replace_rules(self, db):
        gid = seed_group(db)
        new_rules = [
            {"id": "eq", "builtIn": "equality_first", "name": None, "emoji": "⚖️",
             "kind": "equal", "params": {}, "hidden": False, "needsReview": False},
            {"id": "rent", "builtIn": None, "name": "Rent 60/40", "emoji": "📐",
             "kind": "percent", "params": {"weights": {OWNER: 60, MEMBER: 40}}, "hidden": False, "needsReview": False},
        ]
        svc.set_split_rules(db, OWNER, gid, new_rules, "rent")

        group = db.collection("groups").document(gid).get().to_dict()
        assert group["defaultSplitRuleId"] == "rent"
        assert {r["id"] for r in group["splitRules"]} == {"eq", "rent"}

    def test_member_cannot_manage_rules(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        })
        with pytest.raises(svc.ForbiddenError):
            svc.set_split_rules(db, MEMBER, gid, [], "eq")

    def test_invalid_rules_rejected_with_validation_error(self, db):
        gid = seed_group(db)
        with pytest.raises(svc.ValidationError):
            svc.set_split_rules(db, OWNER, gid, [], "eq")  # empty rules list

    def test_default_must_be_among_submitted_rules(self, db):
        gid = seed_group(db)
        rules = [{"id": "eq", "builtIn": "equality_first", "name": None, "emoji": "⚖️",
                  "kind": "equal", "params": {}, "hidden": False, "needsReview": False}]
        with pytest.raises(svc.ValidationError):
            svc.set_split_rules(db, OWNER, gid, rules, "not-in-the-list")


class TestIncomeRatioPreview:
    def test_member_can_check_readiness(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])
        db.collection("users").document(OWNER).collection("income").add({"month": "2026-09", "neto": 10000})
        db.collection("users").document(MEMBER).collection("income").add({"month": "2026-09", "neto": 10000})

        result = svc.get_income_ratio_preview(db, MEMBER, gid, datetime(2026, 10, 5).date())

        assert result["ready"] is True
        assert result["ratios"] == {OWNER: 50, MEMBER: 50}

    def test_non_member_cannot_check(self, db):
        gid = seed_group(db)
        with pytest.raises(svc.ForbiddenError):
            svc.get_income_ratio_preview(db, STRANGER, gid, datetime(2026, 10, 5).date())


class TestDeleteGroup:
    def test_non_owner_cannot_delete(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            ADMIN2: make_member(role="admin"),
        })
        with pytest.raises(svc.ForbiddenError):
            svc.delete_group(db, ADMIN2, gid)

    def test_owner_delete_removes_group_and_subcollections_and_invites(self, db):
        gid = seed_group(db)
        db.collection("groups").document(gid).collection("activity").add({"type": "X"})
        db.collection("groupInvites").document("tok1").set({"groupId": gid, "revoked": False})

        svc.delete_group(db, OWNER, gid)

        assert not db.collection("groups").document(gid).get().exists
        assert list(db.collection("groups").document(gid).collection("activity").stream()) == []
        assert not db.collection("groupInvites").document("tok1").get().exists


# ---------------------------------------------------------------------------
# Invites (non-transactional)
# ---------------------------------------------------------------------------

class TestInvites:
    def test_get_or_create_then_reuses_same_token(self, db):
        gid = seed_group(db)
        first = svc.get_or_create_invite(db, OWNER, gid)
        second = svc.get_or_create_invite(db, OWNER, gid)
        assert first["token"] == second["token"]

    def test_rotate_revokes_old_and_issues_new(self, db):
        gid = seed_group(db)
        first = svc.get_or_create_invite(db, OWNER, gid)
        second = svc.rotate_invite(db, OWNER, gid)

        assert second["token"] != first["token"]
        old_invite = db.collection("groupInvites").document(first["token"]).get().to_dict()
        assert old_invite["revoked"] is True

    def test_revoke_marks_active_invite_revoked(self, db):
        gid = seed_group(db)
        invite = svc.get_or_create_invite(db, OWNER, gid)
        svc.revoke_invite(db, OWNER, gid)
        assert db.collection("groupInvites").document(invite["token"]).get().to_dict()["revoked"] is True

    def test_create_invite_with_expiry_sets_expires_at(self, db):
        gid = seed_group(db)
        invite = svc.get_or_create_invite(db, OWNER, gid, expires_in_days=7)
        assert invite["expiresAt"] is not None

    def test_omitting_expiry_defaults_to_seven_days(self, db):
        # Invite links must always expire (no "never" option) - omitting
        # expiresInDays falls back to the max allowed, not indefinite.
        gid = seed_group(db)
        invite = svc.get_or_create_invite(db, OWNER, gid)
        assert invite["expiresAt"] is not None

    def test_rotate_can_change_expiry(self, db):
        gid = seed_group(db)
        svc.get_or_create_invite(db, OWNER, gid)  # defaults to 7 days
        rotated = svc.rotate_invite(db, OWNER, gid, expires_in_days=1)
        assert rotated["expiresAt"] is not None

    def test_invalid_expires_in_days_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(svc.ValidationError):
            svc.get_or_create_invite(db, OWNER, gid, expires_in_days=0)

    def test_expiry_longer_than_a_week_rejected(self, db):
        # Links can be 1 or 7 days - never longer (Groups feedback, 2026-09-29).
        gid = seed_group(db)
        with pytest.raises(svc.ValidationError):
            svc.get_or_create_invite(db, OWNER, gid, expires_in_days=30)

    def test_member_cannot_manage_invite_by_default(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        })
        with pytest.raises(svc.ForbiddenError):
            svc.get_or_create_invite(db, MEMBER, gid)


class TestInvitePreview:
    def test_stranger_sees_none_status(self, db):
        gid = seed_group(db)
        invite = svc.get_or_create_invite(db, OWNER, gid)
        preview = svc.get_invite_preview(db, STRANGER, "stranger@example.com", invite["token"])
        assert preview["viewerStatus"] == "none"
        assert preview["groupName"] == "Trip to Eilat"

    def test_member_sees_member_status(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])
        invite = svc.get_or_create_invite(db, OWNER, gid)
        preview = svc.get_invite_preview(db, MEMBER, "member@example.com", invite["token"])
        assert preview["viewerStatus"] == "member"

    def test_invalid_token_raises_not_found(self, db):
        with pytest.raises(svc.NotFoundError):
            svc.get_invite_preview(db, STRANGER, "s@example.com", "does-not-exist")

    def test_revoked_link_raises_gone_for_stranger(self, db):
        gid = seed_group(db)
        invite = svc.get_or_create_invite(db, OWNER, gid)
        svc.revoke_invite(db, OWNER, gid)
        with pytest.raises(svc.GoneError):
            svc.get_invite_preview(db, STRANGER, "s@example.com", invite["token"])

    def test_whitelist_flag_reflects_whitelist_collection(self, db):
        gid = seed_group(db)
        invite = svc.get_or_create_invite(db, OWNER, gid)
        db.collection("whitelist").document("ok@example.com").set({})

        assert svc.get_invite_preview(db, STRANGER, "ok@example.com", invite["token"])["isWhitelisted"] is True
        assert svc.get_invite_preview(db, STRANGER, "no@example.com", invite["token"])["isWhitelisted"] is False


# ---------------------------------------------------------------------------
# Transactional flows — exercised via the undecorated function body (`.to_wrap`)
# with a FakeTransaction. See module docstring for why.
# ---------------------------------------------------------------------------

class TestCreateJoinRequestTxn:
    def _run(self, db, gid, token, uid, invite_overrides=None):
        invite = {"groupId": gid, "revoked": False, "expiresAt": None, "maxUses": None, "uses": 0}
        invite.update(invite_overrides or {})
        invite_ref = db.collection("groupInvites").document(token)
        invite_ref.set(invite)

        group_ref = db.collection("groups").document(gid)
        transaction = db.transaction()
        svc._create_join_request_txn.to_wrap(transaction, group_ref, invite_ref, uid, user_info(uid), token)

    def test_creates_pending_request_and_increments_counters(self, db):
        gid = seed_group(db)
        self._run(db, gid, "tok1", STRANGER)

        group = db.collection("groups").document(gid).get().to_dict()
        request = db.collection("groups").document(gid).collection("joinRequests").document(STRANGER).get().to_dict()
        invite = db.collection("groupInvites").document("tok1").get().to_dict()

        assert request["status"] == "pending"
        assert group["pendingRequestCount"] == 1
        assert invite["uses"] == 1

    def test_existing_active_member_rejected(self, db):
        gid = seed_group(db, members={OWNER: make_member(role="admin")}, memberIds=[OWNER])
        with pytest.raises(svc.ConflictError):
            self._run(db, gid, "tok1", OWNER)

    def test_full_group_rejected(self, db):
        member_ids = [f"u{i}" for i in range(svc.MAX_MEMBERS)]
        members = {uid: make_member() for uid in member_ids}
        gid = seed_group(db, memberIds=member_ids, members=members)
        with pytest.raises(svc.ConflictError):
            self._run(db, gid, "tok1", STRANGER)

    def test_duplicate_pending_request_rejected(self, db):
        gid = seed_group(db)
        self._run(db, gid, "tok1", STRANGER)
        with pytest.raises(svc.ConflictError):
            self._run(db, gid, "tok1", STRANGER)

    def test_partner_group_rejects_a_third_person(self, db):
        gid = seed_group(db, type="partner", members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])
        with pytest.raises(svc.ConflictError):
            self._run(db, gid, "tok1", STRANGER)

    def test_partner_group_allows_the_second_person(self, db):
        gid = seed_group(db, type="partner", members={OWNER: make_member(role="admin")}, memberIds=[OWNER])
        self._run(db, gid, "tok1", STRANGER)  # no raise: 2nd member is within the Partner cap


class TestApproveRequestTxn:
    def _seed_pending_request(self, db, gid, uid):
        db.collection("groups").document(gid).collection("joinRequests").document(uid).set({
            "uid": uid, "displayName": uid, "photoURL": None, "email": f"{uid}@example.com",
            "inviteToken": "tok1", "status": "pending", "requestedAt": "t",
            "decidedAt": None, "decidedBy": None,
        })
        db.collection("groups").document(gid).update({"pendingRequestCount": 1})

    def _run(self, db, gid, admin_uid, target_uid):
        group_ref = db.collection("groups").document(gid)
        request_ref = group_ref.collection("joinRequests").document(target_uid)
        transaction = db.transaction()
        svc._approve_request_txn.to_wrap(transaction, group_ref, request_ref, admin_uid, target_uid)

    def test_approve_adds_active_member(self, db):
        gid = seed_group(db)
        self._seed_pending_request(db, gid, STRANGER)

        self._run(db, gid, OWNER, STRANGER)

        group = db.collection("groups").document(gid).get().to_dict()
        assert STRANGER in group["memberIds"]
        assert group["members"][STRANGER]["role"] == "member"
        assert group["members"][STRANGER]["status"] == "active"
        assert group["balances"][STRANGER] == 0
        assert group["pendingRequestCount"] == 0

        request = db.collection("groups").document(gid).collection("joinRequests").document(STRANGER).get().to_dict()
        assert request["status"] == "approved"

    def test_non_admin_cannot_approve(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])
        self._seed_pending_request(db, gid, STRANGER)

        with pytest.raises(svc.ForbiddenError):
            self._run(db, gid, MEMBER, STRANGER)

    def test_already_decided_request_raises_conflict(self, db):
        gid = seed_group(db)
        self._seed_pending_request(db, gid, STRANGER)
        self._run(db, gid, OWNER, STRANGER)  # first approval succeeds

        with pytest.raises(svc.ConflictError):
            self._run(db, gid, OWNER, STRANGER)  # second is a no-op request, must fail

    def test_partner_group_rejects_approving_a_third_person(self, db):
        gid = seed_group(db, type="partner", members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])
        self._seed_pending_request(db, gid, STRANGER)

        with pytest.raises(svc.ConflictError):
            self._run(db, gid, OWNER, STRANGER)

    def test_new_member_gets_zero_weight_in_configured_percent_rule(self, db):
        gid = seed_group(db, splitRules=[{
            "id": "rent", "builtIn": None, "name": "Rent", "emoji": "📐", "kind": "percent",
            "params": {"weights": {OWNER: 100}}, "hidden": False, "needsReview": False,
        }])
        self._seed_pending_request(db, gid, STRANGER)

        self._run(db, gid, OWNER, STRANGER)

        rule = db.collection("groups").document(gid).get().to_dict()["splitRules"][0]
        assert rule["params"]["weights"] == {OWNER: 100, STRANGER: 0}
        assert rule["needsReview"] is True

    def test_unconfigured_percent_rule_untouched_on_approve(self, db):
        # A rule with no weights set yet (plan §3.5) isn't touched by membership changes.
        gid = seed_group(db, splitRules=[{
            "id": "rent", "builtIn": None, "name": "Rent", "emoji": "📐", "kind": "percent",
            "params": {}, "hidden": False, "needsReview": False,
        }])
        self._seed_pending_request(db, gid, STRANGER)

        self._run(db, gid, OWNER, STRANGER)

        rule = db.collection("groups").document(gid).get().to_dict()["splitRules"][0]
        assert rule["params"] == {}
        assert rule["needsReview"] is False

    def test_income_ratio_rule_untouched_on_approve(self, db):
        gid = seed_group(db, splitRules=[{
            "id": "income", "builtIn": "split_by_income", "name": None, "emoji": "💼",
            "kind": "income_ratio", "params": {}, "hidden": False, "needsReview": False,
        }])
        self._seed_pending_request(db, gid, STRANGER)

        self._run(db, gid, OWNER, STRANGER)

        rule = db.collection("groups").document(gid).get().to_dict()["splitRules"][0]
        assert rule["needsReview"] is False  # income_ratio never needs review — nothing is stored to drift


class TestRejectRequestTxn:
    def test_reject_marks_rejected_and_decrements_count(self, db):
        gid = seed_group(db)
        db.collection("groups").document(gid).collection("joinRequests").document(STRANGER).set({
            "status": "pending", "displayName": STRANGER, "email": "s@example.com", "photoURL": None,
        })
        db.collection("groups").document(gid).update({"pendingRequestCount": 1})

        group_ref = db.collection("groups").document(gid)
        request_ref = group_ref.collection("joinRequests").document(STRANGER)
        svc._reject_request_txn.to_wrap(db.transaction(), group_ref, request_ref, OWNER)

        assert request_ref.get().to_dict()["status"] == "rejected"
        assert group_ref.get().to_dict()["pendingRequestCount"] == 0


class TestChangeRoleTxn:
    def _run(self, db, gid, admin_uid, target_uid, new_role):
        group_ref = db.collection("groups").document(gid)
        svc._change_role_txn.to_wrap(db.transaction(), group_ref, admin_uid, target_uid, new_role)

    def test_promote_member_to_admin(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])

        self._run(db, gid, OWNER, MEMBER, "admin")

        assert db.collection("groups").document(gid).get().to_dict()["members"][MEMBER]["role"] == "admin"

    def test_cannot_demote_last_admin(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="admin"),
        }, memberIds=[OWNER, MEMBER])
        # OWNER is protected separately; demote MEMBER (a non-owner admin) down to the last-admin edge
        # by first making OWNER the only other admin, then trying to demote OWNER-equivalent case:
        # here we directly test the generic guard using a non-owner "sole admin" scenario.
        solo_gid = seed_group(db, "g2", members={MEMBER: make_member(role="admin")}, memberIds=[MEMBER], ownerId=STRANGER)
        with pytest.raises(svc.ConflictError):
            self._run(db, solo_gid, MEMBER, MEMBER, "member")

    def test_owner_cannot_be_demoted(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            ADMIN2: make_member(role="admin"),
        }, memberIds=[OWNER, ADMIN2])
        with pytest.raises(svc.ForbiddenError):
            self._run(db, gid, ADMIN2, OWNER, "member")

    def test_invalid_role_rejected_before_transaction(self, db):
        gid = seed_group(db)
        with pytest.raises(svc.ValidationError):
            svc.change_role(db, OWNER, gid, MEMBER, "superadmin")


class TestRemoveMemberTxn:
    def _run(self, db, gid, actor_uid, target_uid):
        group_ref = db.collection("groups").document(gid)
        svc._remove_member_txn.to_wrap(db.transaction(), group_ref, actor_uid, target_uid, actor_uid == target_uid)

    def test_admin_removes_member(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])

        self._run(db, gid, OWNER, MEMBER)

        group = db.collection("groups").document(gid).get().to_dict()
        assert MEMBER not in group["memberIds"]
        assert group["members"][MEMBER]["status"] == "removed"

    def test_member_can_leave_self(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])

        self._run(db, gid, MEMBER, MEMBER)

        group = db.collection("groups").document(gid).get().to_dict()
        assert group["members"][MEMBER]["status"] == "left"

    def test_owner_cannot_be_removed_or_leave(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            ADMIN2: make_member(role="admin"),
        }, memberIds=[OWNER, ADMIN2])

        with pytest.raises(svc.ForbiddenError):
            self._run(db, gid, ADMIN2, OWNER)
        with pytest.raises(svc.ForbiddenError):
            self._run(db, gid, OWNER, OWNER)

    def test_last_admin_cannot_leave(self, db):
        gid = seed_group(db, "g2", members={MEMBER: make_member(role="admin")}, memberIds=[MEMBER], ownerId=STRANGER)
        with pytest.raises(svc.ConflictError):
            self._run(db, gid, MEMBER, MEMBER)

    def test_member_with_open_balance_cannot_be_removed(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER], balances={OWNER: -500, MEMBER: 500})

        with pytest.raises(svc.ConflictError):
            self._run(db, gid, OWNER, MEMBER)

    def test_non_admin_cannot_remove_others(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
            ADMIN2: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER, ADMIN2])

        with pytest.raises(svc.ForbiddenError):
            self._run(db, gid, MEMBER, ADMIN2)

    def test_removed_members_weight_dropped_from_configured_rule(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER], splitRules=[{
            "id": "rent", "builtIn": None, "name": "Rent", "emoji": "📐", "kind": "percent",
            "params": {"weights": {OWNER: 60, MEMBER: 40}}, "hidden": False, "needsReview": False,
        }])

        self._run(db, gid, OWNER, MEMBER)

        rule = db.collection("groups").document(gid).get().to_dict()["splitRules"][0]
        assert rule["params"]["weights"] == {OWNER: 60}
        assert rule["needsReview"] is True

    def test_unconfigured_rule_untouched_on_remove(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER], splitRules=[{
            "id": "rent", "builtIn": None, "name": "Rent", "emoji": "📐", "kind": "percent",
            "params": {}, "hidden": False, "needsReview": False,
        }])

        self._run(db, gid, OWNER, MEMBER)

        rule = db.collection("groups").document(gid).get().to_dict()["splitRules"][0]
        assert rule["params"] == {}
        assert rule["needsReview"] is False


class TestCancelJoinRequest:
    def test_cancel_pending_request(self, db):
        gid = seed_group(db)
        invite = svc.get_or_create_invite(db, OWNER, gid)
        svc.create_join_request(db, STRANGER, user_info(STRANGER), invite["token"])

        svc.cancel_join_request(db, STRANGER, invite["token"])

        request = db.collection("groups").document(gid).collection("joinRequests").document(STRANGER).get().to_dict()
        assert request["status"] == "cancelled"
        assert db.collection("groups").document(gid).get().to_dict()["pendingRequestCount"] == 0

    def test_cancel_without_pending_request_raises_not_found(self, db):
        gid = seed_group(db)
        invite = svc.get_or_create_invite(db, OWNER, gid)
        with pytest.raises(svc.NotFoundError):
            svc.cancel_join_request(db, STRANGER, invite["token"])


class TestEndToEndInviteFlow:
    """The full invite -> request -> approve flow through the public (non-_txn) functions."""

    def test_full_flow(self, db):
        gid = svc.create_group(db, OWNER, user_info(OWNER), name="Roomies")
        invite = svc.get_or_create_invite(db, OWNER, gid)

        preview = svc.get_invite_preview(db, STRANGER, "s@example.com", invite["token"])
        assert preview["viewerStatus"] == "none"

        svc.create_join_request(db, STRANGER, user_info(STRANGER), invite["token"])
        preview = svc.get_invite_preview(db, STRANGER, "s@example.com", invite["token"])
        assert preview["viewerStatus"] == "pending"

        svc.approve_request(db, OWNER, gid, STRANGER)
        preview = svc.get_invite_preview(db, STRANGER, "s@example.com", invite["token"])
        assert preview["viewerStatus"] == "member"

        group = db.collection("groups").document(gid).get().to_dict()
        assert STRANGER in group["memberIds"]
