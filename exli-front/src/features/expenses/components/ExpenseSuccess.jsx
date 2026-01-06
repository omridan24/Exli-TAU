import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/UI';

export const ExpenseSuccess = ({ isManualMode, onReset, onComplete }) => {
    const { t } = useTranslation();

    return (
        <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">
                {isManualMode ? t('expenses.success.expenseAdded') : t('expenses.success.importComplete')}
            </h3>
            <div className="flex justify-center gap-4 mt-6">
                <Button onClick={onReset}>{t('expenses.success.addMore')}</Button>
                <Button variant="secondary" onClick={onComplete}>{t('expenses.success.goToDashboard')}</Button>
            </div>
        </div>
    );
};
