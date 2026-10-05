/**
 * Read-only views over what a group expense actually applied.
 *
 * Every group expense persists its server-computed `shares: {uid: amountMinor}`
 * (see exli-backend/services/group_expenses_service.py), and income-based splits
 * additionally snapshot `split.resolvedRatios` at creation time. Percentages are
 * always derived from the persisted shares, so they match exactly what was
 * applied to THAT expense (income ratios change month to month) and legacy rows
 * without resolvedRatios still display correctly.
 */

export const formatPercent = (pct) => {
  const rounded = Math.round(pct * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
};

/** [{uid, displayName, amount, pct}] for each participant, largest share first. */
export function getExpenseSplitRows(expense, group) {
  const total = expense?.amountMinor || 0;
  const shares = expense?.shares || {};
  const uids = Array.from(new Set([...(expense?.participants || []), ...Object.keys(shares)]));
  return uids
    .map((uid) => {
      const amount = shares[uid] || 0;
      return {
        uid,
        displayName: group?.members?.[uid]?.displayName || uid,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Basis-point weights (10000 = 100%) of a group's fixed default -> [{uid, displayName, pct}]. */
export function getFixedSplitRows(weights, group) {
  return Object.entries(weights || {})
    .map(([uid, bp]) => ({ uid, displayName: group?.members?.[uid]?.displayName || uid, pct: bp / 100 }))
    .sort((a, b) => b.pct - a.pct);
}

/** 'YYYY-MM' or 'YYYY-MM-DD' -> localized short month name (e.g. "Sept"), optionally with the year. */
export function formatMonth(dateOrMonth, locale, withYear = false) {
  const [y, m] = String(dateOrMonth || '').split('-').map(Number);
  if (!y || !m) return String(dateOrMonth || '');
  try {
    return new Date(y, m - 1, 1).toLocaleDateString(locale, withYear ? { month: 'short', year: 'numeric' } : { month: 'short' });
  } catch {
    return String(dateOrMonth);
  }
}

/** What an expense says about income: { isIncome, fallback, incomeMonth } (fallback = no income data, split equally). */
export const getIncomeSplitInfo = (expense) => ({
  isIncome: isIncomeSplit(expense) || !!expense?.split?.params?.incomeFallback,
  fallback: !!expense?.split?.params?.incomeFallback,
  incomeMonth: expense?.split?.params?.incomeMonth || null,
});

/** True when the expense was split by income (rule kind, or a snapshotted ratio). */
export const isIncomeSplit = (expense) =>
  expense?.split?.kind === 'income_ratio' || !!expense?.split?.resolvedRatios;

/** Free-text match on description, date ("2026-03-14"), month name, "2026-03" or category. */
export function expenseMatchesQuery(expense, query, monthNames) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const date = String(expense.date || '').slice(0, 10);
  const monthIdx = Number(date.slice(5, 7)) - 1;
  const haystacks = [
    (expense.description || '').toLowerCase(),
    date,
    date.slice(0, 7),
    (monthNames?.[monthIdx] || '').toLowerCase(),
    (expense.category || '').toLowerCase(),
  ];
  return haystacks.some((h) => h && h.includes(q));
}
