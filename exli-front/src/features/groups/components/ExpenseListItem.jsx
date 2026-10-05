import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Pencil } from 'lucide-react';
import { formatMinorAmount, groupCurrency } from '../utils/money';
import { getExpenseSplitRows, formatPercent, getIncomeSplitInfo, formatMonth } from '../utils/expenseSplit';
import { ExpenseSplitBuckets } from './ExpenseSplitBuckets';

/** One interaction per row: the chevron expands the read-only split; editing lives inside the expansion (pencil). */
export const ExpenseListItem = ({ expense, group, onEdit }) => {
  const { t, i18n } = useTranslation();
  const income = getIncomeSplitInfo(expense);
  const expenseMonth = formatMonth(expense.date, i18n.language);
  const [showSplit, setShowSplit] = useState(false);
  const payerName = group.members?.[expense.paidBy]?.displayName || expense.paidBy;
  const currency = groupCurrency(group);
  const rows = getExpenseSplitRows(expense, group).filter((r) => r.amount > 0);

  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-center justify-between gap-3 px-2 -mx-2 py-1">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800 text-sm">{expense.description}</p>
          <p className="text-xs text-slate-400">{expense.date} · {payerName}</p>
          {income.isIncome && (
            <span
              className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${income.fallback ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-600'}`}
              title={income.incomeMonth ? t('groups.incomeSplit.basedOn', { month: formatMonth(income.incomeMonth, i18n.language) }) : undefined}
            >
              {income.fallback
                ? t('groups.incomeSplit.rowFallback', { month: expenseMonth })
                : t('groups.incomeSplit.rowLabel', { month: expenseMonth })}
            </span>
          )}
        </div>
        <span className="font-bold text-slate-700 text-sm">{formatMinorAmount(expense.amountMinor, currency)}</span>
        <button
          type="button"
          onClick={() => setShowSplit((s) => !s)}
          aria-expanded={showSplit}
          aria-label={t('groups.split.toggle')}
          title={t('groups.split.toggle')}
          className="p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 shrink-0"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showSplit ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {rows.length > 0 && (
        <p className="mt-1 text-[11px] text-slate-500 truncate">
          {rows.map((r, i) => (
            <span key={r.uid}>
              {i > 0 && ' · '}
              {r.displayName} {formatMinorAmount(r.amount, currency)} ({formatPercent(r.pct)})
            </span>
          ))}
        </p>
      )}
      {showSplit && (
        <div className="mt-2 bg-slate-50 rounded-xl p-3 relative">
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('groups.expense.editTitle')}
            title={t('groups.expense.editTitle')}
            className="absolute top-2 end-2 p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-white"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <ExpenseSplitBuckets expense={expense} group={group} />
        </div>
      )}
    </div>
  );
};
