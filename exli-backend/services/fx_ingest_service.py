"""
FX (foreign exchange) daily ingestion - Phase 1 of docs/fx/01-fx-plan.md.

Fetches every supported currency's rate against USD from TwelveData (the
platform's single market-data source - see the plan's Decision A) and
stores everything pivoted through USD in Firestore:

  fxRates/{year}   { year, days: { "2025-08-20": { "ILS": 3.4013, ... } },
                     monthlyAvg: { "2025-08": { "ILS": 3.41, ... } },
                     updatedAt, source }
  fxRates/latest   { date, rates: { "ILS": 3.4013, ... } }
  _system/fxPairs  { "EUR": "inverted", "ILS": "direct", "XYZ": "unsupported" }

A currency is stored as "1 USD = n <currency>". Most pairs trade as
USD/<currency> on TwelveData, but a few (EUR, GBP, AUD, NZD, ...) only
trade the other way around, as <currency>/USD - this is detected once per
currency (try USD/X, fall back to X/USD and invert) and cached in
_system/fxPairs so every later run makes exactly one API call per currency
instead of probing twice.

Kept separate from routes/main.py, the same way services/ingest_helpers.py
split out the stock-ingestion decision logic, so all of this - direction
detection, the year-bucket merge, the monthly average, the staleness check
- is unit-testable against a fake Firestore client and a fake/mocked
provider, without Flask or the network (see tests/test_fx_ingest_service.py).
"""
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

from config import logger
from services.providers.market_data_provider import (
    ProviderNotFoundError,
    ProviderRateLimitError,
)

FX_PAIRS_DOC = ("_system", "fxPairs")
FX_RATES_COLLECTION = "fxRates"
LATEST_DOC_ID = "latest"

# How many days of history to (re)fetch on every run. Overlapping with
# previous runs is deliberate: if a run fails partway or TwelveData is a day
# late publishing a close, the next run's overlap fills the gap on its own -
# no per-currency "what's the last date we have" bookkeeping needed, unlike
# the much larger stock history in main.py's ingest loop.
DEFAULT_LOOKBACK_DAYS = 7

# A currency this stale is worth flagging - see check_staleness(). 4 business
# days is roughly a long weekend plus one missed run.
STALENESS_THRESHOLD_BUSINESS_DAYS = 4

# TwelveData's free tier allows 8 API credits/minute, and one currency fetch
# costs exactly 1 credit. With ~50 tracked currencies, a single unbatched run
# hits that wall every time (confirmed 2026-09-27, backfilling: it stopped
# after 9 calls). Pausing after every BATCH_SIZE real fetches keeps every run
# - the nightly job included - able to reach every currency instead of
# permanently stalling on whichever ones sort alphabetically first.
DEFAULT_BATCH_SIZE = 7
DEFAULT_BATCH_DELAY_SECONDS = 61


def usd_pivot_currencies(currency_pairs: List[Tuple[str, str]]) -> List[str]:
    """The set of currency codes to track, derived from symbol_lists.CURRENCY_PAIRS
    (every currency mentioned, base AND quote) plus USD itself. Per the plan,
    this existing list is the starting candidate set - whichever of these
    TwelveData actually has data for becomes the real supported set, recorded
    in _system/fxPairs.

    Both sides of each pair matter: CURRENCY_PAIRS is [(base, "ILS"), ...], so
    ILS is *only ever the quote currency* and would never be tracked at all
    if only bases were taken - which would mean fxRates never carries a rate
    for ILS itself, defeating the entire point of an app converting foreign
    amounts to shekels. (Caught in review 2026-09-26, before shipping.)
    """
    codes = set()
    for base, quote in currency_pairs:
        codes.add(base)
        codes.add(quote)
    codes.add("USD")
    return sorted(codes)


def _daterange(start: date, end: date) -> List[str]:
    days = (end - start).days
    return [(start + timedelta(days=i)).isoformat() for i in range(days + 1)]


def _load_pair_directions(db) -> Dict[str, str]:
    doc = db.collection(FX_PAIRS_DOC[0]).document(FX_PAIRS_DOC[1]).get()
    return doc.to_dict() if doc.exists else {}


def _save_pair_directions(db, newly_classified: Dict[str, str]):
    if not newly_classified:
        return
    ref = db.collection(FX_PAIRS_DOC[0]).document(FX_PAIRS_DOC[1])
    existing = ref.get()
    merged = dict(existing.to_dict()) if existing.exists else {}
    merged.update(newly_classified)
    ref.set(merged)


def _fetch_currency(provider, currency: str, direction: Optional[str], start_date: date, end_date: date):
    """Fetch one currency's rate history, pivoted to "1 USD = n currency".

    Returns (values, direction_used) where values is a list of (date_str, float)
    and direction_used is "direct" or "inverted" (whichever actually worked, so
    the caller can cache it). Raises ProviderNotFoundError if neither direction
    has data for this currency (i.e. TwelveData doesn't support it at all), or
    ProviderRateLimitError if the provider is throttling.
    """
    if direction in (None, "direct"):
        try:
            rates = provider.get_forex_rates("USD", currency, start_date, end_date)
            return [(r.date[:10], r.close) for r in rates if r.close], "direct"
        except ProviderNotFoundError:
            if direction == "direct":
                raise  # previously confirmed direct; a fresh 404 means it's now gone
    # direction is "inverted", or None and the direct attempt above 404'd
    rates = provider.get_forex_rates(currency, "USD", start_date, end_date)
    return [(r.date[:10], 1.0 / r.close) for r in rates if r.close], "inverted"


def run_fx_ingestion(
    db,
    provider,
    currencies: List[str],
    today: Optional[date] = None,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    batch_size: int = DEFAULT_BATCH_SIZE,
    batch_delay_seconds: int = DEFAULT_BATCH_DELAY_SECONDS,
    sleep_fn: Optional[callable] = None,
) -> dict:
    """Run one day's FX ingestion. Returns a summary dict for the caller to
    log/email/store: {success, unsupported, failed, rateLimited, newlyClassified}.

    Paces itself to stay under TwelveData's per-minute credit cap: sleep_fn is
    injectable so tests don't actually wait (see test_fx_ingest_service.py).
    Defaults to time.sleep, resolved at call time (not as a default-argument
    value) so patching services.fx_ingest_service.time.sleep in a test - e.g.
    one exercising the real /system/ingest-fx route - actually takes effect.
    """
    sleep_fn = sleep_fn or time.sleep
    today = today or date.today()
    start_date = today - timedelta(days=lookback_days)

    pair_directions = _load_pair_directions(db)
    newly_classified: Dict[str, str] = {}

    # year -> date -> currency -> value. Accumulated in memory across every
    # currency so each touched year doc is read and written exactly once,
    # regardless of how many currencies land in it.
    year_updates: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(lambda: defaultdict(dict))

    outcome = {"success": [], "unsupported": [], "failed": [], "rateLimited": False}

    # USD itself is always exactly 1.0 - no API call needed, but it's still
    # recorded so every lookup can treat USD like any other currency instead
    # of special-casing it.
    for d in _daterange(start_date, today):
        year_updates[d[:4]][d]["USD"] = 1.0
    outcome["success"].append("USD")

    calls_made = 0
    last_index = len(currencies) - 1
    for i, currency in enumerate(currencies):
        if currency == "USD":
            continue

        cached_direction = pair_directions.get(currency)
        if cached_direction == "unsupported":
            outcome["unsupported"].append(currency)
            continue

        try:
            values, direction_used = _fetch_currency(provider, currency, cached_direction, start_date, today)
            if cached_direction is None:
                newly_classified[currency] = direction_used
            for d, value in values:
                year_updates[d[:4]][d][currency] = value
            outcome["success"].append(currency)
        except ProviderNotFoundError:
            newly_classified[currency] = "unsupported"
            outcome["unsupported"].append(currency)
        except ProviderRateLimitError as e:
            logger.warning(f"TwelveData rate limit hit fetching FX for {currency}: {e}")
            outcome["rateLimited"] = True
            break
        except Exception as e:
            logger.warning(f"Failed to ingest FX for {currency}: {e}")
            outcome["failed"].append(currency)
        finally:
            calls_made += 1

        if calls_made % batch_size == 0 and i != last_index:
            sleep_fn(batch_delay_seconds)

    outcome["newlyClassified"] = newly_classified
    _save_pair_directions(db, newly_classified)
    _merge_year_updates(db, year_updates)
    _update_latest(db, year_updates)

    return outcome


def _merge_year_updates(db, year_updates: Dict[str, Dict[str, Dict[str, float]]]):
    for year, days_update in year_updates.items():
        ref = db.collection(FX_RATES_COLLECTION).document(year)
        existing = ref.get()
        doc = existing.to_dict() if existing.exists else {"year": int(year), "days": {}, "monthlyAvg": {}}
        doc.setdefault("days", {})
        doc.setdefault("monthlyAvg", {})

        months_touched = set()
        for day, currency_values in days_update.items():
            doc["days"].setdefault(day, {}).update(currency_values)
            months_touched.add(day[:7])

        for month in months_touched:
            doc["monthlyAvg"][month] = _compute_monthly_average(doc["days"], month)

        doc["updatedAt"] = datetime.utcnow().isoformat()
        doc["source"] = "TwelveData"
        ref.set(doc)


def _compute_monthly_average(days: Dict[str, Dict[str, float]], month: str) -> Dict[str, float]:
    """Average each currency's rate across every day on record for `month`
    (not just the days touched this run), so the average stays correct even
    when a month's data arrives across several runs."""
    sums: Dict[str, float] = defaultdict(float)
    counts: Dict[str, int] = defaultdict(int)
    for day, currency_values in days.items():
        if not day.startswith(month):
            continue
        for currency, value in currency_values.items():
            sums[currency] += value
            counts[currency] += 1
    return {currency: sums[currency] / counts[currency] for currency in sums}


def _update_latest(db, year_updates: Dict[str, Dict[str, Dict[str, float]]]):
    """Point fxRates/latest at the most recent date actually fetched this run
    that has real currency data, not just the USD=1.0 placeholder every date
    in the range gets up front - "today" is filled in with that placeholder
    before the market has published a close, so picking the calendar-max
    date unconditionally would leave `latest` unable to convert anything but
    USD until the following day's run. (Caught 2026-09-27, backfilling: the
    live fxRates/latest was stuck at today's date with only USD in `rates`.)

    Merges onto the currently-stored rates rather than replacing them, since
    a rate-limited run only ever touches a prefix of the full currency list
    (see DEFAULT_BATCH_SIZE) - overwriting wholesale would make `latest`
    forget every currency this particular run didn't reach, even though
    their most recent known rate is still one day stale, not missing.
    """
    real_dates = [
        d for days_update in year_updates.values()
        for d, currencies in days_update.items()
        if len(currencies) > 1
    ]
    if not real_dates:
        return
    latest_date = max(real_dates)
    latest_year = latest_date[:4]

    existing = db.collection(FX_RATES_COLLECTION).document(LATEST_DOC_ID).get()
    rates = dict(existing.to_dict().get("rates", {})) if existing.exists else {}
    rates.update(year_updates[latest_year][latest_date])

    db.collection(FX_RATES_COLLECTION).document(LATEST_DOC_ID).set({
        "date": latest_date,
        "rates": rates,
        "updatedAt": datetime.utcnow().isoformat(),
    })


def _count_business_days(start: date, end: date) -> int:
    """Weekdays strictly between start and end (exclusive of start)."""
    count = 0
    d = start
    while d < end:
        d += timedelta(days=1)
        if d.weekday() < 5:
            count += 1
    return count


def check_staleness(db, today: Optional[date] = None, threshold_business_days: int = STALENESS_THRESHOLD_BUSINESS_DAYS) -> Optional[str]:
    """Returns a warning message if fxRates/latest is stale, or None if it's
    fine (or there's no data yet to judge, e.g. before the first ever run).
    This is the alarm that would have caught the currencies-frozen-since-
    January bug from docs/fx/01-fx-plan.md §0.2 months earlier."""
    today = today or date.today()
    doc = db.collection(FX_RATES_COLLECTION).document(LATEST_DOC_ID).get()
    if not doc.exists:
        return None
    latest_date_str = doc.to_dict().get("date")
    if not latest_date_str:
        return None
    latest_date = datetime.fromisoformat(latest_date_str).date()
    stale_days = _count_business_days(latest_date, today)
    if stale_days > threshold_business_days:
        return (
            f"FX rates are stale: fxRates/latest is from {latest_date_str}, "
            f"{stale_days} business day(s) ago (threshold: {threshold_business_days})"
        )
    return None
