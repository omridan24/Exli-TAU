import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bucket } from '../../../components/buckets/Bucket';
import { formatMinorAmount, groupCurrency } from '../utils/money';
import { getExpenseSplitRows, formatPercent, isIncomeSplit } from '../utils/expenseSplit';

const noop = () => {};

/**
 * Read-only (locked) version of the "Pour It Yourself" buckets: shows the total
 * and, per member, the amount and percentage that were actually applied to this
 * expense. Used on group expense rows and for expenses moved from Analytics.
 */
export const ExpenseSplitBuckets = ({ expense, group }) => {
  const { t } = useTranslation();
  const currency = groupCurrency(group);
  const rows = getExpenseSplitRows(expense, group);

  return (
    <div className="space-y-2">
      <p className="text-center text-xs font-bold text-slate-500">
        {t('groups.split.total', { amount: formatMinorAmount(expense.amountMinor, currency) })}
        {isIncomeSplit(expense) && <span className="text-indigo-600"> · {t('groups.split.byIncome')}</span>}
      </p>
      <div className="flex justify-center gap-3 flex-wrap">
        {rows.map((r) => (
          <div key={r.uid} className="flex flex-col items-center">
            <Bucket
              label={r.displayName}
              value={r.amount}
              total={expense.amountMinor}
              isLocked
              onChange={noop}
              formatValue={(v) => formatMinorAmount(v, currency)}
            />
            <span className="text-xs font-bold text-slate-600 mt-1">{formatPercent(r.pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
