import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PourItYourself } from './SplitPicker/PourItYourself';
import { splitRuleName, splitRuleEmoji } from '../utils/splitCatalog';
import { IncomeMonthlyBreakdown } from './IncomeMonthlyBreakdown';
import { FIXED, TOTAL_BP } from '../utils/defaultSplit';

/**
 * Group settings: choose the default split - a saved split mode, or constant
 * percentages per member (the "pour it yourself" buckets, in percent).
 * Controlled: GroupSettings owns the state and the single Save button.
 */
export const DefaultSplitSettings = ({ group, choice, weights, onChoice, onWeights, expenseMonths = [] }) => {
  const { t } = useTranslation();
  const rules = (group.splitRules || []).filter((r) => !r.hidden);
  const participants = useMemo(
    () => Object.entries(group.members || {})
      .filter(([, m]) => m.status === 'active')
      .map(([uid, m]) => ({ uid, displayName: m.displayName })),
    [group.members]
  );
  const isIncomeChoice = rules.find((r) => r.id === choice)?.kind === 'income_ratio';

  return (
    <div className="border-t border-slate-100 pt-4 space-y-3">
      <div>
        <h3 className="font-bold text-slate-800 text-sm">{t('groups.defaultSplit.title')}</h3>
        <p className="text-xs text-slate-400">{t('groups.defaultSplit.hint')}</p>
      </div>
      <select
        value={choice}
        onChange={(e) => onChoice(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium"
      >
        <option value="" disabled>{t('groups.defaultSplit.none')}</option>
        {rules.map((r) => (
          <option key={r.id} value={r.id}>{splitRuleEmoji(r)} {splitRuleName(r, t)}</option>
        ))}
        <option value={FIXED}>🪣 {t('groups.defaultSplit.fixedName')}</option>
      </select>
      {choice === FIXED && (
        <PourItYourself
          participants={participants} amountMinor={TOTAL_BP} currency={group.currency || 'ILS'} percentMode
          initialAmounts={weights} onChange={onWeights}
        />
      )}
      {isIncomeChoice && (
        <div className="bg-indigo-50/50 rounded-xl p-3 space-y-2">
          <p className="text-xs text-slate-500">{t('groups.incomeSplit.explainer')}</p>
          <IncomeMonthlyBreakdown group={group} expenseMonths={expenseMonths} />
        </div>
      )}
    </div>
  );
};
