"""Tests for services/expense_date_service.py (Analytics change date / move month)."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.fake_firestore import FakeClient
import services.expense_date_service as svc
from services.groups_service import ValidationError

UID = "u1"


@pytest.fixture
def db():
    return FakeClient()


def seed(db, eid, date="2026-09-15T00:00:00Z", month="2026-09", **extra):
    db.collection("users").document(UID).collection("expenses").document(eid).set(
        {"date": date, "reportMonth": month, "amount": 10, **extra}
    )


def get(db, eid):
    return db.collection("users").document(UID).collection("expenses").document(eid).get().to_dict()


class TestChangeDate:
    def test_same_month_changes_only_the_day(self, db):
        seed(db, "a")
        r = svc.change_dates(db, UID, ["a"], "2026-09-03")
        e = get(db, "a")
        assert e["date"] == "2026-09-03T00:00:00Z" and e["reportMonth"] == "2026-09"
        assert r["sameMonth"] == 1 and r["movedMonth"] == 0 and "movedFrom" not in e

    def test_cross_month_moves_the_expense(self, db):
        seed(db, "a")
        r = svc.change_dates(db, UID, ["a"], "2026-10-02")
        e = get(db, "a")
        assert e["date"] == "2026-10-02T00:00:00Z" and e["reportMonth"] == "2026-10"
        assert e["movedFrom"] == "2026-09"
        assert r["movedMonth"] == 1

    def test_bulk_mixed_months(self, db):
        seed(db, "a"); seed(db, "b", date="2026-10-20T00:00:00Z", month="2026-10"); seed(db, "c")
        r = svc.change_dates(db, UID, ["a", "b", "c"], "2026-10-05")
        assert r["movedMonth"] == 2 and r["sameMonth"] == 1 and sorted(r["updated"]) == ["a", "b", "c"]
        assert all(get(db, i)["reportMonth"] == "2026-10" and get(db, i)["date"].startswith("2026-10-05") for i in "abc")

    def test_plain_date_format_is_preserved(self, db):
        seed(db, "a", date="2026-09-15")
        svc.change_dates(db, UID, ["a"], "2026-10-01")
        assert get(db, "a")["date"] == "2026-10-01"

    @pytest.mark.parametrize("bad", [None, "", "nope", "2026-02-30", "2026-13-01", 5])
    def test_invalid_dates_rejected_and_nothing_written(self, db, bad):
        seed(db, "a")
        with pytest.raises(ValidationError):
            svc.change_dates(db, UID, ["a"], bad)
        assert get(db, "a")["date"] == "2026-09-15T00:00:00Z"

    def test_invalid_ids_rejected(self, db):
        with pytest.raises(ValidationError):
            svc.change_dates(db, UID, [], "2026-10-01")

    def test_shared_expense_is_blocked(self, db):
        seed(db, "a", groupRef={"groupId": "g1", "groupName": "G"}); seed(db, "b")
        r = svc.change_dates(db, UID, ["a", "b"], "2026-10-01")
        assert r["blockedShared"] == ["a"] and r["updated"] == ["b"]
        assert get(db, "a")["date"] == "2026-09-15T00:00:00Z" and get(db, "a")["reportMonth"] == "2026-09"

    def test_missing_expense_reported(self, db):
        assert svc.change_dates(db, UID, ["ghost"], "2026-10-01")["notFound"] == ["ghost"]

    def test_other_users_expenses_are_not_touched(self, db):
        seed(db, "a")
        r = svc.change_dates(db, "someone-else", ["a"], "2026-10-01")
        assert r["notFound"] == ["a"] and get(db, "a")["reportMonth"] == "2026-09"


class TestMoveMonth:
    def test_keeps_day_in_target_month(self, db):
        seed(db, "a", date="2026-09-15T00:00:00Z")
        svc.move_month(db, UID, ["a"], "2026-10")
        e = get(db, "a")
        assert e["date"] == "2026-10-15T00:00:00Z" and e["reportMonth"] == "2026-10" and e["movedFrom"] == "2026-09"

    def test_clamps_to_last_day_of_shorter_month(self, db):
        seed(db, "a", date="2026-10-31T00:00:00Z", month="2026-10")
        seed(db, "b", date="2026-01-30T00:00:00Z", month="2026-01")
        svc.move_month(db, UID, ["a"], "2026-11")
        svc.move_month(db, UID, ["b"], "2028-02")  # leap year
        assert get(db, "a")["date"] == "2026-11-30T00:00:00Z"
        assert get(db, "b")["date"] == "2028-02-29T00:00:00Z"

    def test_non_leap_february_clamp_and_year_boundary(self, db):
        seed(db, "a", date="2026-12-31T00:00:00Z", month="2026-12")
        svc.move_month(db, UID, ["a"], "2027-02")
        assert get(db, "a")["date"] == "2027-02-28T00:00:00Z"

    def test_invalid_month_rejected(self, db):
        seed(db, "a")
        for bad in (None, "2026-13", "2026-9", "x"):
            with pytest.raises(ValidationError):
                svc.move_month(db, UID, ["a"], bad)

    def test_shared_expense_is_blocked(self, db):
        seed(db, "a", groupRef={"groupId": "g1"})
        assert svc.move_month(db, UID, ["a"], "2026-10")["blockedShared"] == ["a"]
        assert get(db, "a")["reportMonth"] == "2026-09"

    def test_unparseable_date_uses_first_of_month(self, db):
        seed(db, "a", date=None)
        svc.move_month(db, UID, ["a"], "2026-10")
        assert get(db, "a")["date"] == "2026-10-01T00:00:00Z"


class TestMismatch:
    def test_detects_date_in_other_month(self):
        assert svc.month_mismatch({"date": "2026-10-03T00:00:00Z", "reportMonth": "2026-09"}) == ("2026-10", "2026-09")

    def test_consistent_or_unparseable_not_flagged(self):
        assert svc.month_mismatch({"date": "2026-09-03", "reportMonth": "2026-09"}) is None
        assert svc.month_mismatch({"date": None, "reportMonth": "2026-09"}) is None

    def test_assert_consistent_raises(self):
        with pytest.raises(ValidationError) as exc:
            svc.assert_consistent({"date": "2026-10-03", "reportMonth": "2026-09"})
        assert exc.value.code == "MONTH_MISMATCH"

    def test_fix_moves_to_the_dates_month_without_changing_the_date(self, db):
        seed(db, "a", date="2026-10-03T00:00:00Z", month="2026-09")
        r = svc.fix_mismatch(db, UID, ["a"])
        e = get(db, "a")
        assert e["reportMonth"] == "2026-10" and e["date"] == "2026-10-03T00:00:00Z" and r["movedMonth"] == 1
