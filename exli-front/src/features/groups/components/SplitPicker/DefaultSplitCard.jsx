import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { RuleRow } from './RuleRow';
import { formatMinorAmount } from '../../utils/money';
import { formatPercent, getFixedSplitRows } from '../../utils/expenseSplit';

/**
 * The group's default split, shown first (preselected) with its details:
 * the mode and each member's percentage (and amount, when the total is known).
 * A saved rule renders through RuleRow; the constant "buckets of percentages"
 * default renders its fixed percentages.
 */
export const DefaultSplitCard = ({ group, rule, shares, members, amountMinor, disabledReason, incomeNote }) => {
  const { t } = useTranslation();
  const fixed = group.defaultFixedSplit;

  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('groups.defaultSplit.badge')}</p>
      {fixed ? (
        <div className="w-full text-start p-3 rounded-xl border-2 border-indigo-500 bg-indigo-50">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <span>🪣</span> {t('groups.defaultSplit.fixedName')}
            </span>
            <Check className="w-4 h-4 text-indigo-600 shrink-0" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {getFixedSplitRows(fixed.weights, group).map((r, i) => (
              <span key={r.uid}>
                {i > 0 && ' · '}{r.displayName} {formatPercent(r.pct)}
                {amountMinor > 0 && ` (${formatMinorAmount((amountMinor * r.pct) / 100, group.currency)})`}
              </span>
            ))}
          </p>
        </div>
      ) : (
        rule && (
          <RuleRow
            rule={rule} shares={shares} members={members} currency={group.currency}
            isSelected isDisabled={!!disabledReason} disabledReason={disabledReason || ''} onSelect={() => {}}
          />
        )
      )}
      {incomeNote && <p className="text-xs font-medium text-indigo-600">{incomeNote}</p>}
    </div>
  );
};
