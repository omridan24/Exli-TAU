import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { RuleRow } from './RuleRow';
import { PourItYourself } from './PourItYourself';
import { computeShares, SplitError } from '../../utils/splitEngine';
import { groupsApi } from '../../../../config/groupsApi';

/**
 * "apply" mode only for now (plan §4.1) — picking a split when adding an expense.
 * "configure" (creation wizard) and "manage" (admin rule editor) land in a follow-up.
 */
export const SplitPicker = ({ group, amountMinor, payerId, participantUids, dateStr, onConfirm, initialSplit, isSubmitting }) => {
  const { t } = useTranslation();
  const rules = (group.splitRules || []).filter((r) => !r.hidden);
  const isInitialCustom = initialSplit && !initialSplit.splitRuleId;
  const [selectedRuleId, setSelectedRuleId] = useState(initialSplit?.splitRuleId || group.defaultSplitRuleId);
  const [customMode, setCustomMode] = useState(!!isInitialCustom);
  const [customShares, setCustomShares] = useState(isInitialCustom ? initialSplit.params?.amounts : null);
  const [incomeRatio, setIncomeRatio] = useState(null);

  const members = useMemo(
    () => Object.fromEntries(Object.entries(group.members || {}).map(([uid, m]) => [uid, m.displayName])),
    [group.members]
  );
  const participants = participantUids.map((uid) => ({ uid, displayName: members[uid] || uid }));

  const hasIncomeRule = rules.some((r) => r.kind === 'income_ratio');
  useEffect(() => {
    if (!hasIncomeRule) return;
    groupsApi.getIncomeRatioPreview(group.id, dateStr).then(setIncomeRatio).catch(() => setIncomeRatio({ ready: false, missing: [] }));
  }, [hasIncomeRule, group.id, dateStr]);

  // "Your Treat" is 2-person only — "your" is singular, so with 3+ participants
  // it'd silently become "split among everyone else" instead of pointing at one
  // specific person. The backend enforces this too (NEEDS_TWO_PEOPLE).
  const disabledReasonFor = (rule) => {
    if (rule.kind === 'income_ratio' && incomeRatio && !incomeRatio.ready) {
      const names = incomeRatio.missing.map((uid) => members[uid] || uid).join(', ');
      return t('groups.splitPicker.waitingOnIncome', { names });
    }
    if (rule.builtIn === 'your_treat' && participantUids.length !== 2) {
      return t('groups.splitPicker.needsTwoPeople');
    }
    return null;
  };

  const previewFor = (rule) => {
    try {
      const params = rule.kind === 'income_ratio' ? { weights: incomeRatio?.ratios } : rule.params;
      if (disabledReasonFor(rule)) return null;
      return computeShares(amountMinor, rule.kind, participantUids, payerId, params);
    } catch {
      return null;
    }
  };

  const handleConfirm = () => {
    if (isSubmitting) return;
    if (customMode) {
      onConfirm({ splitInput: { kind: 'custom', params: { amounts: customShares } } });
    } else {
      onConfirm({ splitInput: { splitRuleId: selectedRuleId } });
    }
  };

  const customSum = customShares ? Object.values(customShares).reduce((a, b) => a + b, 0) : 0;
  const selectedRule = rules.find((r) => r.id === selectedRuleId);
  const canConfirm = (customMode
    ? customSum === amountMinor
    : !!selectedRuleId && !(selectedRule && disabledReasonFor(selectedRule))
  ) && !isSubmitting;

  return (
    <div className="space-y-2">
      {!customMode ? (
        <>
          {rules.map((rule) => {
            const disabledReason = disabledReasonFor(rule);
            return (
              <RuleRow
                key={rule.id}
                rule={rule}
                shares={previewFor(rule)}
                members={members}
                currency={group.currency}
                isSelected={selectedRuleId === rule.id}
                isDisabled={!!disabledReason}
                disabledReason={disabledReason || ''}
                onSelect={setSelectedRuleId}
              />
            );
          })}
          <button
            type="button"
            onClick={() => setCustomMode(true)}
            className="w-full text-start p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300"
          >
            <span className="text-sm font-bold text-slate-600">🪣 {t('groups.splitRules.custom.name')}</span>
            <p className="text-xs text-slate-400 mt-0.5">{t('groups.splitRules.custom.description')}</p>
          </button>
        </>
      ) : (
        <div>
          <button type="button" onClick={() => setCustomMode(false)} className="text-xs text-slate-400 mb-2">
            ← {t('groups.create.back')}
          </button>
          <PourItYourself
            participants={participants} amountMinor={amountMinor} currency={group.currency}
            onChange={setCustomShares} initialAmounts={isInitialCustom ? initialSplit.params?.amounts : null}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-40 mt-3 flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {t('groups.splitPicker.confirm')}
      </button>
    </div>
  );
};
