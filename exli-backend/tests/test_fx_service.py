"""
Unit tests for services/fx_service.py - the backend Firestore-reading wrapper
around fx_engine.convert() (docs/fx/01-fx-plan.md §5), using the in-memory
FakeClient the same way test_fx_ingest_service.py does.
"""
import pytest

from tests.fake_firestore import FakeClient
import services.fx_service as fx_service


@pytest.fixture
def db():
    client = FakeClient()
    client.collection("fxRates").document("2025").set({
        "year": 2025,
        "days": {"2025-08-20": {"ILS": 3.4013, "EUR": 0.8583}},
        "monthlyAvg": {"2025-08": {"ILS": 3.41, "EUR": 0.857}},
    })
    client.collection("fxRates").document("latest").set({
        "date": "2025-08-20",
        "rates": {"ILS": 3.4013, "EUR": 0.8583},
    })
    return client


class TestLoadTable:
    def test_loads_only_the_needed_year(self, db):
        table = fx_service.load_table(db, dates=["2025-08-20"])
        assert table["daily"]["2025-08-20"]["ILS"] == 3.4013
        assert table["monthlyAvg"]["2025-08"]["ILS"] == 3.41
        assert table["latest"]["date"] == "2025-08-20"

    def test_missing_year_returns_empty_daily(self, db):
        table = fx_service.load_table(db, dates=["2019-01-01"])
        assert table["daily"] == {}
        # latest is always loaded regardless of which years were requested
        assert table["latest"]["date"] == "2025-08-20"

    def test_no_dates_or_months_still_loads_latest(self, db):
        table = fx_service.load_table(db)
        assert table["daily"] == {}
        assert table["latest"]["date"] == "2025-08-20"


class TestConvertAmount:
    def test_day_rate_cross(self, db):
        result = fx_service.convert_amount(db, 100, "USD", "ILS", date_str="2025-08-20")
        assert result["value"] == pytest.approx(340.13)
        assert result["basis"] == "day"

    def test_unsupported_currency(self, db):
        result = fx_service.convert_amount(db, 100, "USD", "XYZ", date_str="2025-08-20")
        assert result["value"] is None
        assert result["reason"] == "unsupported"


class TestConvertMinor:
    def test_round_trips_minor_units(self, db):
        # $100.00 -> 10000 minor units, converts to ILS (2 minor units too)
        result = fx_service.convert_minor(db, 10000, "USD", "ILS", date_str="2025-08-20")
        assert result["amountMinor"] == round(340.13 * 100)

    def test_differing_minor_units_jpy(self, db):
        db.collection("fxRates").document("2025").set({
            "days": {"2025-08-20": {"ILS": 3.4013, "JPY": 147.6}},
            "monthlyAvg": {},
        })
        # 10000 minor units of ILS == ₪100.00 -> JPY has 0 minor units
        result = fx_service.convert_minor(db, 10000, "ILS", "JPY", date_str="2025-08-20")
        expected_major = 100.0 * (147.6 / 3.4013)
        assert result["amountMinor"] == round(expected_major)

    def test_unsupported_returns_none_amount_minor(self, db):
        result = fx_service.convert_minor(db, 10000, "USD", "XYZ", date_str="2025-08-20")
        assert result["amountMinor"] is None


class TestApplyRateMinor:
    def test_applies_known_rate_without_firestore(self):
        amount_minor = fx_service.apply_rate_minor(10000, "USD", "ILS", 3.4013)
        assert amount_minor == round(100 * 3.4013 * 100)

    def test_identity_rate(self):
        assert fx_service.apply_rate_minor(500, "ILS", "ILS", 1.0) == 500
