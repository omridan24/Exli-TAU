"""Unit tests for services/group_settlements_service.py (same FakeClient approach as the expenses tests)."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.fake_firestore import FakeClient
from tests.test_group_expenses_service import (
    OWNER, MEMBER, STRANGER, make_member, seed_group, group_dict, basic_kwargs, seed_fx_rates,
)
import services.group_expenses_service as expenses_svc
import services.group_settlements_service as svc
import services.groups_service as groups_svc

THIRD = "third-uid"


@pytest.fixture
def db():
    return FakeClient()


def settlements(db, gid):
    docs = db.collection("groups").document(gid).collection("settlements").stream()
    return [d.to_dict() for d in docs]


def owed_group(db, **overrides):
    """OWNER paid 100.00 split equally: MEMBER owes OWNER 50.00."""
    gid = seed_group(db, **overrides)
    expenses_svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000))
    return gid


def three_person_group(db):
    return seed_group(
        db, memberIds=[OWNER, MEMBER, THIRD],
        members={OWNER: make_member("admin"), MEMBER: make_member(), THIRD: make_member()},
        balances={OWNER: 5000, MEMBER: -5000, THIRD: 0},
    )


class TestRecordSettlement:
    def test_full_payment_zeroes_the_balances(self, db):
        gid = owed_group(db)
        svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=5000, method="bit")

        assert group_dict(db, gid)["balances"] == {OWNER: 0, MEMBER: 0}
        [s] = settlements(db, gid)
        assert (s["from"], s["to"], s["amountMinor"], s["method"], s["currency"]) == (MEMBER, OWNER, 5000, "bit", "ILS")

    def test_partial_payment_leaves_the_rest(self, db):
        gid = owed_group(db)
        svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=2000)
        assert group_dict(db, gid)["balances"] == {OWNER: 3000, MEMBER: -3000}

    def test_more_than_owed_is_rejected(self, db):
        gid = owed_group(db)
        with pytest.raises(groups_svc.ConflictError):
            svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=5001)

    def test_paying_someone_you_do_not_owe_is_rejected(self, db):
        gid = owed_group(db)
        with pytest.raises(groups_svc.ConflictError):
            svc.record_settlement(db, OWNER, gid, from_uid=OWNER, to_uid=MEMBER, amount_minor=100)

    def test_a_bystander_cannot_record_it_but_the_receiver_can(self, db):
        gid = three_person_group(db)
        with pytest.raises(groups_svc.ForbiddenError):
            svc.record_settlement(db, THIRD, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=100)
        with pytest.raises(groups_svc.ForbiddenError):
            svc.record_settlement(db, STRANGER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=100)
        svc.record_settlement(db, OWNER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=100)  # receiver confirms

    def test_invalid_amount_or_people(self, db):
        gid = owed_group(db)
        for amount in (0, -5, 1.5, True):
            with pytest.raises(groups_svc.ValidationError):
                svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=amount)
        with pytest.raises(groups_svc.ValidationError):
            svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=MEMBER, amount_minor=100)

    def test_is_logged_to_activity(self, db):
        gid = owed_group(db)
        svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=5000)
        types = [d.to_dict()["type"] for d in db.collection("groups").document(gid).collection("activity").stream()]
        assert "SETTLEMENT_RECORDED" in types


class TestKeepOriginalSettlement:
    def test_settles_the_matching_currency_bucket_only(self, db):
        seed_fx_rates(db)
        gid = seed_group(db, currencySettings={"mode": "keep_original", "mergeCurrency": None})
        expenses_svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=10000, currency="USD", date_str="2026-10-05"))
        expenses_svc.create_expense(db, OWNER, gid, **basic_kwargs(amount_minor=4000, currency="EUR", date_str="2026-10-05"))

        svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=5000, currency="USD")

        by_currency = group_dict(db, gid)["balancesByCurrency"]
        assert by_currency["USD"] == {OWNER: 0, MEMBER: 0}
        assert by_currency["EUR"] == {OWNER: 2000, MEMBER: -2000}

    def test_currency_is_required_and_must_have_a_balance(self, db):
        gid = seed_group(db, currencySettings={"mode": "keep_original", "mergeCurrency": None})
        with pytest.raises(groups_svc.ValidationError):
            svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=100)
        with pytest.raises(groups_svc.ValidationError):
            svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=100, currency="USD")


class TestDeleteSettlement:
    def test_undo_restores_the_balances(self, db):
        gid = owed_group(db)
        sid = svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=5000)

        svc.delete_settlement(db, MEMBER, gid, sid)

        assert group_dict(db, gid)["balances"] == {OWNER: 5000, MEMBER: -5000}
        assert settlements(db, gid)[0]["deleted"] is True

    def test_cannot_undo_twice_and_others_cannot_undo(self, db):
        gid = three_person_group(db)
        sid = svc.record_settlement(db, MEMBER, gid, from_uid=MEMBER, to_uid=OWNER, amount_minor=1000)
        with pytest.raises(groups_svc.ForbiddenError):
            svc.delete_settlement(db, THIRD, gid, sid)
        svc.delete_settlement(db, OWNER, gid, sid)  # an admin can
        with pytest.raises(groups_svc.NotFoundError):
            svc.delete_settlement(db, OWNER, gid, sid)


class TestPaymentHandles:
    def test_stores_clean_handles_on_the_member(self, db):
        gid = seed_group(db)
        result = svc.set_payment_handles(db, MEMBER, gid, {"phone": "050-123 4567", "venmo": "@dana-k", "paypal": ""})
        assert result == {"phone": "050-123 4567", "venmo": "dana-k"}
        assert group_dict(db, gid)["members"][MEMBER]["paymentHandles"] == result

    def test_rejects_junk_and_non_members(self, db):
        gid = seed_group(db)
        with pytest.raises(groups_svc.ValidationError):
            svc.set_payment_handles(db, MEMBER, gid, {"phone": "abc"})
        with pytest.raises(groups_svc.ValidationError):
            svc.set_payment_handles(db, MEMBER, gid, {"venmo": "a b/c"})
        with pytest.raises(groups_svc.ForbiddenError):
            svc.set_payment_handles(db, STRANGER, gid, {"phone": "0501234567"})
