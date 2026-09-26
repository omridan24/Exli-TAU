"""
Tests for services/ingest_helpers.py - the pure decision logic behind the
2026-09-24 ingestion outage fix (docs/fx/01-fx-plan.md §0.1).

The bug: PR #38's smart rotation always puts never-ingested symbols first,
and several configured tickers permanently 404 on TwelveData. Every night,
6 of those in a row tripped the "assume we're rate-limited" breaker before
any real symbol got a chance - stocksSuccess and currenciesSuccess were 0
for three days straight. These tests pin the fixed behavior: a dead symbol
must never count toward the breaker, while a real rate-limit signal trips
it immediately.
"""
from services.ingest_helpers import (
    BREAKER_TRIP_THRESHOLD,
    RATE_LIMIT_BREAKER_WEIGHT,
    GENERIC_MISS_BREAKER_WEIGHT,
    breaker_tripped,
    classify_empty_result,
    classify_fetch_exception,
)
from services.providers.market_data_provider import (
    ProviderError,
    ProviderNotFoundError,
    ProviderRateLimitError,
)


class TestClassifyFetchException:
    def test_not_found_never_trips_the_breaker(self):
        outcome = classify_fetch_exception(ProviderNotFoundError("plan-gated"))
        assert outcome.kind == "not_found"
        assert outcome.breaker_delta == 0
        assert outcome.tombstone is True

    def test_rate_limit_trips_the_breaker_in_one_shot(self):
        outcome = classify_fetch_exception(ProviderRateLimitError("out of credits"))
        assert outcome.kind == "rate_limited"
        assert outcome.breaker_delta == RATE_LIMIT_BREAKER_WEIGHT
        assert outcome.breaker_delta >= BREAKER_TRIP_THRESHOLD
        assert outcome.tombstone is False

    def test_generic_provider_error_nudges_the_breaker(self):
        outcome = classify_fetch_exception(ProviderError("network blip"))
        assert outcome.kind == "error"
        assert outcome.breaker_delta == GENERIC_MISS_BREAKER_WEIGHT
        assert outcome.tombstone is False


class TestClassifyEmptyResult:
    def test_recent_data_is_a_free_skip(self):
        outcome = classify_empty_result(is_recent=True)
        assert outcome.breaker_delta == 0

    def test_stale_miss_nudges_the_breaker(self):
        outcome = classify_empty_result(is_recent=False)
        assert outcome.breaker_delta == GENERIC_MISS_BREAKER_WEIGHT


class TestBreakerSimulation:
    """Simulates the ingest loop's running counter to pin the exact scenario
    that broke production: dead symbols sorted first by smart rotation."""

    def _run(self, exceptions):
        counter = 0
        tripped_at = None
        for i, exc in enumerate(exceptions):
            outcome = classify_fetch_exception(exc)
            counter += outcome.breaker_delta
            if breaker_tripped(counter):
                tripped_at = i
                break
        return tripped_at

    def test_six_dead_symbols_in_a_row_never_trip_the_breaker(self):
        # This is exactly what smart rotation served up every night from
        # 2026-09-24: K, WBA, PXD, HES, CTRA, PEAK, all permanently 404.
        exceptions = [ProviderNotFoundError("dead")] * 20
        assert self._run(exceptions) is None

    def test_an_explicit_rate_limit_trips_immediately(self):
        exceptions = [ProviderRateLimitError("out of credits")]
        assert self._run(exceptions) == 0

    def test_six_consecutive_generic_misses_still_trips(self):
        # Unrelated to the bug, but the original "6 in a row" behavior for
        # ordinary transient misses must survive the refactor.
        exceptions = [ProviderError("blip")] * 6
        assert self._run(exceptions) == 5

    def test_dead_symbols_dont_mask_a_real_rate_limit_behind_them(self):
        exceptions = [ProviderNotFoundError("dead")] * 5 + [ProviderRateLimitError("out of credits")]
        assert self._run(exceptions) == 5
