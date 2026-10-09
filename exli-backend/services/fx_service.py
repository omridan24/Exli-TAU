"""
Backend mirror of the frontend's fxRatesStore + useFx (docs/fx/01-fx-plan.md
§5) - loads fxRates/{year} + fxRates/latest from Firestore and wraps
fx_engine.convert() so server-side code (group expenses, income ratios) can
convert an amount without re-implementing the day/month/latest fallback
rules fx_engine already owns.

fx_engine works in MAJOR units (e.g. 100.0 for $100 - see its own module
docstring and src/lib/fx/useFx.js's convertTo). convert_minor()/apply_rate_minor()
exist so callers that store amountMinor integers never have to juggle the
/ 10**minorUnits themselves.
"""
from services import fx_engine
from services.currency_meta import get_minor_units

FX_RATES_COLLECTION = "fxRates"
LATEST_DOC_ID = "latest"


def _year_doc(db, year):
    snap = db.collection(FX_RATES_COLLECTION).document(str(year)).get()
    return snap.to_dict() if snap.exists else None


def load_table(db, dates=None, months=None):
    """Loads only the fxRates/{year} docs a batch of dates/months actually
    needs, plus fxRates/latest (always - it's the fallback of last resort)."""
    years = set()
    for d in dates or []:
        if d:
            years.add(str(d)[:4])
    for m in months or []:
        if m:
            years.add(str(m)[:4])

    daily = {}
    monthly_avg = {}
    for year in years:
        doc = _year_doc(db, year)
        if doc:
            daily.update(doc.get("days") or {})
            monthly_avg.update(doc.get("monthlyAvg") or {})

    latest_snap = db.collection(FX_RATES_COLLECTION).document(LATEST_DOC_ID).get()
    latest = latest_snap.to_dict() if latest_snap.exists else None

    return {"daily": daily, "monthlyAvg": monthly_avg, "latest": latest}


def convert_amount(db, amount, from_currency, to_currency, date_str=None, month_str=None):
    """amount is a MAJOR-unit number. Returns fx_engine's ConversionResult dict."""
    table = load_table(
        db,
        dates=[date_str] if date_str else None,
        months=[month_str] if month_str else None,
    )
    return fx_engine.convert(
        {"amount": amount, "from": from_currency, "to": to_currency, "date": date_str, "month": month_str},
        table,
    )


def convert_minor(db, amount_minor, from_currency, to_currency, date_str=None, month_str=None):
    """Same as convert_amount, but takes/returns integer minor units. Adds
    `amountMinor` to the result (None when reason='unsupported')."""
    major_amount = amount_minor / (10 ** get_minor_units(from_currency))
    result = convert_amount(db, major_amount, from_currency, to_currency, date_str=date_str, month_str=month_str)
    result["amountMinor"] = (
        None if result["value"] is None else round(result["value"] * (10 ** get_minor_units(to_currency)))
    )
    return result


def apply_rate_minor(amount_minor, from_currency, to_currency, rate):
    """Applies an ALREADY-KNOWN rate (a previously locked conversion) to a new
    minor-unit amount, with no Firestore read - used when editing a locked
    expense whose currency/date haven't changed (docs/fx/01-fx-plan.md §3
    Decision B: 'editing anything else keeps [the rate]')."""
    major_amount = amount_minor / (10 ** get_minor_units(from_currency))
    return round(major_amount * rate * (10 ** get_minor_units(to_currency)))
