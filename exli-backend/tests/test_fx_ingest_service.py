"""
Tests for services/fx_ingest_service.py - Phase 1 of docs/fx/01-fx-plan.md.

Uses the in-memory FakeClient (tests/fake_firestore.py) instead of a live
Firestore, and a small fake provider instead of real TwelveData calls, so
these run instantly and offline.
"""
from datetime import date

import pytest

from services.fx_ingest_service import (
    STALENESS_THRESHOLD_BUSINESS_DAYS,
    check_staleness,
    run_fx_ingestion,
    usd_pivot_currencies,
)
from services.providers.market_data_provider import (
    ForexRate,
    ProviderNotFoundError,
    ProviderRateLimitError,
)
from tests.fake_firestore import FakeClient


class FakeFxProvider:
    """Returns canned ForexRate lists or raises, keyed by (base, quote)."""

    def __init__(self, responses):
        self.responses = responses  # {(base, quote): list[ForexRate] | Exception}
        self.calls = []

    def get_forex_rates(self, base, quote, start_date, end_date):
        self.calls.append((base, quote))
        result = self.responses.get((base, quote), [])
        if isinstance(result, Exception):
            raise result
        return result


def _rate(d, close):
    return ForexRate(date=d, open=close, high=close, low=close, close=close)


@pytest.fixture
def db():
    return FakeClient()


class TestDirectionDetection:
    def test_first_time_direct_pair_succeeds_and_is_cached(self, db):
        provider = FakeFxProvider({("USD", "ILS"): [_rate("2025-08-20", 3.4)]})
        outcome = run_fx_ingestion(db, provider, ["ILS"], today=date(2025, 8, 20), lookback_days=0)

        assert "ILS" in outcome["success"]
        assert outcome["newlyClassified"]["ILS"] == "direct"
        assert provider.calls == [("USD", "ILS")]

        year_doc = db.collection("fxRates").document("2025").get().to_dict()
        assert year_doc["days"]["2025-08-20"]["ILS"] == 3.4

    def test_direct_404_falls_back_to_inverted_and_inverts_the_value(self, db):
        provider = FakeFxProvider({
            ("USD", "EUR"): ProviderNotFoundError("no such pair"),
            ("EUR", "USD"): [_rate("2025-08-20", 0.85)],
        })
        outcome = run_fx_ingestion(db, provider, ["EUR"], today=date(2025, 8, 20), lookback_days=0)

        assert "EUR" in outcome["success"]
        assert outcome["newlyClassified"]["EUR"] == "inverted"
        assert provider.calls == [("USD", "EUR"), ("EUR", "USD")]

        year_doc = db.collection("fxRates").document("2025").get().to_dict()
        assert year_doc["days"]["2025-08-20"]["EUR"] == pytest.approx(1 / 0.85)

    def test_both_directions_404_marks_unsupported_not_failed(self, db):
        provider = FakeFxProvider({
            ("USD", "ZZZ"): ProviderNotFoundError("no such pair"),
            ("ZZZ", "USD"): ProviderNotFoundError("no such pair"),
        })
        outcome = run_fx_ingestion(db, provider, ["ZZZ"], today=date(2025, 8, 20), lookback_days=0)

        assert "ZZZ" in outcome["unsupported"]
        assert "ZZZ" not in outcome["failed"]
        assert outcome["newlyClassified"]["ZZZ"] == "unsupported"

    def test_previously_unsupported_currency_is_skipped_with_no_api_call(self, db):
        db.collection("_system").document("fxPairs").set({"ZZZ": "unsupported"})
        provider = FakeFxProvider({})
        outcome = run_fx_ingestion(db, provider, ["ZZZ"], today=date(2025, 8, 20), lookback_days=0)

        assert "ZZZ" in outcome["unsupported"]
        assert provider.calls == []

    def test_cached_direct_makes_exactly_one_call_no_probing(self, db):
        db.collection("_system").document("fxPairs").set({"ILS": "direct"})
        provider = FakeFxProvider({("USD", "ILS"): [_rate("2025-08-20", 3.41)]})
        outcome = run_fx_ingestion(db, provider, ["ILS"], today=date(2025, 8, 20), lookback_days=0)

        assert provider.calls == [("USD", "ILS")]
        assert "ILS" not in outcome["newlyClassified"]

    def test_cached_inverted_makes_exactly_one_call_no_probing(self, db):
        db.collection("_system").document("fxPairs").set({"EUR": "inverted"})
        provider = FakeFxProvider({("EUR", "USD"): [_rate("2025-08-20", 0.86)]})
        outcome = run_fx_ingestion(db, provider, ["EUR"], today=date(2025, 8, 20), lookback_days=0)

        assert provider.calls == [("EUR", "USD")]
        year_doc = db.collection("fxRates").document("2025").get().to_dict()
        assert year_doc["days"]["2025-08-20"]["EUR"] == pytest.approx(1 / 0.86)

    def test_a_previously_direct_pair_that_starts_404ing_is_reclassified(self, db):
        db.collection("_system").document("fxPairs").set({"ILS": "direct"})
        provider = FakeFxProvider({("USD", "ILS"): ProviderNotFoundError("gone")})
        outcome = run_fx_ingestion(db, provider, ["ILS"], today=date(2025, 8, 20), lookback_days=0)

        assert "ILS" in outcome["unsupported"]
        assert outcome["newlyClassified"]["ILS"] == "unsupported"


class TestUsdIsAlwaysIncluded:
    def test_usd_gets_rate_1_for_every_day_with_no_api_call(self, db):
        provider = FakeFxProvider({})
        outcome = run_fx_ingestion(db, provider, ["USD"], today=date(2025, 8, 20), lookback_days=2)

        assert "USD" in outcome["success"]
        assert provider.calls == []
        year_doc = db.collection("fxRates").document("2025").get().to_dict()
        for d in ("2025-08-18", "2025-08-19", "2025-08-20"):
            assert year_doc["days"][d]["USD"] == 1.0


class TestRateLimit:
    def test_rate_limit_stops_processing_remaining_currencies(self, db):
        provider = FakeFxProvider({
            ("USD", "ILS"): [_rate("2025-08-20", 3.4)],
            ("USD", "EUR"): ProviderRateLimitError("out of credits"),
        })
        outcome = run_fx_ingestion(db, provider, ["ILS", "EUR", "GBP"], today=date(2025, 8, 20), lookback_days=0)

        assert outcome["rateLimited"] is True
        assert "ILS" in outcome["success"]
        assert "EUR" not in outcome["success"]
        assert "GBP" not in outcome["success"] and "GBP" not in outcome["unsupported"]
        # GBP was never even attempted once the breaker tripped.
        assert ("USD", "GBP") not in provider.calls


class TestYearBucketMerging:
    def test_merging_a_new_currency_preserves_other_currencies_already_on_that_day(self, db):
        db.collection("fxRates").document("2025").set({
            "year": 2025,
            "days": {"2025-08-20": {"ILS": 3.4}},
            "monthlyAvg": {},
        })
        provider = FakeFxProvider({("USD", "EUR"): [_rate("2025-08-20", 0.86)]})
        run_fx_ingestion(db, provider, ["EUR"], today=date(2025, 8, 20), lookback_days=0)

        year_doc = db.collection("fxRates").document("2025").get().to_dict()
        assert year_doc["days"]["2025-08-20"]["ILS"] == 3.4  # untouched
        assert year_doc["days"]["2025-08-20"]["EUR"] == 0.86  # added

    def test_monthly_average_covers_the_whole_month_not_just_todays_fetch(self, db):
        db.collection("fxRates").document("2025").set({
            "year": 2025,
            "days": {
                "2025-08-01": {"ILS": 3.3},
                "2025-08-02": {"ILS": 3.5},
            },
            "monthlyAvg": {},
        })
        provider = FakeFxProvider({("USD", "ILS"): [_rate("2025-08-03", 3.4)]})
        run_fx_ingestion(db, provider, ["ILS"], today=date(2025, 8, 3), lookback_days=0)

        year_doc = db.collection("fxRates").document("2025").get().to_dict()
        assert year_doc["monthlyAvg"]["2025-08"]["ILS"] == pytest.approx((3.3 + 3.5 + 3.4) / 3)

    def test_dates_spanning_a_year_boundary_land_in_two_year_docs(self, db):
        provider = FakeFxProvider({
            ("USD", "ILS"): [_rate("2024-12-31", 3.6), _rate("2025-01-01", 3.65)],
        })
        run_fx_ingestion(db, provider, ["ILS"], today=date(2025, 1, 1), lookback_days=1)

        doc_2024 = db.collection("fxRates").document("2024").get().to_dict()
        doc_2025 = db.collection("fxRates").document("2025").get().to_dict()
        assert doc_2024["days"]["2024-12-31"]["ILS"] == 3.6
        assert doc_2025["days"]["2025-01-01"]["ILS"] == 3.65


class TestLatestPointer:
    def test_latest_points_at_the_most_recent_date_fetched(self, db):
        provider = FakeFxProvider({
            ("USD", "ILS"): [_rate("2025-08-19", 3.39), _rate("2025-08-20", 3.4)],
        })
        run_fx_ingestion(db, provider, ["ILS"], today=date(2025, 8, 20), lookback_days=1)

        latest = db.collection("fxRates").document("latest").get().to_dict()
        assert latest["date"] == "2025-08-20"
        assert latest["rates"]["ILS"] == 3.4

    def test_latest_skips_todays_date_when_todays_close_isnt_published_yet(self, db):
        # Every date in the lookback range gets a USD=1.0 placeholder up
        # front, including "today" - but the provider here has no ILS value
        # for today yet (market hasn't closed). `latest` must not point at
        # today with only USD in `rates`; it should fall back to the last
        # date that actually has a real currency rate.
        provider = FakeFxProvider({
            ("USD", "ILS"): [_rate("2025-08-19", 3.39)],
        })
        run_fx_ingestion(db, provider, ["ILS"], today=date(2025, 8, 20), lookback_days=1)

        latest = db.collection("fxRates").document("latest").get().to_dict()
        assert latest["date"] == "2025-08-19"
        assert latest["rates"]["ILS"] == 3.39


    def test_latest_merges_onto_previously_stored_rates_instead_of_replacing_them(self, db):
        # Simulates a rate-limited run that only reaches a prefix of the
        # currency list: a prior run already recorded ILS in `latest`, and
        # this run only touches EUR. EUR should be added, not wipe out ILS.
        db.collection("fxRates").document("latest").set({
            "date": "2025-08-19",
            "rates": {"USD": 1.0, "ILS": 3.39},
        })
        provider = FakeFxProvider({("USD", "EUR"): [_rate("2025-08-20", 0.86)]})
        run_fx_ingestion(db, provider, ["EUR"], today=date(2025, 8, 20), lookback_days=0)

        latest = db.collection("fxRates").document("latest").get().to_dict()
        assert latest["date"] == "2025-08-20"
        assert latest["rates"]["EUR"] == 0.86
        assert latest["rates"]["ILS"] == 3.39  # carried over, not lost


class TestRateLimitPacing:
    def test_pauses_after_every_batch_size_real_fetches_but_not_after_the_last(self, db):
        currencies = ["ILS", "EUR", "GBP", "AUD", "CAD"]
        provider = FakeFxProvider({
            (base, quote): [_rate("2025-08-20", 1.0)]
            for base, quote in [("USD", c) for c in currencies]
        })
        sleeps = []
        run_fx_ingestion(
            db, provider, currencies, today=date(2025, 8, 20), lookback_days=0,
            batch_size=2, batch_delay_seconds=61, sleep_fn=sleeps.append,
        )

        # 5 real fetches, batch_size=2 -> pauses after the 2nd and 4th, none after the 5th.
        assert sleeps == [61, 61]

    def test_cached_unsupported_currencies_dont_count_toward_the_batch(self, db):
        db.collection("_system").document("fxPairs").set({"ZZZ": "unsupported", "YYY": "unsupported"})
        provider = FakeFxProvider({("USD", "ILS"): [_rate("2025-08-20", 3.4)]})
        sleeps = []
        run_fx_ingestion(
            db, provider, ["ZZZ", "YYY", "ILS"], today=date(2025, 8, 20), lookback_days=0,
            batch_size=1, batch_delay_seconds=61, sleep_fn=sleeps.append,
        )

        # Only ILS ever reaches the provider; being the sole (and last) real
        # fetch, it must not trigger a trailing pause.
        assert sleeps == []

    def test_no_pause_when_the_very_fetch_that_hits_the_batch_boundary_rate_limits(self, db):
        provider = FakeFxProvider({("USD", "ILS"): ProviderRateLimitError("out of credits")})
        sleeps = []
        run_fx_ingestion(
            db, provider, ["ILS", "EUR", "GBP"], today=date(2025, 8, 20), lookback_days=0,
            batch_size=1, batch_delay_seconds=61, sleep_fn=sleeps.append,
        )

        # The very first fetch both lands on the batch_size=1 boundary and
        # trips the breaker - the break must skip the pause, not queue a
        # pointless 61s wait right before giving up for the run.
        assert sleeps == []


class TestStalenessCheck:
    def test_no_data_yet_is_not_flagged_as_stale(self, db):
        assert check_staleness(db, today=date(2025, 8, 20)) is None

    def test_fresh_data_is_not_stale(self, db):
        db.collection("fxRates").document("latest").set({"date": "2025-08-20"})
        assert check_staleness(db, today=date(2025, 8, 20)) is None

    def test_data_past_the_threshold_is_flagged(self, db):
        db.collection("fxRates").document("latest").set({"date": "2025-01-31"})
        message = check_staleness(db, today=date(2025, 2, 10))
        assert message is not None
        assert "2025-01-31" in message

    def test_exactly_at_the_threshold_is_not_yet_stale(self, db):
        db.collection("fxRates").document("latest").set({"date": "2025-08-14"})  # Thu
        # 2025-08-20 is a Wednesday; business days between: 15(Fri),18,19,20 = 4
        assert check_staleness(db, today=date(2025, 8, 20), threshold_business_days=STALENESS_THRESHOLD_BUSINESS_DAYS) is None


class TestUsdPivotCurrencies:
    def test_derives_codes_from_both_sides_of_every_pair_plus_usd(self):
        # ILS is only ever the QUOTE currency in symbol_lists.CURRENCY_PAIRS
        # (every pair is (base, "ILS")) - it must still end up tracked, or
        # fxRates would never carry a rate for ILS itself.
        codes = usd_pivot_currencies([("EUR", "ILS"), ("GBP", "ILS")])
        assert codes == ["EUR", "GBP", "ILS", "USD"]

    def test_deduplicates_and_sorts(self):
        codes = usd_pivot_currencies([("USD", "ILS"), ("EUR", "ILS"), ("EUR", "USD")])
        assert codes == ["EUR", "ILS", "USD"]
