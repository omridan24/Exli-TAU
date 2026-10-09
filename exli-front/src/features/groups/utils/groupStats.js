import { getMinorUnits } from '../../../lib/fx/currencyMeta';

/** The currency an expense is held in (merge groups: the group's currency; keep_original: its own). */
export const expenseCurrency = (e, group) => e.currency || group?.currency || 'ILS';

/** The group's main currency: the one most of its expenses are in (ties: the first seen). */
export function mainCurrencyOf(expenses, group) {
  const counts = {};
  for (const e of expenses) {
    const c = expenseCurrency(e, group);
    counts[c] = (counts[c] || 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : (group?.currency || 'ILS');
}

/** Currencies present in the expenses, biggest total first (by raw minor units within each currency). */
export function currenciesIn(expenses, group) {
  const totals = {};
  for (const e of expenses) {
    const c = expenseCurrency(e, group);
    totals[c] = (totals[c] || 0) + (e.amountMinor || 0);
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/**
 * Re-expresses every expense in `target` at the rate of its own date (approximate - for stats only,
 * nothing is saved). `convertTo` is useFx().convertTo. Shares are scaled with the amount.
 * Returns { expenses, excluded } where excluded counts the ones with no available rate.
 */
export function convertExpensesTo(expenses, group, target, convertTo) {
  const out = [];
  let excluded = 0;
  for (const e of expenses) {
    const from = expenseCurrency(e, group);
    if (from === target) { out.push(e); continue; }
    const r = convertTo({ amount: (e.amountMinor || 0) / 10 ** getMinorUnits(from), currency: from, date: e.date }, target);
    if (r.value == null) { excluded += 1; continue; }
    const amountMinor = Math.round(r.value * 10 ** getMinorUnits(target));
    const ratio = e.amountMinor ? amountMinor / e.amountMinor : 0;
    const shares = Object.fromEntries(Object.entries(e.shares || {}).map(([uid, v]) => [uid, Math.round(v * ratio)]));
    out.push({ ...e, amountMinor, shares, currency: target });
  }
  return { expenses: out, excluded };
}

/** Aggregate stats for a group's (non-deleted) expenses. All amounts in minor units. */
export function computeGroupStats(expenses, memberUids) {
  const byMonth = {};
  const byCategory = {};
  const byMember = Object.fromEntries(memberUids.map((uid) => [uid, { paid: 0, owed: 0 }]));
  let total = 0;

  for (const e of expenses) {
    const amount = e.amountMinor || 0;
    total += amount;

    const month = String(e.date || '').slice(0, 7) || 'unknown';
    const m = (byMonth[month] ||= { total: 0, count: 0, paidBy: {} });
    m.total += amount;
    m.count += 1;
    m.paidBy[e.paidBy] = (m.paidBy[e.paidBy] || 0) + amount;

    const cat = e.category || '';
    byCategory[cat] = (byCategory[cat] || 0) + amount;

    if (byMember[e.paidBy]) byMember[e.paidBy].paid += amount;
    for (const [uid, share] of Object.entries(e.shares || {})) {
      if (byMember[uid]) byMember[uid].owed += share;
    }
  }

  const months = Object.entries(byMonth)
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => b.month.localeCompare(a.month));
  const categories = Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const topPayer = Object.entries(byMember).sort((a, b) => b[1].paid - a[1].paid)[0];
  const biggest = [...expenses].sort((a, b) => (b.amountMinor || 0) - (a.amountMinor || 0)).slice(0, 5);

  return {
    total,
    count: expenses.length,
    average: expenses.length ? Math.round(total / expenses.length) : 0,
    months,
    categories,
    biggest,
    byMember,
    topPayer: topPayer && topPayer[1].paid > 0 ? { uid: topPayer[0], paid: topPayer[1].paid } : null,
  };
}
