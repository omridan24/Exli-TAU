import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/UI';

export const HistoryTab = ({ history }) => {
    const { t, i18n } = useTranslation();

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

    // Format date in locale-aware format
    const formatDate = (timestamp) => {
        if (!timestamp) return '';

        // Handle Firestore Timestamp
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

        const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';

        return date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Card className="p-8">
            <h2 className="text-2xl font-bold mb-6">{t('settings.history.title')}</h2>
            <div className="space-y-3">
                {history.map(item => (
                    <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border flex items-center gap-4 hover:bg-white transition-all">
                        <Clock className="text-slate-400" />
                        <div className="flex-1">
                            <div className="font-bold">{item.description}</div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] uppercase text-slate-400 tracking-widest">
                                    {getActionTypeName(item.actionType)}
                                </span>
                                {item.timestamp && (
                                    <span className="text-[10px] text-slate-400">
                                        • {formatDate(item.timestamp)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};
