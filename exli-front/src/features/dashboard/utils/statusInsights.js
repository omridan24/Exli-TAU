/**
 * Pure helpers behind the dashboard's Status panel: spending / savings insights from
 * expenses + income, and the investment portfolio's value and daily move.
 * Amounts are converted to the user's default currency with useFx().toDefault.
 */

/** 'YYYY-MM' of an expense/income record (identified month first, then its date), or null. */
export const recordMonthKey = (item) => {
  const raw = item?.reportMonth || item?.month || item?.pay_month || item?.date;
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{4})[-/](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : null;
};

/** Stored category name of an expense that has none. */
export const UNCATEGORIZED = 'Uncategorized';

const toDefaultValue = (toDefault, item, amount, monthKey) => {
  if (typeof toDefault !== 'function') return amount;
  const res = toDefault({ amount, currency: item.currency || 'ILS', date: item.date, month: monthKey });
  return res?.value ?? null; // null: no exchange rate, left out rather than counted as zero
};

/**
 * Spending and income insights over everything the user has uploaded (all time, not one month).
 * Forecasts and refunds are left out, like the amount saved; amounts without an exchange rate are
 * left out rather than counted as zero.
 *
 * @returns {{
 *   spent: number,
 *   monthCount: number,
 *   topCategory: { name: string, amount: number, share: number }|null,
 *   income: number,
 *   savingsRate: number|null
 * }}
 */
export const computeSpendingInsights = ({ expenses = [], income = [], toDefault } = {}) => {
  const months = new Set();
  const categories = {};
  let spent = 0;

  (Array.isArray(expenses) ? expenses : []).forEach((e) => {
    if (!e || e.isForecast || e.isRefund) return;
    const monthKey = recordMonthKey(e);
    const value = toDefaultValue(toDefault, e, Number(e.amount) || 0, monthKey);
    if (value == null) return;
    if (monthKey) months.add(monthKey);
    spent += value;
    const category = e.assignedCategory || UNCATEGORIZED;
    categories[category] = (categories[category] || 0) + value;
  });

  let totalIncome = 0;
  (Array.isArray(income) ? income : []).forEach((i) => {
    if (!i) return;
    const value = toDefaultValue(toDefault, i, Number(i.neto) || 0, recordMonthKey(i));
    if (value != null) totalIncome += value;
  });

  const top = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  return {
    spent,
    monthCount: months.size,
    topCategory: top ? { name: top[0], amount: top[1], share: spent > 0 ? (top[1] / spent) * 100 : 0 } : null,
    income: totalIncome,
    savingsRate: totalIncome > 0 ? ((totalIncome - spent) / totalIncome) * 100 : null,
  };
};

/** A holding with a real market ticker (not a manually typed "LOCAL_" security number). */
export const isQuotableHolding = (holding) =>
  Boolean(holding?.symbol) && !holding.unverified && !String(holding.symbol).startsWith('LOCAL_');

const BUCKETS = ['long', 'mid', 'short'];

/** The close the portfolio is measured against for "this month": the last one before the month began. */
const closeBeforeMonth = (priceHistory, monthStart) => {
  let base = null;
  for (const point of priceHistory) {
    if (typeof point?.date !== 'string' || !(Number(point.close) > 0)) continue;
    if (point.date.slice(0, 10) < monthStart) base = Number(point.close);
    else break; // history is oldest first
  }
  return base;
};

/**
 * Portfolio value now (as the Investments page's Total Portfolio counts it), and what it made since the
 * start of the current month, in the default currency.
 * Each holding's gain is its quantity times the price move since the last close before the month began;
 * a holding added during the month is measured from the day it was added, so its purchase is not a gain.
 *
 * @param {Array} holdings - users/{uid}.holdings
 * @param {Object<string, {currentPrice?: number, priceHistory?: Array<{date: string, close: number}>}>} quotes - by symbol
 * @param {Function} toDefault - useFx().toDefault
 * @param {Date} [now]
 * @returns {{ value: number, monthChange: number, monthChangePct: number|null, count: number, hasMonthData: boolean }}
 */
export const computePortfolioInsight = (holdings = [], quotes = {}, toDefault, now = new Date()) => {
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  let value = 0;
  let monthChange = 0;
  let count = 0;
  let hasMonthData = false;

  (Array.isArray(holdings) ? holdings : []).forEach((h) => {
    // Same rule as the Investments page's "Total Portfolio": only holdings assigned to a bucket,
    // valued at their saved price, so the dashboard and that page always show the same number.
    if (!BUCKETS.includes(h?.bucket)) return;
    const quantity = Number(h?.quantity) || 0;
    const quote = quotes[h?.symbol];
    const price = Number(quote?.currentPrice) || Number(h?.currentPrice) || 0;
    const holdingValue = h.currentPrice ? h.currentPrice * quantity : Number(h.marketValue) || 0;
    if (!(holdingValue > 0)) return;

    const currency = h.currency || 'USD';
    const convert = (amount) => {
      if (typeof toDefault !== 'function') return amount;
      return toDefault({ amount, currency }).value;
    };
    const valueInDefault = convert(holdingValue);
    if (valueInDefault == null) return;

    value += valueInDefault;
    count += 1;

    const history = Array.isArray(quote?.priceHistory) ? quote.priceHistory : [];
    if (!history.length || !price || !quantity) return;

    const addedDay = typeof h.addedAt === 'string' ? h.addedAt.slice(0, 10) : null;
    const addedThisMonth = addedDay && addedDay >= monthStart;
    // Added this month: measured from the first close on or after the day it was added
    const base = addedThisMonth
      ? Number(history.find((p) => typeof p?.date === 'string' && p.date.slice(0, 10) >= addedDay)?.close) || null
      : closeBeforeMonth(history, monthStart);
    if (!base) return;

    const changeInDefault = convert((price - base) * quantity);
    if (changeInDefault != null) {
      monthChange += changeInDefault;
      hasMonthData = true;
    }
  });

  const valueAtMonthStart = value - monthChange;
  return {
    value,
    monthChange,
    monthChangePct: hasMonthData && valueAtMonthStart > 0 ? (monthChange / valueAtMonthStart) * 100 : null,
    count,
    hasMonthData,
  };
};
