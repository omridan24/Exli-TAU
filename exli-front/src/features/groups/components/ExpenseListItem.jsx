import React from 'react';
import { formatMinorAmount } from '../utils/money';

export const ExpenseListItem = ({ expense, group, onClick }) => {
  const payerName = group.members?.[expense.paidBy]?.displayName || expense.paidBy;
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
    >
      <div>
        <p className="font-medium text-slate-800 text-sm">{expense.description}</p>
        <p className="text-xs text-slate-400">{expense.date} · {payerName}</p>
      </div>
      <span className="font-bold text-slate-700 text-sm">{formatMinorAmount(expense.amountMinor, expense.currency || group.currency)}</span>
    </div>
  );
};
