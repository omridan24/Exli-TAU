import React from 'react';
import { Edit2, X } from 'lucide-react';
import { Button } from '../../../../components/UI';
import { useTranslation } from 'react-i18next';

export const EditExpenseModal = ({
    editForm,
    setEditForm,
    saveEdit,
    setIsEditModalOpen
}) => {
    const { t } = useTranslation();

    return (
        <div className="p-6 bg-white rounded-3xl shadow-xl border border-slate-200 animate-fade-in mb-8">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Edit2 className="w-5 h-5" /> {t('expenses.categorize.editExpenseDetails')}</h4>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('expenses.columnFields.description')}</label>
                    <input 
                        type="text" 
                        value={editForm.description} 
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })} 
                        className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('expenses.columnFields.amount')}</label>
                        <input 
                            type="number" 
                            value={editForm.amount} 
                            onChange={e => setEditForm({ ...editForm, amount: e.target.value })} 
                            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('expenses.columnFields.date')}</label>
                        <input 
                            type="datetime-local" 
                            value={editForm.date ? new Date(editForm.date).toISOString().slice(0, 16) : ''} 
                            onChange={e => setEditForm({ ...editForm, date: new Date(e.target.value).toISOString() })} 
                            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" 
                        />
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={saveEdit}>{t('expenses.categorize.saveChanges')}</Button>
            </div>
        </div>
    );
};
