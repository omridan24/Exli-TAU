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
  const biggest = [...expenses].sort((a, b) => (b.amountMinor || 0) - (a.amountMinor || 0)).slice(0, 5);

  return {
    total,
    count: expenses.length,
    average: expenses.length ? Math.round(total / expenses.length) : 0,
    months,
    categories,
    biggest,
    byMember,
  };
}
