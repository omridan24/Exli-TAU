import React from 'react';
import { Repeat, Link } from 'lucide-react';
import { Button } from '../../../../components/UI';
import { useTranslation } from 'react-i18next';

export const RecurringHintBox = ({
    matchingRecurring,
    onCategorize
}) => {
    const { t } = useTranslation();

    if (!matchingRecurring) return null;

    return (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                    <Repeat className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-purple-900">{t('expenses.recurring.detected')}</span>
            </div>
            <p className="text-sm text-purple-700 mb-3">
                {t('expenses.recurring.matches', { name: matchingRecurring.name, frequency: matchingRecurring.frequency })}
            </p>
            <Button
                onClick={() => onCategorize(matchingRecurring.category, false, false, matchingRecurring.id)}
                className="bg-purple-600 hover:bg-purple-700 w-full flex items-center justify-center gap-2"
            >
                <Link className="w-4 h-4" /> {t('expenses.recurring.linkAndMerge')}
            </Button>
        </div>
    );
};
