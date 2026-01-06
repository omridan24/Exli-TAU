import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/UI';

export const HistoryTab = ({ history }) => {
    const { t } = useTranslation();

    // Get translated action type
    const getActionTypeName = (actionType) => {
        const translationKey = `history.actions.${actionType}`;
        const translated = t(translationKey);
        // If translation key doesn't exist, return original
        if (translated === translationKey) {
            return actionType;
        }
        return translated;
    };

    return (
        <Card className="p-8">
            <h2 className="text-2xl font-bold mb-6">{t('settings.history.title')}</h2>
            <div className="space-y-3">
                {history.map(item => (
                    <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border flex items-center gap-4 hover:bg-white transition-all">
                        <Clock className="text-slate-400" />
                        <div>
                            <div className="font-bold">{item.description}</div>
                            <div className="text-[10px] uppercase text-slate-400 tracking-widest">
                                {getActionTypeName(item.actionType)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};
