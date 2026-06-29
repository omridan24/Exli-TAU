import React from 'react';
import { Flag, X, HelpCircle, FileWarning, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const SuspectModal = ({
    onCategorize,
    setIsSuspectModalOpen
}) => {
    const { t } = useTranslation();

    const suspectOptions = [
        { id: 'unrecognized', labelKey: 'expenses.suspectReasons.unrecognized', icon: HelpCircle, noteKey: 'expenses.suspectReasons.unrecognizedNote' },
        { id: 'duplicate', labelKey: 'expenses.suspectReasons.duplicate', icon: FileWarning, noteKey: 'expenses.suspectReasons.duplicateNote' },
        { id: 'amount', labelKey: 'expenses.suspectReasons.amount', icon: AlertTriangle, noteKey: 'expenses.suspectReasons.amountNote' },
        { id: 'fraud', labelKey: 'expenses.suspectReasons.fraud', icon: ShieldAlert, noteKey: 'expenses.suspectReasons.fraudNote' }
    ];

    return (
        <div className="p-6 bg-red-50 rounded-3xl shadow-xl border border-red-200 animate-fade-in mb-8">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-red-800 text-lg flex items-center gap-2"><Flag className="w-5 h-5" /> {t('expenses.categorize.whySuspicious')}</h4>
                <button onClick={() => setIsSuspectModalOpen(false)} className="p-2 hover:bg-red-100 rounded-full text-red-700"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-red-700 mb-6 font-medium">{t('expenses.categorize.selectReason')}</p>
            <div className="grid grid-cols-2 gap-3">
                {suspectOptions.map((option) => (
                    <button
                        key={option.id}
                        onClick={() => {
                            onCategorize("Uncategorized", false, true, null, t(option.noteKey));
                            setIsSuspectModalOpen(false);
                        }}
                        className="p-4 rounded-xl border-2 border-white bg-white hover:border-red-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 text-center h-28 group"
                    >
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <option.icon className="w-5 h-5 text-red-600" />
                        </div>
                        <span className="text-sm font-bold text-slate-700 leading-tight">{t(option.labelKey)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
