import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { useMyGroups } from '../hooks/useMyGroups';
import { SplitPicker } from './SplitPicker/SplitPicker';
import { groupsApi } from '../../../config/groupsApi';
import { toMinorUnits, formatMinorAmount } from '../utils/money';
import { getGroupType, GROUP_TYPE_COLOR_CLASSES } from '../utils/groupTypes';

/**
 * "Move to group" — launched from the personal Expenses report. Picks a group,
 * then splits it: no re-entering description/date/amount/category, those are
 * already known from the personal expense (plan Phase 3, plan 01 §8).
 */
export const MoveToGroupFlow = ({ expense, userId, onClose, onMoved }) => {
  const { t } = useTranslation();
  const { groups, loading } = useMyGroups(userId);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [error, setError] = useState('');

  const amountMinor = toMinorUnits(Math.abs(expense.amount || 0));
  const dateStr = (expense.date || '').slice(0, 10);

  const handleConfirmSplit = async ({ splitInput }) => {
    try {
      await groupsApi.transferPersonalExpense(selectedGroup.id, expense.id, splitInput);
      onMoved();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-lg">
            {selectedGroup ? t('groups.transfer.splitTitle') : t('groups.transfer.selectTitle')}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {!selectedGroup ? (
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
                      key={group.id} type="button" onClick={() => setSelectedGroup(group)}
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
          ) : (
            <>
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <p className="font-bold text-slate-800">{expense.description}</p>
                <p className="text-slate-500">{formatMinorAmount(amountMinor, selectedGroup.currency)} · {dateStr}</p>
              </div>
              {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
              <SplitPicker
                group={selectedGroup}
                amountMinor={amountMinor}
                payerId={userId}
                participantUids={Object.entries(selectedGroup.members || {})
                  .filter(([, m]) => m.status === 'active')
                  .map(([uid]) => uid)}
                dateStr={dateStr}
                onConfirm={handleConfirmSplit}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
