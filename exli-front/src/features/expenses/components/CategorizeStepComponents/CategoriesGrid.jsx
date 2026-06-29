import React from 'react';
import { CategoryIcon } from '../../../../components/UI';
import { useTranslation } from 'react-i18next';

export const CategoriesGrid = ({
    categories,
    suggestedCategoryId,
    lastUndoChoice,
    onCategorize,
    getCategoryName
}) => {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {categories.map(cat => {
                const isSuggested = suggestedCategoryId === cat.id;
                const isPrevious = lastUndoChoice === cat.name; // Check if this was the last choice
                return (
                    <button 
                        key={cat.id} 
                        onClick={() => onCategorize(cat.name)} 
                        className={`p-2 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 ${isPrevious ? 'ring-4 ring-slate-200 border-slate-400 bg-slate-50' : ''} ${isSuggested ? 'border-emerald-500 bg-emerald-50 shadow-md scale-105' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                    >
                        <CategoryIcon iconName={cat.icon} color={cat.color} className={`w-6 h-6 ${isSuggested ? 'text-emerald-600' : ''}`} />
                        <span className={`text-[11px] font-bold leading-tight ${isSuggested ? 'text-emerald-700' : 'text-slate-600'}`}>{getCategoryName(cat)}</span>
                        {isPrevious && <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-200 px-1 rounded">{t('expenses.categorize.wasThis')}</span>}
                    </button>
                );
            })}
        </div>
    );
};
