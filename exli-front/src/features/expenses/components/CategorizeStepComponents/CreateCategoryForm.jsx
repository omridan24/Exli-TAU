import React from 'react';
import { Button } from '../../../../components/UI';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const CreateCategoryForm = ({
    newCatName,
    setNewCatName,
    onQuickAddCategory,
    setIsCreatingCat
}) => {
    const { t } = useTranslation();

    return (
        <div className="mb-6 p-6 bg-white rounded-3xl shadow-xl border border-slate-100">
            <h4 className="font-bold text-slate-800 mb-4 text-lg">{t('expenses.categorize.createNewCategory')}</h4>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={newCatName} 
                    onChange={(e) => setNewCatName(e.target.value)} 
                    className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500" 
                    placeholder={t('expenses.categorize.categoryPlaceholder')} 
                    autoFocus 
                />
                <Button onClick={onQuickAddCategory} disabled={!newCatName}>{t('expenses.categorize.create')}</Button>
                <Button variant="secondary" onClick={() => setIsCreatingCat(false)}><X className="w-4 h-4" /></Button>
            </div>
        </div>
    );
};
