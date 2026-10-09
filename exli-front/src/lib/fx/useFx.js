/**
 * The main hook features use to convert/format money — docs/fx/01-fx-plan.md
 * §5. Wraps fxEngine.convert() with the currently-loaded fxRates data
 * (fxRatesStore) and the ambient default currency (CurrencyContext).
 *
 * Renders immediately with whatever's already cached (peekTable - synchronous,
 * never blocks) and triggers a background load for anything missing, then
 * re-renders once it arrives. A component only ever "waits" the first time a
 * given year is needed in a session; every use after that is instant.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { convert } from './fxEngine';
import { getMinorUnits } from './currencyMeta';
import { peekTable, yearsNeededFor, loadYear, loadLatest } from './fxRatesStore';
import { useCurrencyContext } from './useCurrencyContext';

/** @typedef {{amount:number, currency:string, date?:string, month?:string}} Money */

export function useFx() {
  const { defaultCurrency } = useCurrencyContext();
  // Bumped whenever a background load finishes. toDefault/convertTo/sum are
  // stable function references (useCallback, deps only on defaultCurrency),
  // so a caller's own useMemo keyed on one of them would NOT recompute when
  // new fxRates data arrives - only a re-render happens, with the memo
  // returning its stale cached value. Exposing this counter gives callers a
  // primitive that actually changes to put in their own dependency arrays
  // (see AnalyticsNode.jsx/YearDashboard.jsx for the pattern).
  const [dataVersion, bump] = useState(0);
  const loadingYears = useRef(new Set());

  const ensureLoaded = useCallback((dates, months) => {
    const years = yearsNeededFor(dates, months);
    const toLoad = years.filter((y) => !loadingYears.current.has(y));
    if (toLoad.length === 0) return;
    toLoad.forEach((y) => loadingYears.current.add(y));
    Promise.all([...toLoad.map(loadYear), loadLatest()]).then(() => bump((n) => n + 1));
  }, []);

  /** @param {Money} money @param {string} [toCurrency] @returns {ReturnType<typeof convert>} */
  const convertTo = useCallback(
    (money, toCurrency) => {
      const target = toCurrency || defaultCurrency;
      if (!money || money.amount == null || !money.currency) {
        return { value: null, rate: null, rateDate: null, basis: null, approximate: false, reason: 'unsupported' };
      }
      // Records' `date` is sometimes a full ISO datetime string rather than a
      // plain 'YYYY-MM-DD' - fxEngine's day-lookback math appends its own
      // time suffix, so an already-full datetime string produces an invalid
      // Date and throws (crashed all of Analytics, caught 2026-09-30).
      const date = money.date ? String(money.date).slice(0, 10) : money.date;
      const table = peekTable(yearsNeededFor([date], [money.month]));
      const result = convert(
        { amount: money.amount, from: money.currency, to: target, date, month: money.month },
        table
      );
      if (result.reason === 'unsupported') {
        // Might just be a cache miss (year not loaded yet) rather than a
        // genuinely unsupported currency - kick off a load either way; a
        // real "no rate exists" will just harmlessly resolve to the same
        // unsupported result once the (empty) load finishes.
        ensureLoaded([date], [money.month]);
      }
      return result;
    },
    [defaultCurrency, ensureLoaded]
  );

  /** Converts to the ambient default currency. */
  const toDefault = useCallback((money) => convertTo(money, defaultCurrency), [convertTo, defaultCurrency]);

  /**
   * Sums a list of Money into the default currency. Anything that can't be
   * converted is excluded and reported, never silently dropped from the
   * total or silently treated as zero.
   * @param {Money[]} moneys
   * @returns {{value:number, excluded:Money[]}}
   */
  const sum = useCallback(
    (moneys) => {
      let value = 0;
      const excluded = [];
      for (const money of moneys || []) {
        const result = toDefault(money);
        if (result.value == null) {
          excluded.push(money);
        } else {
          value += result.value;
        }
      }
      return { value, excluded };
    },
    [toDefault]
  );

  /** Rounds to the target currency's real minor units and formats with
   * Intl.NumberFormat (falls back to a plain "<symbol> <amount>" string if
   * the currency code isn't valid for the runtime's Intl data). */
  const format = useCallback((amount, currency, locale) => {
    if (amount == null) return '—';
    const rounded = Number(amount.toFixed(getMinorUnits(currency)));
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: getMinorUnits(currency),
        maximumFractionDigits: getMinorUnits(currency),
      }).format(rounded);
    } catch {
      return `${rounded.toLocaleString(locale)} ${currency}`;
    }
  }, []);

  /**
   * Applies a user's "convert" choice to a record for storage (§3 Decision
   * B): returns the record re-expressed in the default currency, with
   * `original` and `fx` kept so it's traceable/reversible.
   * @param {Money} money
   */
  const convertRecord = useCallback(
    (money) => {
      const result = toDefault(money);
      if (result.value == null) return null;
      return {
        amount: Number(result.value.toFixed(getMinorUnits(defaultCurrency))),
        currency: defaultCurrency,
        original: { amount: money.amount, currency: money.currency },
        fx: {
          rate: result.rate,
          rateDate: result.rateDate,
          basis: result.basis,
          convertedAt: new Date().toISOString(),
        },
      };
    },
    [toDefault, defaultCurrency]
  );

  useEffect(() => {
    // Every render, opportunistically warm the current year + latest, since
    // almost everything converts against "now" at some point.
    ensureLoaded([new Date().toISOString().slice(0, 10)], []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { toDefault, convertTo, sum, format, convertRecord, defaultCurrency, dataVersion };
}

export default useFx;
