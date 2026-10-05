// Mirrors exli-backend/services/expense_date_service.py (the backend is the source of truth).

/** 'YYYY-MM' of a stored date ('YYYY-MM-DD' or 'YYYY-MM-DDT...'), or null when unparseable. */
export const monthOfDate = (value) => {
  const m = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-\d{2}/) : null;
  return m ? `${m[1]}-${m[2]}` : null;
};

/** { dateMonth, reportMonth } when the date is in a different month than the bucket it is shown in. */
export const getMonthMismatch = (expense) => {
  const dateMonth = monthOfDate(expense?.date);
  if (!dateMonth || !expense?.reportMonth || dateMonth === expense.reportMonth) return null;
  return { dateMonth, reportMonth: expense.reportMonth };
};

/** For the confirm summary: which of `expenses` move month vs stay, and which are shared (blocked). */
export const summarizeDateChange = (expenses, dateStr) => {
  const targetMonth = monthOfDate(dateStr);
  const result = { targetMonth, moves: 0, stays: 0, blocked: 0, movesFrom: {} };
  expenses.forEach((e) => {
    if (e.groupRef) { result.blocked += 1; return; }
    if (e.reportMonth === targetMonth) { result.stays += 1; return; }
    result.moves += 1;
    result.movesFrom[e.reportMonth] = (result.movesFrom[e.reportMonth] || 0) + 1;
  });
  return result;
};
