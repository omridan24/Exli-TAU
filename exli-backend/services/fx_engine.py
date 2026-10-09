"""
The FX conversion engine - docs/fx/01-fx-plan.md §3.

Pure, stateless, no I/O: given an amount/currencies/date (or month) and a
`table` of already-loaded rates, returns the converted value plus enough
detail (which rate, from which date, whether it's an approximation) for the
UI to explain itself. Never rounds - that's left to the caller (display, or
committing a record/ledger amount).

Checked against shared docs/fx/fx-test-vectors.json (the same fixtures
src/lib/fx/fxEngine.js runs against - `npm run verify:fx-vectors` in
exli-front), the same pattern Groups uses for split_engine.py, so the two
implementations can't silently drift apart.

`table` shape (assembled by the caller - fx_ingest_service's Firestore
layout, or a test fixture):
    {
      "daily": { "2025-08-20": {"ILS": 3.4013, "EUR": 0.86, ...}, ... },
      "monthlyAvg": { "2025-08": {"ILS": 3.41, ...}, ... },
      "latest": { "date": "2025-08-20", "rates": {"ILS": 3.4013, ...} } | None
    }
Every inner map is "1 USD = n <currency>" (see fx_ingest_service.py).
"""
from dataclasses import dataclass
from datetime import date as date_cls, timedelta
from typing import Dict, Optional, Union

MAX_LOOKBACK_DAYS = 7


class FxError(ValueError):
    """Invalid input to convert() - missing amount/from/to. Not raised for a
    currency we simply don't have rates for; that's a normal, expected
    outcome returned as data (reason="unsupported"), never an exception."""


@dataclass
class ConversionResult:
    value: Optional[float]
    rate: Optional[float]
    rateDate: Optional[str]
    basis: Optional[str]  # "day" | "monthlyAvg" | "latest" | None
    approximate: bool
    reason: Optional[str] = None

    def as_dict(self) -> dict:
        d = {
            "value": self.value,
            "rate": self.rate,
            "rateDate": self.rateDate,
            "basis": self.basis,
            "approximate": self.approximate,
        }
        if self.reason is not None:
            d["reason"] = self.reason
        return d


def _rate_of(rates_map: Optional[Dict[str, float]], currency: str) -> Optional[float]:
    """USD is implicitly 1.0 even if a hand-built table omits it explicitly -
    real ingested data always includes it (fx_ingest_service.py), but test
    fixtures and callers shouldn't have to repeat it everywhere."""
    if rates_map is None:
        return None
    if currency == "USD":
        return rates_map.get("USD", 1.0)
    return rates_map.get(currency)


def _cross(rates_map: Dict[str, float], from_currency: str, to_currency: str) -> Optional[float]:
    usd_from = _rate_of(rates_map, from_currency)
    usd_to = _rate_of(rates_map, to_currency)
    if usd_from is None or usd_to is None:
        return None
    return usd_to / usd_from


def _shift(date_str: str, days: int) -> Optional[str]:
    """Returns None (never raises) for a malformed date_str - mirrors
    fxEngine.js's shiftDate, which has the same guard for the same reason:
    a caller passing a full ISO datetime string instead of a plain
    'YYYY-MM-DD' would otherwise raise ValueError here and 500 the request."""
    try:
        d = date_cls.fromisoformat(date_str) - timedelta(days=days)
    except ValueError:
        return None
    return d.isoformat()


def _find_day_rate(daily: Dict[str, Dict[str, float]], date_str: str, from_currency: str, to_currency: str):
    """Rule 2: the exact date, else the previous available day up to
    MAX_LOOKBACK_DAYS back. Returns (rate, actual_date, approximate) or None."""
    for offset in range(0, MAX_LOOKBACK_DAYS + 1):
        candidate = date_str if offset == 0 else _shift(date_str, offset)
        if candidate is None:
            continue
        rate = _cross(daily.get(candidate, {}), from_currency, to_currency)
        if rate is not None:
            return rate, candidate, offset > 0
    return None


def convert(params: dict, table: dict) -> dict:
    """
    params: { amount, from, to, date? , month? }
      - amount: number
      - from, to: ISO currency codes
      - date: "YYYY-MM-DD" (optional)
      - month: "YYYY-MM" (optional, used only when date is absent)
    table: see module docstring.

    Returns a plain dict (ConversionResult.as_dict()) - never raises for a
    currency/date combination we don't have data for; only raises FxError
    for genuinely malformed input.
    """
    amount = params.get("amount")
    from_currency = params.get("from")
    to_currency = params.get("to")

    if amount is None or not isinstance(amount, (int, float)):
        raise FxError("convert() requires a numeric 'amount'")
    if not from_currency or not to_currency:
        raise FxError("convert() requires 'from' and 'to' currency codes")

    # Rule 1: identity conversion needs no lookup at all.
    if from_currency == to_currency:
        return ConversionResult(
            value=amount, rate=1.0, rateDate=None, basis=None, approximate=False
        ).as_dict()

    table = table or {}
    daily = table.get("daily") or {}
    monthly_avg = table.get("monthlyAvg") or {}
    latest = table.get("latest")

    date_str = params.get("date")
    month_str = params.get("month")

    rate = rate_date = basis = None
    approximate = False

    if date_str:
        found = _find_day_rate(daily, date_str, from_currency, to_currency)
        if found:
            rate, rate_date, approximate = found
            basis = "day"
    elif month_str:
        rate = _cross(monthly_avg.get(month_str, {}), from_currency, to_currency)
        if rate is not None:
            rate_date, basis, approximate = month_str, "monthlyAvg", False

    # Rule 4 (generalized): whenever the primary lookup above didn't resolve
    # a rate - including when neither date nor month was given at all - fall
    # back to the latest known rate, marked approximate.
    if rate is None and latest:
        rate = _cross(latest.get("rates", {}), from_currency, to_currency)
        if rate is not None:
            rate_date, basis, approximate = latest.get("date"), "latest", True

    if rate is None:
        # Rule 6: no rate anywhere - never silently summed by the caller.
        return ConversionResult(
            value=None, rate=None, rateDate=None, basis=None,
            approximate=False, reason="unsupported"
        ).as_dict()

    return ConversionResult(
        value=amount * rate, rate=rate, rateDate=rate_date,
        basis=basis, approximate=approximate
    ).as_dict()
