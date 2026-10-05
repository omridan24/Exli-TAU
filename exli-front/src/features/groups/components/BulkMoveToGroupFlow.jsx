import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Check } from 'lucide-react';
import { useMyGroups } from '../hooks/useMyGroups';
import { groupsApi } from '../../../config/groupsApi';
import { getGroupType, GROUP_TYPE_COLOR_CLASSES } from '../utils/groupTypes';
import { RuleRow } from './SplitPicker/RuleRow';
import { DefaultSplitCard } from './SplitPicker/DefaultSplitCard';
import { SplitPicker } from './SplitPicker/SplitPicker';
import { toMinorUnits, formatMinorAmount } from '../utils/money';

/** One representative date string per distinct calendar month among the selected
 * expenses — enough to ask the backend "is income ready for that month" once per
 * month actually involved, instead of guessing from today's date. Personal
 * expenses store `date` as either a plain 'YYYY-MM-DD' or a full ISO datetime
 * string, but the income-ratio endpoint's `date` query param only accepts the
 * plain form (400s otherwise, caught 2026-09-30) - normalize before sending. */
function datesByDistinctMonth(expenses) {
  const seen = new Map();
  for (const exp of expenses) {
    const dateStr = (exp.date || '').slice(0, 10);
    const d = new Date(dateStr);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!seen.has(key)) seen.set(key, dateStr);
  }
  return [...seen.values()];
}

/**
 * Bulk "move to group" from the Expenses report's multi-select bar. Either one
 * saved split rule applied across every selected expense in a single batch
 * call, or each expense walked through individually with the full split
 * picker (so a different rule - or Pour It Yourself - can be chosen per
 * expense; a single custom split can't scale across expenses with different
 * totals anyway, so this reuses the same one-at-a-time transfer the single-
 * expense move flow already does, just looped with a running tally).
 *
 * `expenses` is snapshotted on mount into `walkExpenses`, not read live from
 * the prop: the caller derives it as "selected AND not yet shared", so it
 * shrinks in real time as each expense gets transferred - indexing into the
 * live prop during the walkthrough would skip items as the array shifted
 * under it, and eventually read past the end (caught 2026-09-30: exactly this
 * crashed on the last expense with "Cannot read properties of undefined").
 */
const USE_DEFAULT = '__default__';

export const BulkMoveToGroupFlow = ({ expenses, userId, onClose, onMoved }) => {
  const { t } = useTranslation();
  const { groups, loading } = useMyGroups(userId);
  const [walkExpenses] = useState(() => expenses);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null); // { succeeded, failed } | null
  const [incomeRatio, setIncomeRatio] = useState(null);

  // Per-expense walkthrough state: walkIndex is which of `walkExpenses` is
  // currently showing its own split picker (null = not in the walkthrough).
  const [walkIndex, setWalkIndex] = useState(null);
  const [walkResults, setWalkResults] = useState([]);

  const expenseIds = walkExpenses.map((e) => e.id);
  const rules = selectedGroup ? (selectedGroup.splitRules || []).filter((r) => !r.hidden) : [];
  const members = selectedGroup
    ? Object.fromEntries(Object.entries(selectedGroup.members || {}).map(([uid, m]) => [uid, m.displayName]))
    : {};
  const activeMemberCount = selectedGroup ? (selectedGroup.memberIds || []).length : 0;
  const activeParticipants = selectedGroup
    ? Object.entries(selectedGroup.members || {})
        .filter(([, m]) => m.status === 'active')
        .map(([uid, m]) => ({ uid, displayName: m.displayName }))
    : [];

  // "Your Treat" is 2-person only (see SplitPicker.jsx for why); every expense
  // here always splits among the group's full membership, so this is a plain
  // member-count check, no per-expense participant list to consider.
  const disabledReasonFor = (rule) => {
    if (rule.kind === 'income_ratio' && incomeRatio && !incomeRatio.ready) {
      const names = incomeRatio.missing.map((uid) => members[uid] || uid).join(', ');
      return t('groups.splitPicker.waitingOnIncome', { names });
    }
    if (rule.builtIn === 'your_treat' && activeMemberCount !== 2) {
      return t('groups.splitPicker.needsTwoPeople');
    }
    return null;
  };

  // The selected expenses can span several calendar months, and each one uses
  // its OWN month's income for Split by Income (plan §3.7) — so this checks
  // readiness for every distinct month actually present in the batch, not just
  // today's. Only "ready" if every one of them is. The backend re-checks each
  // expense against its own date again at transfer time regardless.
  useEffect(() => {
    if (!selectedGroup || !rules.some((r) => r.kind === 'income_ratio')) return;
    const representativeDates = datesByDistinctMonth(walkExpenses);
    Promise.all(representativeDates.map((date) => groupsApi.getIncomeRatioPreview(selectedGroup.id, date)))
      .then((checks) => {
        setIncomeRatio({
          ready: checks.every((c) => c.ready),
          missing: [...new Set(checks.flatMap((c) => c.missing || []))],
        });
      })
      .catch(() => setIncomeRatio({ ready: false, missing: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup]);

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    // A group with a constant-percentages default opens on it (sent as useDefault).
    setSelectedRuleId(group.defaultFixedSplit ? USE_DEFAULT : group.defaultSplitRuleId);
    setIncomeRatio(null);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const useDefault = selectedRuleId === USE_DEFAULT || isDefaultIncomeSelected;
      const { results } = await groupsApi.transferPersonalExpensesBatch(
        selectedGroup.id, expenseIds, useDefault ? null : selectedRuleId, useDefault
      );
      const succeeded = results.filter((r) => r.status === 'ok').length;
      setSummary({ succeeded, failed: results.length - succeeded });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isDefaultIncomeSelected = !!selectedGroup && !!selectedGroup.defaultSplitConfigured
    && selectedRuleId === selectedGroup.defaultSplitRuleId
    && rules.find((r) => r.id === selectedRuleId)?.kind === 'income_ratio';

  const currentWalkExpense = walkIndex != null ? walkExpenses[walkIndex] : null;
  const currentWalkAmountMinor = currentWalkExpense ? toMinorUnits(Math.abs(currentWalkExpense.amount || 0)) : 0;
  const currentWalkDateStr = currentWalkExpense ? (currentWalkExpense.date || '').slice(0, 10) : '';

  const handleConfirmWalkStep = async ({ splitInput }) => {
    setSubmitting(true);
    setError('');
    let status = 'ok';
    try {
      await groupsApi.transferPersonalExpense(selectedGroup.id, currentWalkExpense.id, splitInput);
    } catch {
      status = 'error';
    }
    setSubmitting(false);

    const nextResults = [...walkResults, { status }];
    if (walkIndex + 1 < walkExpenses.length) {
      setWalkResults(nextResults);
      setWalkIndex(walkIndex + 1);
    } else {
      const succeeded = nextResults.filter((r) => r.status === 'ok').length;
      setSummary({ succeeded, failed: nextResults.length - succeeded });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-lg">{t('groups.transfer.bulkTitle', { count: expenseIds.length })}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {summary ? (
            <div className="text-center space-y-3">
              <Check className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-slate-700 font-bold">{t('groups.transfer.bulkDone', { count: summary.succeeded })}</p>
              {summary.failed > 0 && <p className="text-sm text-rose-500">{t('groups.transfer.bulkFailed', { count: summary.failed })}</p>}
              <button onClick={onMoved} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold">{t('common.close')}</button>
            </div>
          ) : !selectedGroup ? (
            loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
            ) : groups.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">{t('groups.transfer.noGroups')}</p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => {
                  const groupType = getGroupType(group.type);
                  const colors = GROUP_TYPE_COLOR_CLASSES[groupType.color];
                  const Icon = groupType.icon;
                  return (
                    <button
                      key={group.id} type="button" onClick={() => handleSelectGroup(group)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-100 hover:border-indigo-300 text-start"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${colors.bgLight} ${colors.text}`}>
                        {group.imageUrl ? <img src={group.imageUrl} alt="" className="w-full h-full object-cover" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className="font-bold text-sm text-slate-700">{group.name}</span>
                    </button>
                  );
                })}
              </div>
            )
          ) : walkIndex != null ? (
            <>
              <button
                type="button"
                onClick={() => { setWalkIndex(null); setWalkResults([]); }}
                className="text-xs text-slate-400"
              >
                ← {t('groups.create.back')}
              </button>
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <p className="font-bold text-slate-800">{currentWalkExpense.description}</p>
                <p className="text-slate-500">
                  {formatMinorAmount(currentWalkAmountMinor, selectedGroup.currency)} · {currentWalkDateStr}
                </p>
              </div>
              <p className="text-xs text-slate-400 text-center">
                {t('groups.transfer.customStep', { current: walkIndex + 1, total: walkExpenses.length })}
              </p>
              {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
              {/* Keyed on the expense id so every step is a fresh SplitPicker/
                  PourItYourself instance - otherwise their internal bucket
                  values and locks would carry over from the previous
                  expense's (different) amount. */}
              <SplitPicker
                key={currentWalkExpense.id}
                group={selectedGroup}
                amountMinor={currentWalkAmountMinor}
                payerId={userId}
                participantUids={activeParticipants.map((p) => p.uid)}
                dateStr={currentWalkDateStr}
                onConfirm={handleConfirmWalkStep}
                isSubmitting={submitting}
              />
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">{t('groups.transfer.bulkSplitHint', { count: expenseIds.length })}</p>
              <div className="space-y-2">
                {selectedGroup.defaultFixedSplit && (
                  <button type="button" onClick={() => setSelectedRuleId(USE_DEFAULT)} className={`w-full text-start rounded-xl ${selectedRuleId === USE_DEFAULT ? '' : 'opacity-60'}`}>
                    <DefaultSplitCard group={selectedGroup} members={members} />
                  </button>
                )}
                {rules.map((rule) => {
                  const disabledReason = disabledReasonFor(rule);
                  return (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      shares={null}
                      members={members}
                      currency={selectedGroup.currency}
                      isSelected={selectedRuleId === rule.id}
                      isDisabled={!!disabledReason}
                      disabledReason={disabledReason || ''}
                      onSelect={setSelectedRuleId}
                    />
                  );
                })}
                <button
                  type="button"
                  onClick={() => { setWalkIndex(0); setWalkResults([]); }}
                  className="w-full text-start p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300"
                >
                  <span className="text-sm font-bold text-slate-600">🪣 {t('groups.transfer.splitIndividually')}</span>
                  <p className="text-xs text-slate-400 mt-0.5">{t('groups.transfer.splitIndividuallyHint')}</p>
                </button>
              </div>
              {isDefaultIncomeSelected && (
                <p className="text-xs text-indigo-600 font-medium">{t('groups.incomeSplit.perMonthHint')}</p>
              )}
              {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
              <button
                onClick={handleConfirm}
                disabled={!selectedRuleId || submitting || (selectedRuleId !== USE_DEFAULT && !isDefaultIncomeSelected && !!disabledReasonFor(rules.find((r) => r.id === selectedRuleId) || {}))}
                className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />} {t('groups.transfer.bulkConfirm', { count: expenseIds.length })}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
