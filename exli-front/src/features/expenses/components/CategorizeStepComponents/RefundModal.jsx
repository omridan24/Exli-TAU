import React from 'react';
import { XCircle, X } from 'lucide-react';
import { CategoryIcon } from '../../../../components/UI';
import { useTranslation } from 'react-i18next';

export const RefundModal = ({
    categories,
    onCategorize,
    setIsRefundModalOpen,
    getCategoryName
}) => {
    const { t } = useTranslation();

    return (
        <div className="p-6 bg-amber-50 rounded-3xl shadow-xl border border-amber-200 animate-fade-in mb-8">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-amber-800 text-lg flex items-center gap-2"><XCircle className="w-5 h-5" /> {t('expenses.categorize.selectRefundCategory')}</h4>
                <button onClick={() => setIsRefundModalOpen(false)} className="p-2 hover:bg-amber-100 rounded-full text-amber-700"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-amber-700 mb-6 font-medium">{t('expenses.categorize.whichCategoryRefund')}</p>
            <div className="grid grid-cols-3 gap-3">
                {categories.map(cat => (
                    <button 
                        key={cat.id} 
                        onClick={() => { onCategorize(cat.name, true); setIsRefundModalOpen(false); }} 
                        className="p-3 rounded-xl border-2 border-white bg-white hover:border-amber-300 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 shadow-sm"
                    >
                        <CategoryIcon iconName={cat.icon} color={cat.color} className="w-6 h-6" />
                        <span className="text-xs font-bold text-slate-600">{getCategoryName(cat)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
