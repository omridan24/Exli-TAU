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
        "balancesByCurrency": {},
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
        "description": "Groceries", "amount_minor": 10000, "currency": "ILS", "date_str": "2026-10-05",
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
        db.collection("users").document(OWNER).collection("income").add({"month": "2026-10", "neto": 15000})
        db.collection("users").document(MEMBER).collection("income").add({"month": "2026-10", "neto": 5000})
        gid = seed_group(db, splitRules=[equal_rule(), income_rule()])

        expense_id = svc.create_expense(
            db, OWNER, gid, **basic_kwargs(date_str="2026-10-05", split_input={"splitRuleId": "income"})
        )
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["shares"] == {OWNER: 7500, MEMBER: 2500}
        assert expense["split"]["resolvedRatios"] == {OWNER: 75, MEMBER: 25}

    def test_income_ratio_not_ready_blocks_expense(self, db):
        db.collection("users").document(OWNER).collection("income").add({"month": "2026-10", "neto": 15000})
        # MEMBER never filled in October income
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


def seed_fx_rates(db):
    db.collection("fxRates").document("2026").set({
        "days": {
            "2026-10-05": {"ILS": 3.4, "EUR": 0.86},
            "2026-10-06": {"ILS": 3.5, "EUR": 0.87},
        },
        "monthlyAvg": {"2026-10": {"ILS": 3.45, "EUR": 0.865}},
    })
    db.collection("fxRates").document("latest").set({
        "date": "2026-10-06", "rates": {"ILS": 3.5, "EUR": 0.87},
    })


class TestMergeModeFxConversion:
    """docs/fx/01-fx-plan.md §6: a merge group converts a foreign-currency
    expense to the group's mergeCurrency and locks the rate on create; the
    SAME currency amount is always the expense's currency/mergeCurrency."""

    def test_same_currency_as_group_is_unconverted(self, db):
        gid = seed_group(db)  # mergeCurrency ILS via legacy `currency` fallback
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="ILS"))

        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["currency"] == "ILS"
        assert expense["amountMinor"] == 10000
        assert expense["original"] is None
        assert expense["fx"] is None

    def test_foreign_currency_is_converted_and_locked(self, db):
        seed_fx_rates(db)
        gid = seed_group(db)
        expense_id = svc.create_expense(
            db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD", date_str="2026-10-05")
        )

        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["currency"] == "ILS"
        assert expense["amountMinor"] == round(100 * 3.4 * 100)
        assert expense["original"] == {"amountMinor": 10000, "currency": "USD"}
        assert expense["fx"]["rate"] == pytest.approx(3.4)

        # Balances update in the GROUP's currency, the canonical one
        group = group_dict(db, gid)
        assert group["balances"][OWNER] == round(100 * 3.4 * 100) // 2
        assert group["balances"][MEMBER] == -(round(100 * 3.4 * 100) // 2)

    def test_unsupported_currency_pair_is_rejected(self, db):
        seed_fx_rates(db)
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.create_expense(
                db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="XYZ", date_str="2026-10-05")
            )

    def test_editing_same_currency_and_date_reuses_the_locked_rate(self, db):
        """plan §3 Decision B: 'editing anything else keeps it' — changing only
        the amount while currency+date stay the same must NOT re-fetch a
        (possibly different) day's rate."""
        seed_fx_rates(db)
        gid = seed_group(db)
        expense_id = svc.create_expense(
            db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD", date_str="2026-10-05")
        )

        # Mutate the stored rate for that same day, so reusing vs re-fetching is observable
        db.collection("fxRates").document("2026").set({
            "days": {"2026-10-05": {"ILS": 999.0}},  # if this got re-fetched, the result would be wildly different
            "monthlyAvg": {},
        })

        svc.edit_expense(
            db, OWNER, gid, expense_id,
            **basic_kwargs(amount_minor=20000, currency="USD", date_str="2026-10-05"),
        )

        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["fx"]["rate"] == pytest.approx(3.4)  # the ORIGINAL locked rate, not 999.0
        assert expense["amountMinor"] == round(200 * 3.4 * 100)

    def test_editing_with_a_new_date_recomputes_the_rate(self, db):
        seed_fx_rates(db)
        gid = seed_group(db)
        expense_id = svc.create_expense(
            db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD", date_str="2026-10-05")
        )

        svc.edit_expense(
            db, OWNER, gid, expense_id,
            **basic_kwargs(amount_minor=10000, currency="USD", date_str="2026-10-06"),
        )

        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["fx"]["rate"] == pytest.approx(3.5)  # the 10-06 rate, not the original 10-05 one


class TestKeepOriginalModeLedger:
    """docs/fx/01-fx-plan.md §6: a keep_original group never converts — each
    currency gets its own balance ledger in balancesByCurrency."""

    def keep_original_group(self, db, **overrides):
        return seed_group(db, currencySettings={"mode": "keep_original", "mergeCurrency": None}, **overrides)

    def test_expense_stays_in_its_own_currency_unconverted(self, db):
        gid = self.keep_original_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD"))

        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["currency"] == "USD"
        assert expense["amountMinor"] == 10000
        assert expense["original"] is None
        assert expense["fx"] is None

        group = group_dict(db, gid)
        assert group["balances"] == {OWNER: 0, MEMBER: 0}  # flat ledger untouched
        assert group["balancesByCurrency"]["USD"] == {OWNER: 5000, MEMBER: -5000}

    def test_two_currencies_keep_separate_ledgers(self, db):
        gid = self.keep_original_group(db)
        svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD"))
        svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=5000, currency="EUR"))

        group = group_dict(db, gid)
        assert group["balancesByCurrency"]["USD"] == {OWNER: 5000, MEMBER: -5000}
        assert group["balancesByCurrency"]["EUR"] == {OWNER: 2500, MEMBER: -2500}

    def test_delete_reverses_only_that_currencys_bucket(self, db):
        gid = self.keep_original_group(db)
        usd_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD"))
        svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=5000, currency="EUR"))

        svc.delete_expense(db, OWNER, gid, usd_id)

        group = group_dict(db, gid)
        assert group["balancesByCurrency"]["USD"] == {OWNER: 0, MEMBER: 0}
        assert group["balancesByCurrency"]["EUR"] == {OWNER: 2500, MEMBER: -2500}

    def test_editing_an_expenses_currency_moves_it_between_ledgers(self, db):
        gid = self.keep_original_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD"))

        svc.edit_expense(db, OWNER, gid, expense_id, **basic_kwargs(amount_minor=10000, currency="EUR"))

        group = group_dict(db, gid)
        assert group["balancesByCurrency"]["USD"] == {OWNER: 0, MEMBER: 0}
        assert group["balancesByCurrency"]["EUR"] == {OWNER: 5000, MEMBER: -5000}

    def test_member_with_outstanding_foreign_balance_cannot_be_removed(self, db):
        gid = self.keep_original_group(db)
        svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD"))

        with pytest.raises(groups_svc.ConflictError):
            groups_svc.remove_member(db, OWNER, gid, MEMBER)


class TestConvertExpense:
    """The "foreign record" alert's Convert action for ONE keep_original expense."""

    def keep_original_group(self, db):
        seed_fx_rates(db)
        return seed_group(db, currencySettings={"mode": "keep_original", "mergeCurrency": None})

    def test_converts_at_the_expenses_date_and_moves_the_ledger(self, db):
        gid = self.keep_original_group(db)
        eid = svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD", date_str="2026-10-05"))

        svc.convert_expense(db, OWNER, gid, eid, "ILS")

        expense = db.collection("groups").document(gid).collection("expenses").document(eid).get().to_dict()
        assert expense["currency"] == "ILS"
        assert expense["amountMinor"] == round(100 * 3.4 * 100)
        assert expense["original"] == {"amountMinor": 10000, "currency": "USD"}
        assert expense["fx"]["rate"] == 3.4
        assert sum(expense["shares"].values()) == expense["amountMinor"]
        group = group_dict(db, gid)
        assert group["balancesByCurrency"]["USD"] == {OWNER: 0, MEMBER: 0}
        assert group["balancesByCurrency"]["ILS"] == {OWNER: 17000, MEMBER: -17000}

    def test_custom_split_keeps_its_proportions(self, db):
        gid = self.keep_original_group(db)
        eid = svc.create_expense(
            db, OWNER, gid,
            **basic_kwargs(amount_minor=10000, currency="USD", date_str="2026-10-05",
                           split_input={"kind": "custom", "params": {"amounts": {OWNER: 7500, MEMBER: 2500}}}),
        )

        svc.convert_expense(db, OWNER, gid, eid, "ILS")

        expense = db.collection("groups").document(gid).collection("expenses").document(eid).get().to_dict()
        assert expense["shares"] == {OWNER: 25500, MEMBER: 8500}

    def test_same_currency_is_rejected(self, db):
        gid = self.keep_original_group(db)
        eid = svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD"))
        with pytest.raises(groups_svc.ValidationError):
            svc.convert_expense(db, OWNER, gid, eid, "USD")

    def test_merge_group_rejects_conversion(self, db):
        seed_fx_rates(db)
        gid = seed_group(db)
        eid = svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD", date_str="2026-10-05"))
        with pytest.raises(groups_svc.ConflictError):
            svc.convert_expense(db, OWNER, gid, eid, "USD")


class TestCurrencySettingsPatch:
    def test_merge_to_keep_original_is_always_allowed(self, db):
        gid = seed_group(db)
        groups_svc.update_group(db, OWNER, gid, {"currencySettings": {"mode": "keep_original"}})

        group = group_dict(db, gid)
        assert groups_svc.get_currency_settings(group) == {"mode": "keep_original", "mergeCurrency": None}

    def test_changing_merge_currency_converts_existing_balances(self, db):
        # Only `latest` is seeded (no day bucket for "today", whatever today's
        # real date happens to be at test-run time) so the conversion is
        # deterministically forced through the `latest` fallback rather than
        # depending on which calendar day the suite runs on.
        db.collection("fxRates").document("latest").set({
            "date": "2026-01-01", "rates": {"ILS": 3.5, "EUR": 0.87},
        })
        gid = seed_group(db, balances={OWNER: 10000, MEMBER: -10000})  # ILS mergeCurrency via legacy fallback

        groups_svc.update_group(db, OWNER, gid, {"currencySettings": {"mode": "merge", "mergeCurrency": "EUR"}})

        group = group_dict(db, gid)
        assert groups_svc.get_currency_settings(group)["mergeCurrency"] == "EUR"
        expected = round(100 * (0.87 / 3.5) * 100)
        assert group["balances"][OWNER] == expected
        assert group["balances"][MEMBER] == -expected


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


FIXED_DEFAULT = {"weights": {OWNER: 7000, MEMBER: 3000}}


class TestFixedPercentageGroupDefault:
    def test_new_expense_uses_fixed_default_and_persists_applied_split(self, db):
        gid = seed_group(db, defaultFixedSplit=FIXED_DEFAULT, defaultSplitConfigured=True)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input=None))
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["shares"] == {OWNER: 7000, MEMBER: 3000}
        assert expense["split"]["kind"] == "percent"
        assert expense["split"]["params"]["weights"] == FIXED_DEFAULT["weights"]
        assert expense["split"]["params"]["fromGroupDefault"] is True
        assert group_dict(db, gid)["balances"][MEMBER] == -3000

    def test_use_default_flag_resolves_the_same_way(self, db):
        gid = seed_group(db, defaultFixedSplit=FIXED_DEFAULT)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input={"useDefault": True}))
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["shares"] == {OWNER: 7000, MEMBER: 3000}

    def test_use_default_without_fixed_falls_back_to_default_rule(self, db):
        gid = seed_group(db)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input={"useDefault": True}))
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["split"]["splitRuleId"] == "eq"
        assert expense["shares"] == {OWNER: 5000, MEMBER: 5000}

    def test_explicit_rule_overrides_the_fixed_default(self, db):
        gid = seed_group(db, defaultFixedSplit=FIXED_DEFAULT)
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(split_input={"splitRuleId": "eq"}))
        expense = db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()
        assert expense["shares"] == {OWNER: 5000, MEMBER: 5000}

    def test_transfer_with_default_and_batch_use_default(self, db):
        gid = seed_group(db, defaultFixedSplit=FIXED_DEFAULT)
        p1 = seed_personal_expense(db, OWNER, "p1", amount=100.0)
        p2 = seed_personal_expense(db, OWNER, "p2", amount=100.0)

        result = svc.transfer_personal_expense(db, OWNER, gid, p1, {"useDefault": True})
        assert result["myShareMinor"] == 7000

        batch = svc.transfer_personal_expenses_batch(db, OWNER, gid, [p2], None, use_default=True)
        assert batch["results"][0]["status"] == "ok"
        assert batch["results"][0]["myShareMinor"] == 7000


def seed_income(db, uid, month, neto):
    db.collection("users").document(uid).collection("income").add({"month": month, "neto": neto})


def expense_dict(db, gid, expense_id):
    return db.collection("groups").document(gid).collection("expenses").document(expense_id).get().to_dict()


class TestIncomeDefaultResolvesPerExpenseMonth:
    def _group(self, db, **extra):
        return seed_group(db, splitRules=[equal_rule(), income_rule()], defaultSplitRuleId="income",
                          defaultSplitConfigured=True, **extra)

    def test_each_expense_uses_its_own_month_ratio(self, db):
        seed_income(db, OWNER, "2026-09", 15000); seed_income(db, MEMBER, "2026-09", 5000)   # 75/25 -> used by Sept
        seed_income(db, OWNER, "2026-10", 16000); seed_income(db, MEMBER, "2026-10", 4000)   # 80/20 -> used by Oct
        gid = self._group(db)

        sept = svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str="2026-09-10", split_input={"useDefault": True}))
        octo = svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str="2026-10-10", split_input=None))

        assert expense_dict(db, gid, sept)["shares"] == {OWNER: 7500, MEMBER: 2500}
        assert expense_dict(db, gid, sept)["split"]["params"]["incomeMonth"] == "2026-09"
        assert expense_dict(db, gid, octo)["shares"] == {OWNER: 8000, MEMBER: 2000}
        assert expense_dict(db, gid, octo)["split"]["params"]["incomeMonth"] == "2026-10"
        assert expense_dict(db, gid, octo)["split"]["resolvedRatios"] == {OWNER: 80, MEMBER: 20}

    def test_january_expense_uses_same_year_january_income(self, db):
        seed_income(db, OWNER, "2025-12", 15000); seed_income(db, MEMBER, "2025-12", 5000)   # would be 75/25
        seed_income(db, OWNER, "2026-01", 16000); seed_income(db, MEMBER, "2026-01", 4000)   # 80/20
        gid = self._group(db)
        jan = svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str="2026-01-10", split_input=None))
        assert expense_dict(db, gid, jan)["shares"] == {OWNER: 8000, MEMBER: 2000}
        assert expense_dict(db, gid, jan)["split"]["params"]["incomeMonth"] == "2026-01"

    def test_previous_month_income_only_falls_back_for_the_default(self, db):
        seed_income(db, OWNER, "2026-09", 15000); seed_income(db, MEMBER, "2026-09", 5000)
        gid = self._group(db)  # no October income yet
        octo = svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str="2026-10-10", split_input=None))
        assert expense_dict(db, gid, octo)["shares"] == {OWNER: 5000, MEMBER: 5000}
        assert expense_dict(db, gid, octo)["split"]["params"]["incomeFallback"] is True

    def test_missing_income_falls_back_to_equal_for_the_default(self, db):
        gid = self._group(db)  # nobody has income data
        expense_id = svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str="2026-10-10", split_input=None))
        expense = expense_dict(db, gid, expense_id)
        assert expense["shares"] == {OWNER: 5000, MEMBER: 5000}
        assert expense["split"]["params"]["incomeFallback"] is True
        assert expense["split"]["params"]["incomeMonth"] == "2026-10"

    def test_picking_the_income_rule_by_hand_still_blocks_when_missing(self, db):
        gid = self._group(db)
        with pytest.raises(groups_svc.ConflictError):
            svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str="2026-10-10", split_input={"splitRuleId": "income"}))

    def test_transfer_from_analytics_uses_the_expense_month(self, db):
        seed_income(db, OWNER, "2026-09", 15000); seed_income(db, MEMBER, "2026-09", 5000)
        seed_income(db, OWNER, "2026-10", 16000); seed_income(db, MEMBER, "2026-10", 4000)
        gid = self._group(db)
        p_sept = seed_personal_expense(db, OWNER, "p1", amount=100.0, date="2026-09-03")
        p_oct = seed_personal_expense(db, OWNER, "p2", amount=100.0, date="2026-10-03")

        assert svc.transfer_personal_expense(db, OWNER, gid, p_sept, {"useDefault": True})["myShareMinor"] == 7500
        assert svc.transfer_personal_expense(db, OWNER, gid, p_oct, {"useDefault": True})["myShareMinor"] == 8000


class TestApplyDefaultSplitToExisting:
    def _seed_expense(self, db, gid, date, amount=10000, **kw):
        return svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str=date, amount_minor=amount, split_input={"splitRuleId": "eq"}, **kw))

    def test_converts_all_with_per_month_income_and_fixes_balances(self, db):
        seed_income(db, OWNER, "2026-09", 15000); seed_income(db, MEMBER, "2026-09", 5000)
        seed_income(db, OWNER, "2026-10", 16000); seed_income(db, MEMBER, "2026-10", 4000)
        gid = seed_group(db, splitRules=[equal_rule(), income_rule()])
        sept = self._seed_expense(db, gid, "2026-09-10")
        octo = self._seed_expense(db, gid, "2026-10-10")
        groups_svc.update_group(db, OWNER, gid, {"defaultSplitRuleId": "income"})

        result = svc.apply_default_split_to_existing(db, OWNER, gid)

        assert result["converted"] == 2 and result["skipped"] == []
        assert expense_dict(db, gid, sept)["shares"] == {OWNER: 7500, MEMBER: 2500}
        assert expense_dict(db, gid, octo)["shares"] == {OWNER: 8000, MEMBER: 2000}
        balances = group_dict(db, gid)["balances"]
        assert balances == {OWNER: 2500 + 2000, MEMBER: -(2500 + 2000)}

    def test_converts_to_fixed_percentages(self, db):
        gid = seed_group(db)
        e1 = self._seed_expense(db, gid, "2026-09-10")
        groups_svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 7000, MEMBER: 3000}}})
        result = svc.apply_default_split_to_existing(db, OWNER, gid)
        assert result["converted"] == 1
        assert expense_dict(db, gid, e1)["shares"] == {OWNER: 7000, MEMBER: 3000}
        assert group_dict(db, gid)["balances"][MEMBER] == -3000

    def test_second_run_is_a_noop(self, db):
        gid = seed_group(db)
        self._seed_expense(db, gid, "2026-09-10")
        groups_svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 7000, MEMBER: 3000}}})
        svc.apply_default_split_to_existing(db, OWNER, gid)
        again = svc.apply_default_split_to_existing(db, OWNER, gid)
        assert again["converted"] == 0 and again["unchanged"] == 1

    def test_deleted_expenses_are_left_alone(self, db):
        gid = seed_group(db)
        e1 = self._seed_expense(db, gid, "2026-09-10")
        svc.delete_expense(db, OWNER, gid, e1)
        groups_svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 7000, MEMBER: 3000}}})
        assert svc.apply_default_split_to_existing(db, OWNER, gid)["total"] == 0

    def test_missing_income_month_falls_back_and_is_flagged(self, db):
        gid = seed_group(db, splitRules=[equal_rule(), income_rule()])
        e1 = self._seed_expense(db, gid, "2026-09-10")
        groups_svc.update_group(db, OWNER, gid, {"defaultSplitRuleId": "income"})
        svc.apply_default_split_to_existing(db, OWNER, gid)
        assert expense_dict(db, gid, e1)["split"]["params"]["incomeFallback"] is True

    def test_unconvertible_expense_is_skipped_not_fatal(self, db):
        gid = seed_group(db, splitRules=[equal_rule(), your_treat_rule()])
        e1 = self._seed_expense(db, gid, "2026-09-10")
        groups_svc.update_group(db, OWNER, gid, {"defaultSplitRuleId": "treat"})
        db.collection("groups").document(gid).update({"members.third": make_member(), "memberIds": [OWNER, MEMBER, "third"]})
        e2 = svc.create_expense(db, OWNER, gid, **basic_kwargs(participants=[OWNER, MEMBER, "third"], split_input={"splitRuleId": "eq"}))
        result = svc.apply_default_split_to_existing(db, OWNER, gid)
        assert {s["expenseId"] for s in result["skipped"]} == {e2}
        assert result["converted"] == 1
        assert expense_dict(db, gid, e1)["shares"] == {OWNER: 0, MEMBER: 10000}

    def test_requires_admin_and_a_configured_default(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.apply_default_split_to_existing(db, OWNER, gid)
        groups_svc.update_group(db, OWNER, gid, {"defaultSplitRuleId": "eq"})
        with pytest.raises(groups_svc.ForbiddenError):
            svc.apply_default_split_to_existing(db, MEMBER, gid)

    def test_large_group_is_written_in_chunks_under_the_batch_limit(self, db):
        gid = seed_group(db)
        for i in range(svc.CONVERT_CHUNK_SIZE + 5):
            self._seed_expense(db, gid, "2026-09-10", amount=10000 + i)
        groups_svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 7000, MEMBER: 3000}}})
        result = svc.apply_default_split_to_existing(db, OWNER, gid)
        assert result["converted"] == svc.CONVERT_CHUNK_SIZE + 5
        assert len(db.batch_commits) == 2
        assert sum(group_dict(db, gid)["balances"].values()) == 0

    def test_personal_transfer_expense_amount_follows_the_new_share(self, db):
        gid = seed_group(db)
        pid = seed_personal_expense(db, OWNER, "p1", amount=100.0)
        svc.transfer_personal_expense(db, OWNER, gid, pid, {"splitRuleId": "eq"})
        groups_svc.update_group(db, OWNER, gid, {"defaultFixedSplit": {"weights": {OWNER: 7000, MEMBER: 3000}}})
        svc.apply_default_split_to_existing(db, OWNER, gid)
        assert db.collection("users").document(OWNER).collection("expenses").document(pid).get().to_dict()["amount"] == 70.0


class TestIncomeFixes:
    """Income uploaded AFTER expenses fell back to an equal split (incomeFallback)."""

    def _group_with_fallback_expense(self, db, date="2026-10-10"):
        gid = seed_group(db, splitRules=[equal_rule(), income_rule()], defaultSplitRuleId="income", defaultSplitConfigured=True)
        eid = svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str=date, split_input=None))
        assert expense_dict(db, gid, eid)["split"]["params"]["incomeFallback"] is True
        return gid, eid

    def test_nothing_to_fix_while_income_is_still_missing(self, db):
        gid, _ = self._group_with_fallback_expense(db)
        seed_income(db, OWNER, "2026-10", 16000)  # member's income still missing
        assert svc.get_income_fixes(db, OWNER, gid) == {"fixes": []}
        assert svc.apply_income_fixes(db, OWNER, gid) == {"converted": 0}

    def test_preview_lists_fixable_expense_without_writing(self, db):
        gid, eid = self._group_with_fallback_expense(db)
        seed_income(db, OWNER, "2026-10", 16000); seed_income(db, MEMBER, "2026-10", 4000)

        fix, = svc.get_income_fixes(db, OWNER, gid)["fixes"]

        assert fix["expenseId"] == eid
        assert fix["oldShares"] == {OWNER: 5000, MEMBER: 5000}
        assert fix["newShares"] == {OWNER: 8000, MEMBER: 2000}
        assert expense_dict(db, gid, eid)["shares"] == {OWNER: 5000, MEMBER: 5000}

    def test_apply_resplits_by_income_and_fixes_balances(self, db):
        gid, eid = self._group_with_fallback_expense(db)
        seed_income(db, OWNER, "2026-10", 16000); seed_income(db, MEMBER, "2026-10", 4000)

        assert svc.apply_income_fixes(db, OWNER, gid) == {"converted": 1}

        expense = expense_dict(db, gid, eid)
        assert expense["shares"] == {OWNER: 8000, MEMBER: 2000}
        assert expense["split"]["kind"] == "income_ratio"
        assert "incomeFallback" not in expense["split"]["params"]
        assert group_dict(db, gid)["balances"] == {OWNER: 2000, MEMBER: -2000}
        assert svc.get_income_fixes(db, OWNER, gid) == {"fixes": []}  # already fixed

    def test_only_months_with_complete_income_are_fixed(self, db):
        gid, sept = self._group_with_fallback_expense(db, "2026-09-10")
        octo = svc.create_expense(db, OWNER, gid, **basic_kwargs(date_str="2026-10-10", split_input=None))
        seed_income(db, OWNER, "2026-10", 16000); seed_income(db, MEMBER, "2026-10", 4000)

        svc.apply_income_fixes(db, OWNER, gid)

        assert expense_dict(db, gid, octo)["shares"] == {OWNER: 8000, MEMBER: 2000}
        assert expense_dict(db, gid, sept)["shares"] == {OWNER: 5000, MEMBER: 5000}

    def test_requires_admin(self, db):
        gid, _ = self._group_with_fallback_expense(db)
        with pytest.raises(groups_svc.ForbiddenError):
            svc.get_income_fixes(db, MEMBER, gid)
        with pytest.raises(groups_svc.ForbiddenError):
            svc.apply_income_fixes(db, MEMBER, gid)


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
