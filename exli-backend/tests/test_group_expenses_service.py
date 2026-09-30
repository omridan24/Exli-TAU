"""
Unit tests for services/group_expenses_service.py, using the same FakeClient
approach as test_groups_service.py (see that file's module docstring for why).
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.fake_firestore import FakeClient
import services.group_expenses_service as svc
import services.groups_service as groups_svc

OWNER = "owner-uid"
MEMBER = "member-uid"
STRANGER = "stranger-uid"


def make_member(role="member", status="active"):
    return {
        "role": role, "status": status, "displayName": "Name", "photoURL": None,
        "email": "x@example.com", "joinedAt": "t", "addedBy": OWNER,
    }


def equal_rule():
    return {"id": "eq", "builtIn": "equality_first", "name": None, "emoji": "⚖️",
             "kind": "equal", "params": {}, "hidden": False, "needsReview": False}


def income_rule():
    return {"id": "income", "builtIn": "split_by_income", "name": None, "emoji": "💼",
             "kind": "income_ratio", "params": {}, "hidden": False, "needsReview": False}


def percent_rule(weights, hidden=False):
    return {"id": "rent", "builtIn": None, "name": "Rent", "emoji": "📐",
             "kind": "percent", "params": {"weights": weights}, "hidden": hidden, "needsReview": False}


def your_treat_rule():
    return {"id": "treat", "builtIn": "your_treat", "name": None, "emoji": "🎁",
             "kind": "others_cover", "params": {}, "hidden": False, "needsReview": False}


def make_group(**overrides):
    group = {
        "name": "Us", "type": "household", "currency": "ILS", "ownerId": OWNER,
        "memberIds": [OWNER, MEMBER],
        "members": {OWNER: make_member(role="admin"), MEMBER: make_member(role="member")},
        "settings": {},
        "splitRules": [equal_rule()],
        "defaultSplitRuleId": "eq",
        "balances": {OWNER: 0, MEMBER: 0},
        "pendingRequestCount": 0,
        "status": "active",
        "version": 1,
        "createdAt": "t", "updatedAt": "t",
    }
    group.update(overrides)
    return group


@pytest.fixture
def db():
    return FakeClient()


def seed_group(db, group_id="g1", **overrides):
    db.collection("groups").document(group_id).set(make_group(**overrides))
    return group_id


def group_dict(db, gid):
    return db.collection("groups").document(gid).get().to_dict()


def basic_kwargs(**overrides):
    kwargs = {
        "description": "Groceries", "amount_minor": 10000, "date_str": "2026-10-05",
        "category": "food", "payer_id": OWNER, "participants": [OWNER, MEMBER],
    }
    kwargs.update(overrides)
    return kwargs


class TestCreateExpense:
    def test_creates_expense_and_updates_balances(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs())

        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["amountMinor"] == 10000
        assert expense["shares"] == {OWNER: 5000, MEMBER: 5000}
        assert expense["deleted"] is False
        assert expense["source"] == "manual"

        group = group_dict(db, gid)
        assert group["balances"][OWNER] == 5000   # paid 10000, owes 5000 -> net +5000
        assert group["balances"][MEMBER] == -5000  # owes 5000

    def test_balances_stay_zero_sum(self, db):
        gid = seed_group(db)
        svc.create_expense(db, OWNER, gid, **basic_kwargs())
        group = group_dict(db, gid)
        assert sum(group["balances"].values()) == 0

    def test_defaults_to_the_group_default_split_rule(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input=None))
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["split"]["splitRuleId"] == "eq"

    def test_non_member_cannot_add_expense(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ForbiddenError):
            svc.create_expense(db, STRANGER, gid, **basic_kwargs(payer_id=STRANGER))

    def test_payer_must_be_active_member(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.create_expense(db, OWNER, gid, **basic_kwargs(payer_id=STRANGER))

    def test_participant_must_be_active_member(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.create_expense(db, OWNER, gid, **basic_kwargs(participants=[OWNER, STRANGER]))

    def test_empty_description_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.create_expense(db, OWNER, gid, **basic_kwargs(description="  "))

    def test_zero_amount_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=0))

    def test_bad_date_format_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str="10/05/2026"))

    def test_hidden_split_rule_rejected(self, db):
        gid = seed_group(db, splitRules=[equal_rule(), percent_rule({OWNER: 50, MEMBER: 50}, hidden=True)])
        with pytest.raises(groups_svc.ValidationError):
            svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input={"splitRuleId": "rent"}))

    def test_unknown_split_rule_id_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input={"splitRuleId": "not-a-rule"}))

    def test_percent_rule_produces_matching_shares(self, db):
        gid = seed_group(db, splitRules=[equal_rule(), percent_rule({OWNER: 60, MEMBER: 40})])
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input={"splitRuleId": "rent"}))
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["shares"] == {OWNER: 6000, MEMBER: 4000}

    def test_custom_pour_it_yourself_split(self, db):
        gid = seed_group(db)
        split_input = {"kind": "custom", "params": {"amounts": {OWNER: 7000, MEMBER: 3000}}}
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input=split_input))
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["shares"] == {OWNER: 7000, MEMBER: 3000}
        assert expense["split"]["splitRuleId"] is None

    def test_custom_split_must_sum_to_amount(self, db):
        gid = seed_group(db)
        split_input = {"kind": "custom", "params": {"amounts": {OWNER: 5000, MEMBER: 3000}}}
        with pytest.raises(groups_svc.ValidationError):
            svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input=split_input))

    def test_income_ratio_split_ready(self, db):
        db.collection("users").document(OWNER).collection("income").add({"month": "2026-09", "neto": 15000})
        db.collection("users").document(MEMBER).collection("income").add({"month": "2026-09", "neto": 5000})
        gid = seed_group(db, splitRules=[equal_rule(), income_rule()])

        expense_id = svc.create_expense(
            db, OWNER, gid, **basic_kwargs(date_str="2026-10-05", split_input={"splitRuleId": "income"})
        )
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["shares"] == {OWNER: 7500, MEMBER: 2500}
        assert expense["split"]["resolvedRatios"] == {OWNER: 75, MEMBER: 25}

    def test_income_ratio_not_ready_blocks_expense(self, db):
        db.collection("users").document(OWNER).collection("income").add({"month": "2026-09", "neto": 15000})
        # MEMBER never filled in September income
        gid = seed_group(db, splitRules=[equal_rule(), income_rule()])

        with pytest.raises(groups_svc.ConflictError) as exc_info:
            svc.create_expense(
                db, OWNER, gid, **basic_kwargs(date_str="2026-10-05", split_input={"splitRuleId": "income"})
            )
        assert exc_info.value.code == "INCOME_NOT_READY"

    def test_your_treat_works_between_exactly_two_people(self, db):
        gid = seed_group(db, splitRules=[equal_rule(), your_treat_rule()])
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input={"splitRuleId": "treat"}))
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["shares"] == {OWNER: 0, MEMBER: 10000}

    def test_your_treat_rejected_with_three_or_more_people(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
            STRANGER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER, STRANGER], splitRules=[equal_rule(), your_treat_rule()])

        with pytest.raises(groups_svc.ValidationError) as exc_info:
            svc.create_expense(db, OWNER, gid, **basic_kwargs(
                participants=[OWNER, MEMBER, STRANGER], split_input={"splitRuleId": "treat"}
            ))
        assert exc_info.value.code == "NEEDS_TWO_PEOPLE"

    def test_logs_activity(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs())
        activity = list(db.collection("groups").document(gid).collection("activity").stream())
        assert any(a.to_dict()["type"] == "EXPENSE_ADDED" for a in activity)
        assert any(a.to_dict()["metadata"].get("expenseId") == expense_id for a in activity)


class TestEditExpense:
    def test_creator_can_edit_and_balances_update(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000))

        svc.edit_expense(db, OWNER, gid, expense_id, **basic_kwargs(amount_minor=20000))

        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["amountMinor"] == 20000
        assert expense["shares"] == {OWNER: 10000, MEMBER: 10000}

        group = group_dict(db, gid)
        assert group["balances"][OWNER] == 10000
        assert group["balances"][MEMBER] == -10000
        assert sum(group["balances"].values()) == 0

    def test_admin_can_edit_someone_elses_expense(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, MEMBER, gid, **basic_kwargs(payer_id=MEMBER))
        svc.edit_expense(db, OWNER, gid, expense_id, **basic_kwargs(payer_id=MEMBER, description="Updated"))
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["description"] == "Updated"

    def test_non_creator_non_admin_cannot_edit(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs())  # OWNER (admin) created it

        # MEMBER is a plain member: not the creator, not an admin.
        with pytest.raises(groups_svc.ForbiddenError):
            svc.edit_expense(db, MEMBER, gid, expense_id, **basic_kwargs())

    def test_editing_missing_expense_raises_not_found(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.NotFoundError):
            svc.edit_expense(db, OWNER, gid, "does-not-exist", **basic_kwargs())

    def test_changing_payer_moves_the_balance_correctly(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(payer_id=OWNER, amount_minor=10000))
        svc.edit_expense(db, OWNER, gid, expense_id, **basic_kwargs(payer_id=MEMBER, amount_minor=10000))

        group = group_dict(db, gid)
        # OWNER no longer paid or owes anything; MEMBER paid 10000 and owes half.
        assert group["balances"][OWNER] == -5000
        assert group["balances"][MEMBER] == 5000
        assert sum(group["balances"].values()) == 0


class TestDeleteExpense:
    def test_soft_delete_reverses_balances_and_keeps_the_record(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs())

        svc.delete_expense(db, OWNER, gid, expense_id)

        expense_ref = db.collection("groups").document(gid).collection("expenses").document(expense_id)
        expense = expense_ref.get().to_dict()
        assert expense["deleted"] is True
        assert expense["deletedBy"] == OWNER
        assert expense["description"] == "Groceries"  # record itself is kept, not erased

        group = group_dict(db, gid)
        assert group["balances"] == {OWNER: 0, MEMBER: 0}

    def test_deleted_expense_cannot_be_deleted_again(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs())
        svc.delete_expense(db, OWNER, gid, expense_id)

        with pytest.raises(groups_svc.NotFoundError):
            svc.delete_expense(db, OWNER, gid, expense_id)

    def test_non_creator_non_admin_cannot_delete(self, db):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs())

        with pytest.raises(groups_svc.ForbiddenError):
            svc.delete_expense(db, MEMBER, gid, expense_id)

    def test_creator_can_delete_own_expense(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, MEMBER, gid, **basic_kwargs(payer_id=MEMBER))
        svc.delete_expense(db, MEMBER, gid, expense_id)  # no raise


def seed_personal_expense(db, uid, doc_id="p1", **overrides):
    doc = {"description": "Groceries", "amount": 100.0, "date": "2026-10-05", "assignedCategory": "food"}
    doc.update(overrides)
    db.collection("users").document(uid).collection("expenses").document(doc_id).set(doc)
    return doc_id


class TestTransferPersonalExpense:
    def test_transfers_and_reduces_personal_amount_to_own_share(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, amount=100.0)

        result = svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})

        group_expense = db.collection("groups").document(gid).collection("expenses").document(result["expenseId"]).get().to_dict()
        assert group_expense["amountMinor"] == 10000
        assert group_expense["source"] == "personal_transfer"
        assert group_expense["sourcePersonalExpenseId"] == pid

        personal = db.collection("users").document(OWNER).collection("expenses").document(pid).get().to_dict()
        assert personal["amount"] == 50.0  # half of 100, equal split between OWNER and MEMBER
        assert personal["originalAmount"] == 100.0
        assert personal["groupRef"]["groupId"] == gid
        assert personal["groupRef"]["groupExpenseId"] == result["expenseId"]

    def test_updates_group_balances(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, amount=100.0)
        svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})

        group = db.collection("groups").document(gid).get().to_dict()
        assert group["balances"][OWNER] == 5000
        assert group["balances"][MEMBER] == -5000

    def test_already_shared_expense_rejected(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, amount=100.0)
        svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})

        with pytest.raises(groups_svc.ConflictError):
            svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})

    def test_non_member_cannot_transfer(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, STRANGER, amount=100.0)

        with pytest.raises(groups_svc.ForbiddenError):
            svc.transfer_personal_expense(db, STRANGER, gid, pid, {"splitRuleId": "eq"})

    def test_missing_personal_expense_id_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.transfer_personal_expense(db, OWNER, gid, None, {"splitRuleId": "eq"})

    def test_missing_personal_expense_raises_not_found(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.NotFoundError):
            svc.transfer_personal_expense(db, OWNER, gid, "does-not-exist", {"splitRuleId": "eq"})

    def test_carries_over_description_date_and_category(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, description="Coffee run", date="2026-11-02T09:00:00.000Z", assignedCategory="food", amount=20.0)

        result = svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})

        group_expense = db.collection("groups").document(gid).collection("expenses").document(result["expenseId"]).get().to_dict()
        assert group_expense["description"] == "Coffee run"
        assert group_expense["date"] == "2026-11-02"
        assert group_expense["category"] == "food"


class TestTransferPersonalExpensesBatch:
    def test_transfers_all_with_one_rule(self, db):
        gid = seed_group(db)
        p1 = seed_personal_expense(db, OWNER, "p1", amount=100.0)
        p2 = seed_personal_expense(db, OWNER, "p2", amount=50.0)

        result = svc.transfer_personal_expenses_batch(db, OWNER, gid, [p1, p2], "eq")

        assert all(r["status"] == "ok" for r in result["results"])
        assert db.collection("users").document(OWNER).collection("expenses").document(p1).get().to_dict()["amount"] == 50.0
        assert db.collection("users").document(OWNER).collection("expenses").document(p2).get().to_dict()["amount"] == 25.0

    def test_one_already_shared_does_not_block_the_rest(self, db):
        gid = seed_group(db)
        p1 = seed_personal_expense(db, OWNER, "p1", amount=100.0)
        p2 = seed_personal_expense(db, OWNER, "p2", amount=50.0)
        svc.transfer_personal_expense(db, OWNER, gid, p1, {"splitRuleId": "eq"})  # already shared

        result = svc.transfer_personal_expenses_batch(db, OWNER, gid, [p1, p2], "eq")

        by_id = {r["personalExpenseId"]: r for r in result["results"]}
        assert by_id[p1]["status"] == "error"
        assert by_id[p1]["code"] == "CONFLICT"
        assert by_id[p2]["status"] == "ok"

    def test_empty_list_rejected(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.transfer_personal_expenses_batch(db, OWNER, gid, [], "eq")

    def test_missing_split_rule_id_rejected(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, amount=10.0)
        with pytest.raises(groups_svc.ValidationError):
            svc.transfer_personal_expenses_batch(db, OWNER, gid, [pid], None)

    def test_too_many_ids_rejected(self, db):
        gid = seed_group(db)
        ids = [f"p{i}" for i in range(svc.MAX_BATCH_TRANSFER + 1)]
        with pytest.raises(groups_svc.ValidationError):
            svc.transfer_personal_expenses_batch(db, OWNER, gid, ids, "eq")


class TestRemovePersonalExpenseFromGroup:
    def test_restores_original_amount_and_clears_group_ref(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, amount=100.0)
        svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})

        svc.remove_personal_expense_from_group(db, OWNER, gid, pid)

        personal = db.collection("users").document(OWNER).collection("expenses").document(pid).get().to_dict()
        assert personal["amount"] == 100.0
        assert "originalAmount" not in personal
        assert "groupRef" not in personal

    def test_reverses_group_balances_and_soft_deletes_the_group_expense(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, amount=100.0)
        result = svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})

        svc.remove_personal_expense_from_group(db, OWNER, gid, pid)

        group = group_dict(db, gid)
        assert group["balances"][OWNER] == 0
        assert group["balances"][MEMBER] == 0

        group_expense = db.collection("groups").document(gid).collection("expenses").document(result["expenseId"]).get().to_dict()
        assert group_expense["deleted"] is True

    def test_can_be_shared_again_after_removal(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, amount=100.0)
        svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})
        svc.remove_personal_expense_from_group(db, OWNER, gid, pid)

        # Should no longer raise ConflictError - it's a plain personal expense again.
        result = svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})
        assert result["expenseId"]

    def test_expense_not_shared_to_this_group_rejected(self, db):
        gid = seed_group(db)
        other_gid = seed_group(db, "g2")
        pid = seed_personal_expense(db, OWNER, amount=100.0)
        svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})

        with pytest.raises(groups_svc.ValidationError):
            svc.remove_personal_expense_from_group(db, OWNER, other_gid, pid)

    def test_never_shared_expense_rejected(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, amount=100.0)

        with pytest.raises(groups_svc.ValidationError):
            svc.remove_personal_expense_from_group(db, OWNER, gid, pid)

    def test_missing_personal_expense_raises_not_found(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.NotFoundError):
            svc.remove_personal_expense_from_group(db, OWNER, gid, "does-not-exist")
