import React from 'react';
import { Edit2, Plus, Check, Trash2, Repeat, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ActionSidebar = ({
    openEditModal,
    applyPercentage,
    selectedSplit,
    setIsCreatingCat,
    setIsRefundModalOpen,
    onSkip,
    recurringExpenses,
    setIsRecurringListOpen,
    setIsSuspectModalOpen
}) => {
    const { t } = useTranslation();

    return (
        <div className="w-full md:w-64 flex flex-col gap-3">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest ps-1">{t('expenses.categorize.actions')}</span>

                <button onClick={openEditModal} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors text-start border border-transparent hover:border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><Edit2 className="w-4 h-4" /></div> {t('expenses.categorize.editExpense')}
                </button>
                <div className="flex gap-2 px-1 -mt-1 mb-2">
                    {[25, 50, 75].map(percent => (
                        <button
                            key={percent}
                            onClick={() => applyPercentage(percent)}
                            className={`flex-1 py-1.5 text-[10px] font-black rounded-lg border transition-colors ${
                                selectedSplit === percent 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                    : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`}
                        >
                            {percent}%
                        </button>
                    ))}
                </div>

                <button onClick={() => setIsCreatingCat(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors text-start border border-transparent hover:border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center"><Plus className="w-4 h-4" /></div> {t('expenses.categorize.addCategory')}
                </button>

                <div className="h-px bg-slate-100 my-2"></div>

                <button onClick={() => setIsRefundModalOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 text-slate-600 font-bold text-sm transition-colors text-start border border-transparent hover:border-emerald-100 group">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Check className="w-4 h-4" /></div>
                    <span className="group-hover:text-emerald-700">{t('expenses.categorize.refundedIncome')}</span>
                </button>

                <button onClick={onSkip} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-400 font-bold text-sm transition-colors text-start border border-transparent hover:border-slate-200 hover:text-slate-600">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Trash2 className="w-4 h-4" /></div> {t('expenses.categorize.skip')}
                </button>

                {recurringExpenses && recurringExpenses.length > 0 && (
                    <button onClick={() => setIsRecurringListOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 text-slate-600 font-bold text-sm transition-colors text-start border border-transparent hover:border-purple-100 group">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Repeat className="w-4 h-4" /></div>
                        <span className="group-hover:text-purple-700">{t('expenses.recurring.linkToRecurring') || 'Link to Recurring'}</span>
                    </button>
                )}

                <div className="h-px bg-slate-100 my-2"></div>

                <button onClick={() => setIsSuspectModalOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 font-bold text-sm transition-colors text-start border border-transparent hover:border-red-100 group">
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center group-hover:animate-pulse"><Flag className="w-4 h-4" /></div>
                    <span className="group-hover:text-red-600">{t('expenses.categorize.markAsSuspect')}</span>
                </button>
            </div>
        </div>
    );
};
