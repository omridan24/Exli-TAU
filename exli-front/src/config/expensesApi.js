import { authedFetch } from './groupsApi';

const post = (path, body) => authedFetch(path, { method: 'POST', body: JSON.stringify(body) });

/**
 * Analytics date/month changes. All go through the backend, which keeps an
 * expense's `date` and `reportMonth` in the same month and refuses to touch
 * expenses shared into a group (see exli-backend/services/expense_date_service.py).
 * Each resolves to { updated, movedMonth, sameMonth, blockedShared, notFound }.
 */
export const expensesApi = {
  changeDate: (ids, date) => post('/expenses/change-date', { ids, date }),
  moveMonth: (ids, month) => post('/expenses/move-month', { ids, month }),
  fixMonthMismatch: (ids) => post('/expenses/fix-month-mismatch', { ids }),
};
