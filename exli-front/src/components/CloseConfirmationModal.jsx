import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Custom confirmation modal for unsaved changes warning.
 * Appears when user tries to close a form with unsaved data.
 */
export const CloseConfirmationModal = ({ onContinue, onDiscard }) => {
    const { t } = useTranslation();

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Icon and Title */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">
                        {t('common.closeConfirmation.title')}
                    </h3>
                </div>

                {/* Message */}
                <p className="text-slate-600 mb-6 leading-relaxed">
                    {t('common.closeConfirmation.message')}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onDiscard}
                        className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                    >
                        {t('common.closeConfirmation.discard')}
                    </button>
                    <button
                        onClick={onContinue}
                        className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg"
                    >
                        {t('common.closeConfirmation.continueEditing')}
                    </button>
                </div>
            </div>
        </div>
    );
};
