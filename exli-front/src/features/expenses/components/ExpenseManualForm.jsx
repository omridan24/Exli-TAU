import React from 'react';
import { PenTool, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, CategoryIcon } from '../../../components/UI';
import { CURRENCIES } from '../../../config/constants';

// Reuse category translation from settings
const categoryKeyMap = {
    'food': 'food', 'groceries': 'groceries', 'transport': 'transport', 'shopping': 'shopping',
    'housing': 'housing', 'bills': 'bills', 'travel': 'travel', 'health': 'health',
    'education': 'education', 'pets': 'pets', 'gifts': 'gifts', 'entertainment': 'entertainment', 'other': 'other'
};

export const ExpenseManualForm = ({
    manualData,
    setManualData,
    categories,
    onCategorize,
    onCreateCategory,
    onCancel
}) => {
    const { t } = useTranslation();

    const getCategoryName = (cat) => {
        const key = categoryKeyMap[cat.id];
        return key ? t(`categories.${key}`) : cat.name;
    };

    return (
        <div className="max-w-lg mx-auto bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PenTool className="w-5 h-5 text-emerald-500" /> {t('expenses.manual.newTransaction')}</h3>
            <div className="space-y-4 mb-8">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">{t('expenses.manual.amount')}</label>
                    <div className="flex gap-2">
                        <input type="number" className="flex-1 p-3 border border-slate-200 rounded-xl text-2xl font-bold outline-none focus:border-emerald-500" placeholder="0.00" autoFocus value={manualData.amount} onChange={e => setManualData({ ...manualData, amount: e.target.value })} />
                        <select className="w-24 p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none" value={manualData.currency} onChange={e => setManualData({ ...manualData, currency: e.target.value })}>
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <div><label className="text-xs font-bold text-slate-400 uppercase">{t('expenses.manual.description')}</label><input type="text" className="w-full p-3 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500" placeholder={t('expenses.manual.descriptionPlaceholder')} value={manualData.description} onChange={e => setManualData({ ...manualData, description: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-slate-400 uppercase">{t('expenses.manual.date')}</label><input type="date" className="w-full p-3 border border-slate-200 rounded-xl font-medium outline-none" value={manualData.date} onChange={e => setManualData({ ...manualData, date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {categories.map(cat => (
                    <button key={cat.id} onClick={() => onCategorize(cat.name)} className="p-2 rounded-lg border border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-1 group">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                            <CategoryIcon iconName={cat.icon} color={cat.color} className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{getCategoryName(cat)}</span>
                    </button>
                ))}
                <button onClick={onCreateCategory} className="p-2 rounded-lg border border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"><Plus className="w-4 h-4 mx-auto" /></button>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100"><Button variant="secondary" onClick={onCancel} className="w-full justify-center">{t('common.cancel')}</Button></div>
        </div>
    );
};
