import React from 'react';
import { CreditCard, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const TransactionCard = ({
    currentTx,
    cleanDateDisplay,
    currentIndex,
    handleUndo
}) => {
    const { t } = useTranslation();

    if (!currentTx) return null;

    return (
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden relative min-h-[250px] flex flex-col justify-between">
            <div className="absolute top-4 end-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm opacity-80 z-10">
                <CreditCard className="w-3 h-3" /> {currentTx.sourceCard}
            </div>

            <div className="bg-slate-50 p-6 flex-1 flex flex-col justify-center items-center text-center relative">
                <div className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">{cleanDateDisplay(currentTx.date)}</div>
                <h3 className="text-2xl font-black text-slate-800 mb-4 px-8 leading-tight">{currentTx.description}</h3>

                <div className="text-4xl font-mono font-black text-slate-800 flex items-center gap-2 group">
                    {currentTx.amount} <span className="text-lg text-slate-400 font-bold">{currentTx.currency}</span>
                </div>
                {currentTx.originalCategory && (
                    <div className="mt-4 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                        {t('expenses.categorize.original')} {currentTx.originalCategory}
                    </div>
                )}
            </div>

            {/* Navigation Controls Overlay */}
            <div className="absolute bottom-4 start-4">
                {currentIndex > 0 && (
                    <button onClick={handleUndo} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-full shadow-sm transition-all">
                        <RotateCcw className="w-3 h-3" /> {t('common.back')}
                    </button>
                )}
            </div>
        </div>
    );
};
