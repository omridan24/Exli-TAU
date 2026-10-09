/**
 * The FX conversion engine — CLIENT-SIDE mirror of
 * exli-backend/services/fx_engine.py (docs/fx/01-fx-plan.md §3).
 *
 * Pure, stateless, no I/O: given an amount/currencies/date (or month) and a
 * `table` of already-loaded rates, returns the converted value plus enough
 * detail (which rate, from which date, whether it's an approximation) for
 * the UI to explain itself. Never rounds — that's left to the caller
 * (display, or committing a record/ledger amount).
 *
 * Checked against the same fixtures the Python engine runs against,
 * docs/fx/fx-test-vectors.json (see scripts/verify-fx-vectors.mjs — the
 * same pattern Groups uses for split_engine.py / splitEngine.js). If you
 * change the fallback/rounding rules here, change fx_engine.py and the
 * shared vectors too.
 *
 * `table` shape (assembled by fxRatesStore.js from Firestore, or a test
 * fixture):
 *   {
 *     daily: { "2025-08-20": { ILS: 3.4013, EUR: 0.86, ... }, ... },
 *     monthlyAvg: { "2025-08": { ILS: 3.41, ... }, ... },
 *     latest: { date: "2025-08-20", rates: { ILS: 3.4013, ... } } | null
 *   }
 * Every inner map is "1 USD = n <currency>".
 */

const MAX_LOOKBACK_DAYS = 7;

export class FxError extends Error {}

function rateOf(ratesMap, currency) {
  if (!ratesMap) return undefined;
  if (currency === 'USD') return ratesMap.USD ?? 1.0;
  return ratesMap[currency];
}

function cross(ratesMap, fromCurrency, toCurrency) {
  const usdFrom = rateOf(ratesMap, fromCurrency);
  const usdTo = rateOf(ratesMap, toCurrency);
  if (usdFrom == null || usdTo == null) return undefined;
  return usdTo / usdFrom;
}

/** Returns null (never throws) on a malformed dateStr - a caller passing a
 * full ISO datetime string instead of a plain 'YYYY-MM-DD' would otherwise
 * produce an Invalid Date here (the T00:00:00Z suffix doubles up) and crash
 * the whole render tree on .toISOString() (caught 2026-09-30, in Analytics,
 * after Groups-shared expenses started flowing through this path too). */
function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Rule 2: the exact date, else the previous available day up to
 * MAX_LOOKBACK_DAYS back. Returns { rate, date, approximate } or null. */
function findDayRate(daily, dateStr, fromCurrency, toCurrency) {
  for (let offset = 0; offset <= MAX_LOOKBACK_DAYS; offset++) {
    const candidate = offset === 0 ? dateStr : shiftDate(dateStr, offset);
    if (candidate == null) continue;
    const rate = cross(daily[candidate] || {}, fromCurrency, toCurrency);
    if (rate != null) {
      return { rate, date: candidate, approximate: offset > 0 };
    }
  }
  return null;
}

/**
 * @param {{amount:number, from:string, to:string, date?:string, month?:string}} params
 * @param {{daily?:object, monthlyAvg?:object, latest?:object|null}} table
 * @returns {{value:number|null, rate:number|null, rateDate:string|null, basis:string|null, approximate:boolean, reason?:string}}
 */
export function convert(params, table) {
  const { amount, from: fromCurrency, to: toCurrency, date: dateStr, month: monthStr } = params || {};

  if (amount == null || typeof amount !== 'number' || Number.isNaN(amount)) {
    throw new FxError("convert() requires a numeric 'amount'");
  }
  if (!fromCurrency || !toCurrency) {
    throw new FxError("convert() requires 'from' and 'to' currency codes");
  }

  // Rule 1: identity conversion needs no lookup at all.
  if (fromCurrency === toCurrency) {
    return { value: amount, rate: 1.0, rateDate: null, basis: null, approximate: false };
  }

  const daily = (table && table.daily) || {};
  const monthlyAvg = (table && table.monthlyAvg) || {};
  const latest = table && table.latest;

  let rate, rateDate, basis;
  let approximate = false;

  if (dateStr) {
    const found = findDayRate(daily, dateStr, fromCurrency, toCurrency);
    if (found) {
      ({ rate, date: rateDate, approximate } = found);
      basis = 'day';
    }
  } else if (monthStr) {
    rate = cross(monthlyAvg[monthStr] || {}, fromCurrency, toCurrency);
    if (rate != null) {
      rateDate = monthStr;
      basis = 'monthlyAvg';
      approximate = false;
    }
  }

  // Rule 4 (generalized): whenever the primary lookup above didn't resolve a
  // rate — including when neither date nor month was given at all — fall
  // back to the latest known rate, marked approximate.
  if (rate == null && latest) {
    rate = cross(latest.rates || {}, fromCurrency, toCurrency);
    if (rate != null) {
      rateDate = latest.date;
      basis = 'latest';
      approximate = true;
    }
  }

  if (rate == null) {
    // Rule 6: no rate anywhere — never silently summed by the caller.
    return { value: null, rate: null, rateDate: null, basis: null, approximate: false, reason: 'unsupported' };
  }

  return { value: amount * rate, rate, rateDate, basis, approximate };
}
