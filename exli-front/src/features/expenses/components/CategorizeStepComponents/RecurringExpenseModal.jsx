import React from 'react';
import { Repeat, X, ChevronRight } from 'lucide-react';
import { Button } from '../../../../components/UI';
import { useTranslation } from 'react-i18next';

export const RecurringExpenseModal = ({
    recurringExpenses,
    onCategorize,
    setIsRecurringListOpen
}) => {
    const { t } = useTranslation();

    return (
        <div className="p-6 bg-white rounded-3xl shadow-xl border border-slate-200 animate-fade-in mb-8">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <Repeat className="w-5 h-5 text-purple-600" />
                    {t('expenses.recurring.linkTitle') || 'Link to Recurring Expense'}
                </h4>
                <button onClick={() => setIsRecurringListOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
                {t('expenses.recurring.linkDescription') || 'Select which recurring expense this transaction belongs to:'}
            </p>
            {recurringExpenses && recurringExpenses.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {recurringExpenses.map(rec => (
                        <button
                            key={rec.id}
                            onClick={() => {
                                onCategorize(rec.category, false, false, rec.id);
                                setIsRecurringListOpen(false);
                            }}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-all text-start group"
                        >
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                <Repeat className="w-6 h-6 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 truncate">{rec.name}</div>
                                <div className="text-sm text-slate-500 flex items-center gap-2">
                                    <span className="font-mono font-bold">{rec.amount} {rec.currency}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-xs uppercase">{rec.frequency?.type || 'monthly'}</span>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors" />
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 text-slate-400">
                    <Repeat className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t('expenses.recurring.noRecurring') || 'No recurring expenses set up yet'}</p>
                </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsRecurringListOpen(false)} className="w-full">
                    {t('common.cancel')}
                </Button>
            </div>
        </div>
    );
};
