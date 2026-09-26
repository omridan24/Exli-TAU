"""
Pure helper logic for the /system/ingest-market-data loop in main.py.

Kept free of Firestore/HTTP so the tricky part - deciding what a fetch failure
means for the rate-limit breaker and for dead-symbol tombstoning - can be unit
tested with a fake provider, without a live database or network.

Background (docs/fx/01-fx-plan.md §0.1): from 2026-09-24, every nightly run
died after ~67 seconds. PR #38's "smart rotation" always puts never-ingested
symbols first, and several configured tickers permanently 404 on TwelveData
(delisted/merged, or gated behind a higher plan tier than this API key has).
Those symbols were always first in line and always "never ingested", so 6 of
them in a row tripped the breaker before any real symbol got a chance - every
single night. The fix: a 404 means "this symbol will never work", which is a
fundamentally different signal from "the provider is rate-limited", and must
never be counted the same way.
"""
from dataclasses import dataclass

from services.providers.market_data_provider import (
    ProviderNotFoundError,
    ProviderRateLimitError,
)

# An explicit rate-limit signal is unambiguous, so it trips the breaker in one
# shot rather than waiting for several to accumulate.
RATE_LIMIT_BREAKER_WEIGHT = 6
GENERIC_MISS_BREAKER_WEIGHT = 1
BREAKER_TRIP_THRESHOLD = 6


@dataclass(frozen=True)
class FetchOutcome:
    """What a single symbol/pair fetch attempt means for the ingestion loop."""

    kind: str  # "success" | "not_found" | "rate_limited" | "miss" | "error"
    breaker_delta: int = 0
    tombstone: bool = False


def classify_fetch_exception(exc: Exception) -> FetchOutcome:
    """Map an exception raised by a provider call to an ingestion outcome."""
    if isinstance(exc, ProviderNotFoundError):
        # Permanent for this symbol - never counts toward the breaker, and the
        # caller should tombstone it so future runs don't retry it forever.
        return FetchOutcome(kind="not_found", breaker_delta=0, tombstone=True)
    if isinstance(exc, ProviderRateLimitError):
        return FetchOutcome(kind="rate_limited", breaker_delta=RATE_LIMIT_BREAKER_WEIGHT)
    return FetchOutcome(kind="error", breaker_delta=GENERIC_MISS_BREAKER_WEIGHT)


def classify_empty_result(is_recent: bool) -> FetchOutcome:
    """The provider call succeeded but returned no data points (e.g. the
    symbol legitimately has nothing new since its last close - a market
    holiday, or data already up to date). ``is_recent`` mirrors the existing
    "does this symbol already have data within the last few days" check in
    main.py, which is a good-enough signal that this is a benign gap rather
    than a struggling provider."""
    if is_recent:
        return FetchOutcome(kind="miss", breaker_delta=0)
    return FetchOutcome(kind="miss", breaker_delta=GENERIC_MISS_BREAKER_WEIGHT)


def breaker_tripped(counter: int) -> bool:
    return counter >= BREAKER_TRIP_THRESHOLD
