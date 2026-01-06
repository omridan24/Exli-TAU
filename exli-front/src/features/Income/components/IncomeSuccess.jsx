import React from 'react';
import { CheckCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/UI.jsx';

export const IncomeSuccess = ({ reportMonth, onReset, onComplete }) => {
    const { t } = useTranslation();

    return (
        <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">{t('income.success.incomeSaved')}</h3>
            <p className="text-slate-500 mb-8" dangerouslySetInnerHTML={{ __html: t('income.success.dataUpdated', { month: reportMonth }) }} />
            <div className="flex justify-center gap-3">
                <Button onClick={onReset} variant="secondary" className="px-8"><Plus className="w-4 h-4" /> {t('income.success.addAnother')}</Button>
                <Button onClick={onComplete} className="px-8">{t('income.success.backToDashboard')}</Button>
            </div>
        </div>
    );
};
