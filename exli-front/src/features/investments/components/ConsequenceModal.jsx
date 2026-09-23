import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlertTriangle, ArrowRight, TrendingDown, Clock,
    X, ChevronLeft, ChevronRight, Shield
} from 'lucide-react';

// Comparison Card
const ComparisonCard = ({ title, data, variant, t }) => {
    const isNew = variant === 'new';

    return (
        <div className={`flex-1 p-4 rounded-xl border-2 
            ${isNew
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-white'
            }`}>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                {title}
            </div>
            <div className="space-y-3">
                {data.retireAge && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">
                            {t('investments.consequence.retireAge', 'Retirement Age')}
                        </span>
                        <span className={`font-bold ${isNew ? 'text-amber-700' : 'text-slate-800'}`}>
                            {data.retireAge}
                        </span>
                    </div>
                )}
                {data.riskLevel && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">
                            {t('investments.consequence.riskLevel', 'Risk Level')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                            ${data.riskLevel === 'High'
                                ? 'bg-red-100 text-red-700'
                                : data.riskLevel === 'Medium'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                            }`}>
                            {data.riskLevel}
                        </span>
                    </div>
                )}
                {data.monthlyGrowth && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">
                            {t('investments.consequence.expectedGrowth', 'Expected Growth')}
                        </span>
                        <span className={`font-medium ${isNew ? 'text-amber-700' : 'text-emerald-600'}`}>
                            {data.monthlyGrowth}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Main ConsequenceModal Component
export const ConsequenceModal = ({
    isOpen,
    onClose,
    onConfirm,
    onCancel,
    currentPlan,
    newPlan,
    consequenceMessage,
    delayYears
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div
                className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">
                            {t('investments.consequence.title', 'Heads Up: This Change Has Consequences')}
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="ml-auto p-1 hover:bg-slate-100 rounded-full"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Comparison */}
                <div className="flex gap-4 mb-6">
                    <ComparisonCard
                        title={t('investments.consequence.currentPlan', 'Current Plan')}
                        data={currentPlan}
                        variant="current"
                        t={t}
                    />
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                            <ArrowRight className="w-4 h-4 text-slate-400" />
                        </div>
                    </div>
                    <ComparisonCard
                        title={t('investments.consequence.newPlan', 'New Plan')}
                        data={newPlan}
                        variant="new"
                        t={t}
                    />
                </div>

                {/* Delay Impact */}
                {delayYears && delayYears > 0 && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                        <Clock className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <div>
                            <div className="font-medium text-red-700">
                                {t('investments.consequence.delayImpact', '+{{years}} years to your goals!', { years: delayYears })}
                            </div>
                            <p className="text-sm text-red-600">
                                {consequenceMessage || t('investments.consequence.defaultMessage',
                                    'Lowering risk now could delay your Retirement goal. Markets will feel scary—that\'s normal.'
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {/* Educational note */}
                <div className="p-3 bg-slate-50 rounded-lg mb-6">
                    <p className="text-sm text-slate-600 italic">
                        {t('investments.consequence.note',
                            "💡 Remember: Your Short Term bucket is already protecting money you'll need soon. The Long bucket is designed to ride out storms."
                        )}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white 
                            rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <Shield className="w-4 h-4" />
                        {t('investments.consequence.keepPlan', 'Keep My Plan')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 px-4 border-2 border-slate-200 text-slate-600 
                            rounded-xl font-medium hover:bg-slate-50 transition-all"
                    >
                        {t('investments.consequence.changeAnyway', 'I Understand, Change It')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConsequenceModal;
