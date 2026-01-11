import React, { useState, useRef } from 'react';
import { X, PenTool, Plus, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, CategoryIcon } from '../../../components/UI';
import { CURRENCIES } from '../../../config/constants';
import { CloseConfirmationModal } from '../../../components/CloseConfirmationModal.jsx';

// Category translation mapping (same as RecurringForm)
const categoryKeyMap = {
    'food': 'food', 'groceries': 'groceries', 'transport': 'transport', 'shopping': 'shopping',
    'housing': 'housing', 'bills': 'bills', 'travel': 'travel', 'health': 'health',
    'education': 'education', 'pets': 'pets', 'gifts': 'gifts', 'entertainment': 'entertainment', 'other': 'other'
};

export const ExpenseManualForm = ({
    manualData,
    setManualData,
    categories,
    onCategorize,
    onCreateCategory,
    onCancel
}) => {
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState('');
    const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
    const [validationError, setValidationError] = useState('');

    const initialFormDataRef = useRef(JSON.stringify({
        amount: manualData.amount || '',
        description: manualData.description || ''
    }));

    // Check if form has unsaved changes
    const hasUnsavedChanges = () => {
        const current = JSON.stringify({
            amount: manualData.amount,
            description: manualData.description
        });
        return current !== initialFormDataRef.current;
    };

    // Handle close attempt (X button or backdrop click)
    const handleCloseAttempt = () => {
        if (hasUnsavedChanges()) {
            setShowCloseConfirmation(true);
        } else {
            onCancel();
        }
    };

    const getCategoryName = (cat) => {
        const key = categoryKeyMap[cat.id];
        return key ? t(`categories.${key}`) : cat.name;
    };

    const handleCategorize = (categoryName) => {
        // Validate form before categorizing
        if (!manualData.amount || parseFloat(manualData.amount) <= 0) {
            setValidationError(t('expenses.manual.enterAmountAndDescription'));
            return;
        }
        if (!manualData.description?.trim()) {
            setValidationError(t('expenses.manual.enterAmountAndDescription'));
            return;
        }
        setSelectedCategory(categoryName);
        onCategorize(categoryName);
    };

    return (
        <>
            {/* Close Confirmation Modal */}
            {showCloseConfirmation && (
                <CloseConfirmationModal
                    onContinue={() => setShowCloseConfirmation(false)}
                    onDiscard={onCancel}
                />
            )}

            <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={handleCloseAttempt}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
                        <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                            <PenTool className="w-5 h-5 text-emerald-600" />
                            {t('expenses.manual.newTransaction')}
                        </h3>
                        <button onClick={handleCloseAttempt} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form Content */}
                    <div className="p-6 space-y-6">
                        {/* Amount and Currency */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {t('expenses.manual.amount')} *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full p-3 border border-slate-300 rounded-xl text-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    placeholder="0.00"
                                    autoFocus
                                    value={manualData.amount}
                                    onChange={e => {
                                        setManualData({ ...manualData, amount: e.target.value });
                                        setValidationError('');
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {t('expenses.recurringForm.currency')}
                                </label>
                                <select
                                    className="w-full p-3 border border-slate-300 rounded-xl font-bold bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={manualData.currency}
                                    onChange={e => setManualData({ ...manualData, currency: e.target.value })}
                                >
                                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                {t('expenses.manual.description')} *
                            </label>
                            <input
                                type="text"
                                className="w-full p-3 border border-slate-300 rounded-xl font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder={t('expenses.manual.descriptionPlaceholder')}
                                value={manualData.description}
                                onChange={e => {
                                    setManualData({ ...manualData, description: e.target.value });
                                    setValidationError('');
                                }}
                            />
                        </div>

                        {/* Date */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                {t('expenses.manual.date')}
                            </label>
                            <input
                                type="date"
                                className="w-full p-3 border border-slate-300 rounded-xl font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                                value={manualData.date}
                                onChange={e => setManualData({ ...manualData, date: e.target.value })}
                            />
                        </div>

                        {/* Validation Error */}
                        {validationError && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-red-700">{validationError}</span>
                            </div>
                        )}

                        {/* Category Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">
                                {t('expenses.recurringForm.category')} *
                            </label>
                            <div className="grid grid-cols-4 gap-3">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategorize(cat.name)}
                                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${selectedCategory === cat.name
                                                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                                : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                                            }`}
                                    >
                                        <CategoryIcon iconName={cat.icon} color={cat.color} className="w-6 h-6" />
                                        <span className="text-xs font-bold text-slate-700">{getCategoryName(cat)}</span>
                                    </button>
                                ))}
                                <button
                                    onClick={onCreateCategory}
                                    className="p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex flex-col items-center gap-2"
                                >
                                    <div className="text-2xl text-slate-400">+</div>
                                    <span className="text-xs font-bold text-slate-600">{t('expenses.recurringForm.new')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                            <Button type="button" variant="secondary" onClick={handleCloseAttempt} className="flex-1 justify-center">
                                {t('common.cancel')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
