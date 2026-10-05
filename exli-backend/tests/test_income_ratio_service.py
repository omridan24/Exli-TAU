"""
Unit tests for services/income_ratio_service.py (plan §3.7 / Debate Q), using the
same FakeClient as the groups service tests.
"""
import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.fake_firestore import FakeClient
import services.income_ratio_service as svc


@pytest.fixture
def db():
    return FakeClient()


def set_income(db, uid, month, neto):
    db.collection("users").document(uid).collection("income").add({"month": month, "neto": neto})


def make_group(members):
    return {"members": {uid: {"status": "active"} for uid in members}}


class TestIncomeMonthKey:
    def test_regular_month_is_the_same_month(self):
        assert svc.income_month_key(date(2026, 10, 5)) == "2026-10"
        assert svc.income_month_key(date(2026, 9, 30)) == "2026-09"

    def test_january_uses_same_year_january(self):
        assert svc.income_month_key(date(2026, 1, 15)) == "2026-01"


class TestGetIncomeRatios:
    def test_ready_with_equal_incomes_splits_evenly(self, db):
        set_income(db, "a", "2026-10", 10000)
        set_income(db, "b", "2026-10", 10000)
        group = make_group(["a", "b"])

        result = svc.get_income_ratios(db, group, date(2026, 10, 5))

        assert result["ready"] is True
        assert result["month"] == "2026-10"
        assert result["ratios"] == {"a": 50, "b": 50}
        assert sum(result["ratios"].values()) == 100

    def test_ready_with_uneven_incomes(self, db):
        set_income(db, "a", "2026-10", 15000)
        set_income(db, "b", "2026-10", 5000)
        group = make_group(["a", "b"])

        result = svc.get_income_ratios(db, group, date(2026, 10, 1))

        assert result["ratios"] == {"a": 75, "b": 25}

    def test_sums_multiple_income_docs_in_same_month(self, db):
        set_income(db, "a", "2026-10", 8000)
        set_income(db, "a", "2026-10", 2000)  # a second job
        set_income(db, "b", "2026-10", 10000)
        group = make_group(["a", "b"])

        result = svc.get_income_ratios(db, group, date(2026, 10, 1))

        assert result["ratios"] == {"a": 50, "b": 50}

    def test_missing_income_for_one_member_blocks_readiness(self, db):
        set_income(db, "a", "2026-10", 10000)
        # "b" never filled in October income
        group = make_group(["a", "b"])

        result = svc.get_income_ratios(db, group, date(2026, 10, 5))

        assert result["ready"] is False
        assert result["missing"] == ["b"]
        assert result["ratios"] is None

    def test_zero_income_counts_as_missing(self, db):
        set_income(db, "a", "2026-10", 10000)
        set_income(db, "b", "2026-10", 0)
        group = make_group(["a", "b"])

        result = svc.get_income_ratios(db, group, date(2026, 10, 5))

        assert result["ready"] is False
        assert "b" in result["missing"]

    def test_only_active_members_are_considered(self, db):
        set_income(db, "a", "2026-10", 10000)
        group = {"members": {
            "a": {"status": "active"},
            "b": {"status": "removed"},  # no income needed — not active
        }}

        result = svc.get_income_ratios(db, group, date(2026, 10, 5))

        assert result["ready"] is True
        assert result["ratios"] == {"a": 100}

    def test_adapts_month_to_month(self, db):
        # September: a=15000, b=5000 -> 75/25. October: a=16000, b=4000 -> 80/20.
        set_income(db, "a", "2026-09", 15000)
        set_income(db, "b", "2026-09", 5000)
        set_income(db, "a", "2026-10", 16000)
        set_income(db, "b", "2026-10", 4000)
        group = make_group(["a", "b"])

        sept_expense = svc.get_income_ratios(db, group, date(2026, 9, 15))
        october_expense = svc.get_income_ratios(db, group, date(2026, 10, 2))

        assert sept_expense["month"] == "2026-09"
        assert sept_expense["ratios"] == {"a": 75, "b": 25}
        assert october_expense["month"] == "2026-10"
        assert october_expense["ratios"] == {"a": 80, "b": 20}

    def test_january_uses_same_year_january_not_previous_december(self, db):
        set_income(db, "a", "2025-12", 15000)
        set_income(db, "b", "2025-12", 5000)
        set_income(db, "a", "2026-01", 10000)
        set_income(db, "b", "2026-01", 10000)
        group = make_group(["a", "b"])

        result = svc.get_income_ratios(db, group, date(2026, 1, 10))

        assert result["month"] == "2026-01"
        assert result["ratios"] == {"a": 50, "b": 50}

    def test_previous_month_income_alone_is_not_enough(self, db):
        set_income(db, "a", "2026-09", 15000)
        set_income(db, "b", "2026-09", 5000)
        group = make_group(["a", "b"])

        result = svc.get_income_ratios(db, group, date(2026, 10, 5))

        assert result["ready"] is False
        assert result["month"] == "2026-10"
        assert result["missing"] == ["a", "b"]

    def test_percent_rounding_sums_to_exactly_100_with_three_people(self, db):
        set_income(db, "a", "2026-10", 10000)
        set_income(db, "b", "2026-10", 10000)
        set_income(db, "c", "2026-10", 10000)
        group = make_group(["a", "b", "c"])

        result = svc.get_income_ratios(db, group, date(2026, 10, 5))

        assert sum(result["ratios"].values()) == 100
