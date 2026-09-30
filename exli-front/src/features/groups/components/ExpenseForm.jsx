import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { SplitPicker } from './SplitPicker/SplitPicker';
import { toMinorUnits } from '../utils/money';
import { groupsApi } from '../../../config/groupsApi';
import { DEFAULT_CATEGORIES } from '../../../config/constants';
import { CategoryIcon } from '../../../components/UI';

/** Add/edit an expense. `expense` (existing doc) switches this into edit mode —
 * same form and SplitPicker, prefilled, PATCH instead of POST on save. */
export const ExpenseForm = ({ group, userId, expense, onClose, onSaved }) => {
  const { t } = useTranslation();
  const isEditing = !!expense;
  const activeMembers = Object.entries(group.members || {}).filter(([, m]) => m.status === 'active');

  const [description, setDescription] = useState(expense?.description || '');
  const [amount, setAmount] = useState(expense ? String(expense.amountMinor / 100) : '');
  const [date, setDate] = useState(expense?.date || new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(expense?.category || DEFAULT_CATEGORIES[0].id);
  const [payerId, setPayerId] = useState(expense?.paidBy || userId);
  const [step, setStep] = useState('details');
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A ref alongside the state: two rapid clicks can both read isSubmitting as
  // false before the first click's setState re-render commits, so the state
  // alone doesn't stop a double-submit (the bug this guards against — see
  // Groups feedback 2026-09-29). The ref updates synchronously.
  const submittingRef = useRef(false);

  // Everyone active is always "in" the split by default. If not everyone should
  // owe something, Pour It Yourself handles it — drag (or type) someone's bucket
  // to 0 to exclude them, rather than a separate "who's splitting" step.
  const participantUids = activeMembers.map(([uid]) => uid);
  const amountMinor = toMinorUnits(amount || 0);

  const handleNext = () => {
    if (!description.trim() || !amountMinor) {
      setError(t('groups.expense.errors.required'));
      return;
    }
    setError('');
    setStep('split');
  };

  const handleConfirmSplit = async ({ splitInput }) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    const payload = {
      description: description.trim(), amountMinor, date, category, payerId,
      participants: participantUids, split: splitInput,
    };
    try {
      if (isEditing) {
        await groupsApi.editExpense(group.id, expense.id, payload);
      } else {
        await groupsApi.createExpense(group.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setStep('details');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await groupsApi.deleteExpense(group.id, expense.id);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-lg">{isEditing ? t('groups.expense.editTitle') : t('groups.expense.title')}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {confirmingDelete ? (
            <div className="text-center space-y-4">
              <p className="text-slate-600 text-sm">{t('groups.expense.deleteConfirm')}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmingDelete(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold">
                  {t('groups.create.cancel')}
                </button>
                <button onClick={handleDelete} className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold">
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ) : step === 'details' ? (
            <>
              <input
                type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={t('groups.expense.descriptionPlaceholder')} autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2">
                <input
                  type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" min="0" step="0.01"
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none focus:border-indigo-500"
                />
                <input
                  type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('groups.expense.category')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {DEFAULT_CATEGORIES.map((c) => (
                    <button
                      key={c.id} type="button" onClick={() => setCategory(c.id)}
                      className={`p-2.5 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                        category === c.id ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      <CategoryIcon iconName={c.icon} color={c.color} className="w-5 h-5" />
                      <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t('groups.expense.paidBy')}</label>
                <select value={payerId} onChange={(e) => setPayerId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium">
                  {activeMembers.map(([uid, m]) => <option key={uid} value={uid}>{m.displayName}</option>)}
                </select>
              </div>

              {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
              <button onClick={handleNext} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold">{t('groups.create.next')}</button>
              {isEditing && (
                <button onClick={() => setConfirmingDelete(true)} className="w-full text-center text-xs font-bold text-rose-400 hover:text-rose-600">
                  {t('groups.expense.delete')}
                </button>
              )}
            </>
          ) : (
            <>
              {error && <p className="text-xs text-rose-500 font-medium mb-2">{error}</p>}
              <SplitPicker
                group={group} amountMinor={amountMinor} payerId={payerId}
                participantUids={participantUids} dateStr={date} onConfirm={handleConfirmSplit}
                initialSplit={expense?.split} isSubmitting={isSubmitting}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
