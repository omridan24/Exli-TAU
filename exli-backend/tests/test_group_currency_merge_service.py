"""
"Merge history" merges the EXPENSES (and payments) into the merge currency and derives the balances from
them - it never converts balances. See services/group_currency_merge_service.py.

Rates seeded by seed_fx_rates (ILS per USD): 2026-10-05 -> 3.4, 2026-10-06 -> 3.5.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.fake_firestore import FakeClient
from tests.test_group_expenses_service import (
    OWNER, MEMBER, make_member, seed_group, group_dict, basic_kwargs, seed_fx_rates,
)
import services.group_expenses_service as expenses_svc
import services.group_settlements_service as settle_svc
import services.group_currency_merge_service as merge_svc
import services.groups_service as groups_svc

KEEP = {"mode": "keep_original", "mergeCurrency": None}
MERGE_ILS = {"currencySettings": {"mode": "merge", "mergeCurrency": "ILS", "confirmMerge": True}}


@pytest.fixture
def db():
    return FakeClient()


def expense_docs(db, gid):
    return {d.id: d.to_dict() for d in db.collection("groups").document(gid).collection("expenses").stream()}


def keep_group_with_usd(db, *amounts_and_dates):
    seed_fx_rates(db)
    gid = seed_group(db, currencySettings=KEEP)
    ids = [
        expenses_svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=amount, currency="USD", date_str=date))
        for amount, date in amounts_and_dates
    ]
    return gid, ids


class TestSwitchKeepOriginalToMerge:
    def test_needs_confirmation_and_changes_nothing_until_confirmed(self, db):
        gid, [eid] = keep_group_with_usd(db, (10000, "2026-10-05"))

        with pytest.raises(groups_svc.ConflictError) as exc:
            groups_svc.update_group(db, OWNER, gid, {"currencySettings": {"mode": "merge", "mergeCurrency": "ILS"}})

        assert exc.value.code == "MERGE_HISTORY_REQUIRED"
        assert groups_svc.get_currency_settings(group_dict(db, gid))["mode"] == "keep_original"
        assert expense_docs(db, gid)[eid]["currency"] == "USD"  # untouched

    def test_each_expense_is_converted_at_its_own_dates_rate(self, db):
        gid, [e1, e2] = keep_group_with_usd(db, (10000, "2026-10-05"), (30000, "2026-10-06"))

        groups_svc.update_group(db, OWNER, gid, MERGE_ILS)

        docs = expense_docs(db, gid)
        assert (docs[e1]["currency"], docs[e1]["amountMinor"]) == ("ILS", 34000)    # $100 * 3.4
        assert (docs[e2]["currency"], docs[e2]["amountMinor"]) == ("ILS", 105000)   # $300 * 3.5
        assert docs[e1]["original"] == {"amountMinor": 10000, "currency": "USD"}
        assert docs[e1]["fx"]["rate"] == 3.4
        assert sum(docs[e1]["shares"].values()) == 34000 and sum(docs[e2]["shares"].values()) == 105000

    def test_balances_are_derived_from_the_converted_expenses(self, db):
        gid, _ = keep_group_with_usd(db, (10000, "2026-10-05"), (30000, "2026-10-06"))

        groups_svc.update_group(db, OWNER, gid, MERGE_ILS)

        group = group_dict(db, gid)
        assert groups_svc.get_currency_settings(group) == {"mode": "merge", "mergeCurrency": "ILS"}
        assert group["balances"] == {OWNER: 69500, MEMBER: -69500}   # (34000 + 105000) / 2
        assert group["balancesByCurrency"] == {}
        types = [d.to_dict()["type"] for d in db.collection("groups").document(gid).collection("activity").stream()]
        assert "HISTORY_MERGED" in types

    def test_debts_fully_paid_in_dollars_stay_fully_paid(self, db):
        # The Exli group case: everything owed in $ was already settled, but the $ expense still has to move to ILS.
        gid, [eid] = keep_group_with_usd(db, (10000, "2026-10-05"))
        sid = settle_svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=5000, currency="USD")

        groups_svc.update_group(db, OWNER, gid, MERGE_ILS)

        assert expense_docs(db, gid)[eid]["currency"] == "ILS"
        settlement = db.collection("groups").document(gid).collection("settlements").document(sid).get().to_dict()
        assert (settlement["currency"], settlement["amountMinor"]) == ("ILS", 17000)   # $50 * 3.4
        assert settlement["original"] == {"amountMinor": 5000, "currency": "USD"}
        assert group_dict(db, gid)["balances"] == {OWNER: 0, MEMBER: 0}

    def test_the_preview_lists_what_will_change_and_writes_nothing(self, db):
        gid, [eid, _] = keep_group_with_usd(db, (10000, "2026-10-05"), (30000, "2026-10-06"))

        preview = merge_svc.preview(db, OWNER, gid, "ILS")

        assert preview["needsConfirm"] is True
        [detail] = preview["details"]
        assert (detail["currency"], detail["expenseCount"], detail["totalMinor"], detail["newTotalMinor"]) == ("USD", 2, 40000, 139000)
        assert round(detail["rate"], 4) == 3.475
        assert (detail["firstDate"], detail["lastDate"]) == ("2026-10-05", "2026-10-06")
        assert len(preview["expenses"]) == 2 and preview["balances"] == {OWNER: 69500, MEMBER: -69500}
        assert expense_docs(db, gid)[eid]["currency"] == "USD"

    def test_deleted_expenses_are_not_converted_or_counted(self, db):
        gid, [e1, e2] = keep_group_with_usd(db, (10000, "2026-10-05"), (30000, "2026-10-06"))
        expenses_svc.delete_expense(db, OWNER, gid, e2)

        groups_svc.update_group(db, OWNER, gid, MERGE_ILS)

        assert group_dict(db, gid)["balances"] == {OWNER: 17000, MEMBER: -17000}
        assert expense_docs(db, gid)[e2]["currency"] == "USD"

    def test_stale_stored_balances_are_corrected_from_the_expenses(self, db):
        seed_fx_rates(db)
        gid = seed_group(db, currencySettings=KEEP, balances={OWNER: -12345, MEMBER: 12345})  # drifted flat ledger
        expenses_svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="ILS"))

        groups_svc.update_group(db, OWNER, gid, MERGE_ILS)

        assert group_dict(db, gid)["balances"] == {OWNER: 5000, MEMBER: -5000}

    def test_nothing_to_convert_switches_freely(self, db):
        gid = seed_group(db, currencySettings=KEEP)
        groups_svc.update_group(db, OWNER, gid, {"currencySettings": {"mode": "merge", "mergeCurrency": "ILS"}})
        assert groups_svc.get_currency_settings(group_dict(db, gid))["mode"] == "merge"

    def test_a_missing_rate_refuses_instead_of_guessing(self, db):
        gid = seed_group(db, currencySettings=KEEP)
        expenses_svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="ILS"))
        db.collection("groups").document(gid).collection("expenses").document("odd").set({
            "description": "x", "amountMinor": 1000, "currency": "JPY", "date": "2001-01-01", "paidBy": OWNER,
            "participants": [OWNER, MEMBER], "shares": {OWNER: 500, MEMBER: 500}, "deleted": False,
        })
        with pytest.raises(groups_svc.ConflictError):
            groups_svc.update_group(db, OWNER, gid, MERGE_ILS)


class TestConsolidateLeftovers:
    """A group already in merge mode that still holds a foreign expense (like Exli's $500 one)."""

    def test_converts_leftover_foreign_documents_and_rederives_balances(self, db):
        seed_fx_rates(db)
        gid = seed_group(db)  # merge, ILS
        db.collection("groups").document(gid).collection("expenses").document("usd").set({
            "description": "Australis", "amountMinor": 10000, "currency": "USD", "date": "2026-10-05", "paidBy": OWNER,
            "participants": [OWNER, MEMBER], "shares": {OWNER: 5000, MEMBER: 5000}, "deleted": False,
        })

        assert merge_svc.consolidate(db, OWNER, gid, "ILS") == {"converted": 1}

        doc = expense_docs(db, gid)["usd"]
        assert (doc["currency"], doc["amountMinor"]) == ("ILS", 34000)
        assert group_dict(db, gid)["balances"] == {OWNER: 17000, MEMBER: -17000}
        assert merge_svc.consolidate(db, OWNER, gid, "ILS") == {"converted": 0}   # idempotent

    def test_only_admins_and_only_for_the_groups_own_currency(self, db):
        seed_fx_rates(db)
        gid = seed_group(db)
        with pytest.raises(groups_svc.ForbiddenError):
            merge_svc.consolidate(db, MEMBER, gid, "ILS")
        with pytest.raises(groups_svc.ValidationError):
            merge_svc.consolidate(db, OWNER, gid, "USD")
