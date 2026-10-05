import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ArrowRightLeft, Undo2, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { groupsApi } from '../../../config/groupsApi';
import { ExpenseSplitBuckets } from './ExpenseSplitBuckets';

/**
 * Opened from the "Shared in {{group}}" badge on an already-grouped personal
 * expense (Analytics report). Two actions:
 *  - Move to another group: un-shares from the current group, then hands the
 *    restored (original-amount) expense to onMoveToAnother so the caller can
 *    open the normal MoveToGroupFlow for it.
 *  - Remove from group: un-shares and stops there - the expense goes back to
 *    being a plain personal one at its original amount.
 * Both call groupsApi.removePersonalExpenseFromGroup, which undoes
 * transfer_personal_expense: reverses the group's balances, soft-deletes the
 * group expense, and restores amount/clears groupRef on the personal one.
 */
export const GroupedExpenseActionsModal = ({ expense, onClose, onRemoved, onMoveToAnother }) => {
  const { t } = useTranslation();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [splitView, setSplitView] = useState(null); // { group, groupExpense }; null while loading / unavailable

  // Read-only look at how the group split this expense (members can read group docs).
  useEffect(() => {
    let cancelled = false;
    const { groupId, groupExpenseId } = expense.groupRef;
    Promise.all([getDoc(doc(db, 'groups', groupId)), getDoc(doc(db, 'groups', groupId, 'expenses', groupExpenseId))])
      .then(([groupSnap, expenseSnap]) => {
        if (cancelled || !groupSnap.exists() || !expenseSnap.exists()) return;
        setSplitView({ group: { id: groupSnap.id, ...groupSnap.data() }, groupExpense: { id: expenseSnap.id, ...expenseSnap.data() } });
      })
      .catch((err) => console.error('Failed to load group split:', err));
    return () => { cancelled = true; };
  }, [expense.groupRef]);

  const restoredExpense = () => ({
    ...expense, amount: expense.originalAmount, groupRef: null, originalAmount: null,
  });

  const handleRemove = async () => {
    setSubmitting(true);
    setError('');
    try {
      await groupsApi.removePersonalExpenseFromGroup(expense.groupRef.groupId, expense.id);
      onRemoved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleMoveToAnother = async () => {
    setSubmitting(true);
    setError('');
    try {
      await groupsApi.removePersonalExpenseFromGroup(expense.groupRef.groupId, expense.id);
      onMoveToAnother(restoredExpense());
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{t('analytics.groupActions.title')}</h3>
            <p className="text-xs text-slate-400">{t('analytics.sharedInGroup', { name: expense.groupRef.groupName })}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        {splitView && (
          <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">{t('groups.split.title')}</p>
            <ExpenseSplitBuckets expense={splitView.groupExpense} group={splitView.group} />
          </div>
        )}

        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

        {confirmingRemove ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{t('analytics.groupActions.removeConfirm')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingRemove(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold"
              >
                {t('groups.create.cancel')}
              </button>
              <button
                onClick={handleRemove}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />} {t('analytics.groupActions.removeFromGroup')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleMoveToAnother}
              disabled={submitting}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-100 hover:border-indigo-300 text-start disabled:opacity-50"
            >
              <ArrowRightLeft className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="font-bold text-sm text-slate-700">{t('analytics.groupActions.moveToAnother')}</span>
            </button>
            <button
              onClick={() => setConfirmingRemove(true)}
              disabled={submitting}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-100 hover:border-rose-300 text-start disabled:opacity-50"
            >
              <Undo2 className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-bold text-sm text-slate-700">{t('analytics.groupActions.removeFromGroup')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
