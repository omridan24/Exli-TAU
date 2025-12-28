import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase.js';
import { Button, CategoryIcon } from '../../../components/UI.jsx';
import { CategoryEditorModal } from '../../settings/components/CategoryEditorModal.jsx';
import { ExpensePresetSelector } from './ExpensePresetSelector.jsx';

const PERIOD_PRESETS = [
    { label: '3 Months', count: 3, unit: 'months' },
    { label: '6 Months', count: 6, unit: 'months' },
    { label: '1 Year', count: 1, unit: 'years' },
];

export const RecurringForm = ({ userId, categories, onSave, onCancel, editData = null, onAddCategory }) => {
    const [formData, setFormData] = useState({
        name: editData?.name || '',
        isCustomName: editData ? true : false,
        amount: editData?.amount || '',
        currency: editData?.currency || 'ILS',
        category: editData?.category || '',
        direction: editData?.direction || '',
        pastPeriodCount: editData?.pastPeriodCount || 12,
        pastPeriodUnit: editData?.pastPeriodUnit || 'months',
        futurePeriodCount: editData?.futurePeriodCount || 12,
        futurePeriodUnit: editData?.futurePeriodUnit || 'months',
        frequency: editData?.frequency || { type: 'monthly' },
        notes: editData?.notes || ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [categoryModal, setCategoryModal] = useState(null);
    const [selectedDirection, setSelectedDirection] = useState(editData?.direction || '');
    const [customNameInput, setCustomNameInput] = useState(editData?.name || '');
    const [validationError, setValidationError] = useState('');

    const handlePresetSelect = (name, suggestedCategory) => {
        if (name === 'custom') {
            setFormData({ ...formData, name: '', isCustomName: true });
        } else {
            setFormData({
                ...formData,
                name,
                isCustomName: false,
                category: suggestedCategory || formData.category
            });
        }
    };

    const handleDirectionToggle = (direction) => {
        if (direction === 'past') {
            if (selectedDirection === 'past') {
                setSelectedDirection('');
            } else if (selectedDirection === 'future') {
                setSelectedDirection('both');
            } else if (selectedDirection === 'both') {
                setSelectedDirection('future');
            } else {
                setSelectedDirection('past');
            }
        } else if (direction === 'future') {
            if (selectedDirection === 'future') {
                setSelectedDirection('');
            } else if (selectedDirection === 'past') {
                setSelectedDirection('both');
            } else if (selectedDirection === 'both') {
                setSelectedDirection('past');
            } else {
                setSelectedDirection('future');
            }
        }
        setFormData({ ...formData, direction: selectedDirection });
    };

    const handleSaveCategory = async (categoryData) => {
        if (!categoryData.name.trim()) return;

        try {
            await onAddCategory(categoryData);
            setFormData({ ...formData, category: categoryData.name });
            setCategoryModal(null);
        } catch (err) {
            console.error('Failed to add category:', err);
        }
    };

    const calculateTotalMonths = (count, unit) => {
        if (unit === 'months') return count;
        if (unit === 'years') return count * 12;
        return count;
    };

    const addMonths = (dateStr, monthsToAdd) => {
        const date = new Date(dateStr + '-01');
        date.setMonth(date.getMonth() + monthsToAdd);
        return date.toISOString().slice(0, 7);
    };

    const subtractMonths = (dateStr, monthsToSubtract) => {
        const date = new Date(dateStr + '-01');
        date.setMonth(date.getMonth() - monthsToSubtract);
        return date.toISOString().slice(0, 7);
    };

    const shouldAddToMonth = (targetMonth, startMonth, frequency) => {
        const freq = frequency.type || frequency;

        if (freq === 'monthly') {
            return true;
        }

        const targetDate = new Date(targetMonth + '-01');
        const startDate = new Date(startMonth + '-01');
        const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
            (targetDate.getMonth() - startDate.getMonth());

        if (freq === 'quarterly') {
            return monthsDiff % 3 === 0;
        } else if (freq === 'yearly') {
            return monthsDiff % 12 === 0;
        } else if (freq === 'custom') {
            const intervalMonths = frequency.unit === 'years'
                ? frequency.interval * 12
                : frequency.interval;
            return monthsDiff % intervalMonths === 0;
        }

        return false;
    };

    const validateFrequencyVsPeriod = () => {
        if (!selectedDirection || !formData.frequency) return { valid: true };

        // Check 5-year maximum for past
        if (selectedDirection === 'past' || selectedDirection === 'both') {
            const pastMonths = calculateTotalMonths(formData.pastPeriodCount, formData.pastPeriodUnit);
            if (pastMonths > 60) {
                return {
                    valid: false,
                    error: `Past period cannot exceed 5 years (60 months). You selected ${pastMonths} months.`
                };
            }
        }

        // Check 5-year maximum for future
        if (selectedDirection === 'future' || selectedDirection === 'both') {
            const futureMonths = calculateTotalMonths(formData.futurePeriodCount, formData.futurePeriodUnit);
            if (futureMonths > 60) {
                return {
                    valid: false,
                    error: `Future period cannot exceed 5 years (60 months). You selected ${futureMonths} months.`
                };
            }
        }

        const periodInMonths = selectedDirection === 'future' || selectedDirection === 'both'
            ? calculateTotalMonths(formData.futurePeriodCount, formData.futurePeriodUnit)
            : calculateTotalMonths(formData.pastPeriodCount, formData.pastPeriodUnit);

        let frequencyInMonths;
        const freq = formData.frequency;

        if (freq.type === 'monthly') {
            frequencyInMonths = 1;
        } else if (freq.type === 'quarterly') {
            frequencyInMonths = 3;
        } else if (freq.type === 'yearly') {
            frequencyInMonths = 12;
        } else if (freq.type === 'custom') {
            frequencyInMonths = freq.unit === 'years' ? freq.interval * 12 : freq.interval;
        } else {
            frequencyInMonths = 1;
        }

        if (frequencyInMonths > periodInMonths) {
            return {
                valid: false,
                error: `Frequency interval (${frequencyInMonths} months) cannot exceed the period range (${periodInMonths} months)`
            };
        }

        return { valid: true };
    };

    const calculateExpectedMonths = () => {
        if (!selectedDirection || !formData.frequency) return 0;

        const periodInMonths = selectedDirection === 'future' || selectedDirection === 'both'
            ? calculateTotalMonths(formData.futurePeriodCount, formData.futurePeriodUnit)
            : calculateTotalMonths(formData.pastPeriodCount, formData.pastPeriodUnit);

        const freq = formData.frequency;
        let frequencyInMonths = 1;

        if (freq.type === 'monthly') frequencyInMonths = 1;
        else if (freq.type === 'quarterly') frequencyInMonths = 3;
        else if (freq.type === 'yearly') frequencyInMonths = 12;
        else if (freq.type === 'custom') {
            frequencyInMonths = freq.unit === 'years' ? freq.interval * 12 : freq.interval;
        }

        return Math.floor(periodInMonths / frequencyInMonths) + 1; // +1 for current month
    };

    const getMonthRangeDisplay = () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const formatMonth = (monthStr) => {
            const date = new Date(monthStr + '-01');
            return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        };

        let ranges = [];

        if (selectedDirection === 'past' || selectedDirection === 'both') {
            const totalMonths = calculateTotalMonths(formData.pastPeriodCount, formData.pastPeriodUnit);
            const oldestMonth = subtractMonths(currentMonth, totalMonths);
            ranges.push(`${formatMonth(oldestMonth)} to ${formatMonth(currentMonth)}`);
        }

        if (selectedDirection === 'future' || selectedDirection === 'both') {
            const totalMonths = calculateTotalMonths(formData.futurePeriodCount, formData.futurePeriodUnit);
            const latestMonth = addMonths(currentMonth, totalMonths);
            ranges.push(`${formatMonth(currentMonth)} to ${formatMonth(latestMonth)}`);
        }

        return ranges.join(' and ');
    };

    const applyRecurringToMonths = async (recurringId, recurringData) => {
        const expensesRef = collection(db, 'users', userId, 'expenses');
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthsToAdd = new Map();

        // Add current month first
        monthsToAdd.set(currentMonth, { month: currentMonth, isForecast: false });

        if (recurringData.direction === 'past' || recurringData.direction === 'both') {
            const totalMonths = calculateTotalMonths(
                recurringData.pastPeriodCount,
                recurringData.pastPeriodUnit
            );

            // Start from i=0 to include months properly
            for (let i = 0; i < totalMonths; i++) {
                const targetMonth = subtractMonths(currentMonth, i + 1);
                if (shouldAddToMonth(targetMonth, currentMonth, recurringData.frequency)) {
                    monthsToAdd.set(targetMonth, { month: targetMonth, isForecast: false });
                }
            }
        }

        if (recurringData.direction === 'future' || recurringData.direction === 'both') {
            const totalMonths = calculateTotalMonths(
                recurringData.futurePeriodCount,
                recurringData.futurePeriodUnit
            );

            // Start from i=0 for future months too
            for (let i = 0; i < totalMonths; i++) {
                const targetMonth = addMonths(currentMonth, i + 1);
                if (shouldAddToMonth(targetMonth, currentMonth, recurringData.frequency)) {
                    monthsToAdd.set(targetMonth, { month: targetMonth, isForecast: true });
                }
            }
        }

        for (const { month, isForecast } of monthsToAdd.values()) {
            const expenseId = `recurring_${recurringId}_${month}`;
            const expenseDate = `${month}-01T12:00:00`;

            await setDoc(doc(expensesRef, expenseId), {
                description: recurringData.name,
                amount: recurringData.amount,
                currency: recurringData.currency,
                assignedCategory: recurringData.category,
                date: expenseDate,
                reportMonth: month,
                isRecurring: true,
                isForecast: isForecast,
                recurringExpenseId: recurringId,
                note: recurringData.notes || null,
                source: 'recurring_auto',
                createdAt: serverTimestamp(),
                status: 'active'
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const displayName = formData.isCustomName ? customNameInput : formData.name;
        if (!displayName.trim()) {
            setValidationError('Please enter or select an expense name');
            return;
        }
        if (!formData.amount || formData.amount <= 0) {
            setValidationError('Please enter a valid amount');
            return;
        }
        if (!formData.category) {
            setValidationError('Please select a category');
            return;
        }
        if (!selectedDirection) {
            setValidationError('Please select a direction (past/future/both)');
            return;
        }

        const validation = validateFrequencyVsPeriod();
        if (!validation.valid) {
            setValidationError(validation.error);
            return;
        }

        setIsSaving(true);
        setValidationError('');

        try {
            const finalName = formData.isCustomName ? customNameInput : formData.name;
            const matchPattern = finalName.toLowerCase().replace(/[^a-z0-9]/g, '');

            // Convert frequency object to simple string to avoid React rendering errors
            let frequencyString = 'monthly';
            let customFrequencyInterval = null;
            let customFrequencyUnit = null;

            if (formData.frequency.type === 'monthly') {
                frequencyString = 'monthly';
            } else if (formData.frequency.type === 'quarterly') {
                frequencyString = 'quarterly';
            } else if (formData.frequency.type === 'yearly') {
                frequencyString = 'yearly';
            } else if (formData.frequency.type === 'custom') {
                frequencyString = 'custom';
                customFrequencyInterval = formData.frequency.interval;
                customFrequencyUnit = formData.frequency.unit;
            }

            const recurringData = {
                name: finalName,
                amount: parseFloat(formData.amount),
                currency: formData.currency,
                category: formData.category,
                direction: selectedDirection,
                pastPeriodCount: formData.pastPeriodCount,
                pastPeriodUnit: formData.pastPeriodUnit,
                futurePeriodCount: formData.futurePeriodCount,
                futurePeriodUnit: formData.futurePeriodUnit,
                frequency: frequencyString,  // Save as string, not object!
                customFrequencyInterval,      // Save custom details separately
                customFrequencyUnit,
                notes: formData.notes,
                matchPattern,
                isActive: true,
                source: 'manual',
                lastProcessed: null,
                createdAt: editData ? editData.createdAt : serverTimestamp()
            };

            let recurringId;
            if (editData) {
                await updateDoc(doc(db, 'users', userId, 'recurring_expenses', editData.id), recurringData);
                recurringId = editData.id;
            } else {
                const docRef = await addDoc(collection(db, 'users', userId, 'recurring_expenses'), recurringData);
                recurringId = docRef.id;
            }

            await applyRecurringToMonths(recurringId, recurringData);

            onSave();
        } catch (err) {
            console.error('Save recurring failed:', err);
            setValidationError('Failed to save recurring expense');
        } finally {
            setIsSaving(false);
        }
    };

    const displayName = formData.isCustomName ? customNameInput : formData.name;
    const showPeriodConfig = selectedDirection !== '';

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
                        <h3 className="font-bold text-xl text-slate-800">
                            {editData ? 'Edit' : 'New'} Recurring Expense
                        </h3>
                        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* STEP 1: Expense Name */}
                        <div>
                            {formData.isCustomName ? (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Expense Name *
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={customNameInput}
                                            onChange={e => setCustomNameInput(e.target.value)}
                                            placeholder="e.g., Amazon Prime"
                                            className="flex-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isCustomName: false })}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors"
                                        >
                                            Choose Preset
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <ExpensePresetSelector
                                    selectedName={formData.name}
                                    onSelect={handlePresetSelect}
                                />
                            )}
                        </div>

                        {/* STEP 2: Amount, Currency, Category */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Amount *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
                                <select
                                    value={formData.currency}
                                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    <option value="ILS">ILS (₪)</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                            </div>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">Category *</label>
                            <div className="grid grid-cols-4 gap-3">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, category: cat.name })}
                                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.category === cat.name
                                            ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                            : 'border-slate-200 hover:border-emerald-300'
                                            }`}
                                    >
                                        <CategoryIcon iconName={cat.icon} color={cat.color} className="w-6 h-6" />
                                        <span className="text-xs font-bold text-slate-700">{cat.name}</span>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setCategoryModal({ name: '', icon: 'wallet', color: '#10b981' })}
                                    className="p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex flex-col items-center gap-2"
                                >
                                    <div className="text-2xl">+</div>
                                    <span className="text-xs font-bold text-slate-600">New</span>
                                </button>
                            </div>
                        </div>

                        {/* STEP 3: Direction */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">Apply To *</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleDirectionToggle('past')}
                                    className={`p-6 rounded-xl border-2 transition-all ${selectedDirection === 'past' || selectedDirection === 'both'
                                        ? 'border-purple-500 bg-purple-50 shadow-md'
                                        : 'border-slate-200 hover:border-purple-300'
                                        }`}
                                >
                                    <div className="text-3xl mb-2">⏮️</div>
                                    <div className="font-bold text-slate-800 mb-1">This + Past Months</div>
                                    <div className="text-xs text-slate-600">Add to current and previous months</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDirectionToggle('future')}
                                    className={`p-6 rounded-xl border-2 transition-all ${selectedDirection === 'future' || selectedDirection === 'both'
                                        ? 'border-blue-500 bg-blue-50 shadow-md'
                                        : 'border-slate-200 hover:border-blue-300'
                                        }`}
                                >
                                    <div className="text-3xl mb-2">▶️</div>
                                    <div className="font-bold text-slate-800 mb-1">This + Future Months</div>
                                    <div className="text-xs text-slate-600">Forecast upcoming months</div>
                                </button>
                            </div>
                        </div>

                        {/* STEP 4: Inline Period Configuration */}
                        {showPeriodConfig && (
                            <div className="border-t border-slate-200 pt-6 space-y-6">
                                {/* Past Period Section */}
                                {(selectedDirection === 'past' || selectedDirection === 'both') && (
                                    <div>
                                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                            ⏮️ How far back? (Range)
                                        </h4>
                                        <div className="grid grid-cols-4 gap-2 mb-3">
                                            {PERIOD_PRESETS.map(preset => (
                                                <button
                                                    key={`past-${preset.label}`}
                                                    type="button"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        pastPeriodCount: preset.count,
                                                        pastPeriodUnit: preset.unit
                                                    })}
                                                    className={`p-4 rounded-xl border-2 transition-all ${formData.pastPeriodCount === preset.count && formData.pastPeriodUnit === preset.unit
                                                        ? 'border-purple-500 bg-purple-50 shadow-md text-purple-900'
                                                        : 'border-slate-200 bg-white hover:border-purple-300 text-slate-700'
                                                        }`}
                                                >
                                                    <div className="font-bold text-sm">{preset.label}</div>
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, pastPeriodCount: 12, pastPeriodUnit: 'months' })} // Default to 12 months for custom
                                                className={`p-4 rounded-xl border-2 transition-all ${!PERIOD_PRESETS.some(p => p.count === formData.pastPeriodCount && p.unit === formData.pastPeriodUnit)
                                                    ? 'border-purple-500 bg-purple-50 shadow-md text-purple-900'
                                                    : 'border-slate-200 bg-white hover:border-purple-300 text-slate-700'
                                                    }`}
                                            >
                                                <div className="font-bold text-sm">✏️ Custom</div>
                                            </button>
                                        </div>
                                        {!PERIOD_PRESETS.some(p => p.count === formData.pastPeriodCount && p.unit === formData.pastPeriodUnit) && (
                                            <div className="mt-3 flex gap-2 items-center bg-purple-50 p-3 rounded-xl border-2 border-purple-200">
                                                <span className="text-sm font-medium">Every</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    value={formData.pastPeriodCount}
                                                    onChange={e => {
                                                        const val = Math.min(parseInt(e.target.value) || 1, 60);
                                                        setFormData({ ...formData, pastPeriodCount: val });
                                                    }}
                                                    className="w-16 p-2 border border-slate-300 rounded-lg text-center font-bold"
                                                />
                                                <select
                                                    value={formData.pastPeriodUnit}
                                                    onChange={e => setFormData({ ...formData, pastPeriodUnit: e.target.value })}
                                                    className="flex-1 p-2 border border-slate-300 rounded-lg font-medium"
                                                >
                                                    <option value="months">Months</option>
                                                    <option value="years">Years</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Future Period Section */}
                                {(selectedDirection === 'future' || selectedDirection === 'both') && (
                                    <div>
                                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                            ▶️ How far forward? (Range)
                                        </h4>
                                        <div className="grid grid-cols-4 gap-2 mb-3">
                                            {PERIOD_PRESETS.map(preset => (
                                                <button
                                                    key={`future-${preset.label}`}
                                                    type="button"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        futurePeriodCount: preset.count,
                                                        futurePeriodUnit: preset.unit
                                                    })}
                                                    className={`p-4 rounded-xl border-2 transition-all ${formData.futurePeriodCount === preset.count && formData.futurePeriodUnit === preset.unit
                                                        ? 'border-blue-500 bg-blue-50 shadow-md text-blue-900'
                                                        : 'border-slate-200 bg-white hover:border-blue-300 text-slate-700'
                                                        }`}
                                                >
                                                    <div className="font-bold text-sm">{preset.label}</div>
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, futurePeriodCount: 12, futurePeriodUnit: 'months' })} // Default to 12 months for custom
                                                className={`p-4 rounded-xl border-2 transition-all ${!PERIOD_PRESETS.some(p => p.count === formData.futurePeriodCount && p.unit === formData.futurePeriodUnit)
                                                    ? 'border-blue-500 bg-blue-50 shadow-md text-blue-900'
                                                    : 'border-slate-200 bg-white hover:border-blue-300 text-slate-700'
                                                    }`}
                                            >
                                                <div className="font-bold text-sm">✏️ Custom</div>
                                            </button>
                                        </div>
                                        {!PERIOD_PRESETS.some(p => p.count === formData.futurePeriodCount && p.unit === formData.futurePeriodUnit) && (
                                            <div className="mt-3 flex gap-2 items-center bg-blue-50 p-3 rounded-xl border-2 border-blue-200">
                                                <span className="text-sm font-medium">Every</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    value={formData.futurePeriodCount}
                                                    onChange={e => {
                                                        const val = Math.min(parseInt(e.target.value) || 1, 60);
                                                        setFormData({ ...formData, futurePeriodCount: val });
                                                    }}
                                                    className="w-16 p-2 border border-slate-300 rounded-lg text-center font-bold"
                                                />
                                                <select
                                                    value={formData.futurePeriodUnit}
                                                    onChange={e => setFormData({ ...formData, futurePeriodUnit: e.target.value })}
                                                    className="flex-1 p-2 border border-slate-300 rounded-lg font-medium"
                                                >
                                                    <option value="months">Months</option>
                                                    <option value="years">Years</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Frequency Selection */}
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        📅 How often does it recur? (Frequency)
                                    </h4>
                                    <div className="grid grid-cols-4 gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, frequency: { type: 'monthly' } })}
                                            className={`p-4 rounded-xl border-2 transition-all ${formData.frequency.type === 'monthly'
                                                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                                : 'border-slate-200 hover:border-emerald-300'
                                                }`}
                                        >
                                            <div className="font-bold text-sm">Monthly</div>
                                            <div className="text-xs text-slate-500 mt-1">Every month</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, frequency: { type: 'quarterly' } })}
                                            className={`p-4 rounded-xl border-2 transition-all ${formData.frequency.type === 'quarterly'
                                                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                                : 'border-slate-200 hover:border-emerald-300'
                                                }`}
                                        >
                                            <div className="font-bold text-sm">Quarterly</div>
                                            <div className="text-xs text-slate-500 mt-1">Every 3 months</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, frequency: { type: 'yearly' } })}
                                            className={`p-4 rounded-xl border-2 transition-all ${formData.frequency.type === 'yearly'
                                                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                                : 'border-slate-200 hover:border-emerald-300'
                                                }`}
                                        >
                                            <div className="font-bold text-sm">Yearly</div>
                                            <div className="text-xs text-slate-500 mt-1">Once a year</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({
                                                ...formData,
                                                frequency: { type: 'custom', interval: 2, unit: 'months' }
                                            })}
                                            className={`p-4 rounded-xl border-2 transition-all ${formData.frequency.type === 'custom'
                                                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                                : 'border-slate-200 hover:border-emerald-300'
                                                }`}
                                        >
                                            <div className="font-bold text-sm">✏️ Custom</div>
                                            <div className="text-xs text-slate-500 mt-1">Set interval</div>
                                        </button>
                                    </div>

                                    {/* Custom Frequency Input */}
                                    {formData.frequency.type === 'custom' && (
                                        <div className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border-2 border-emerald-200">
                                            <span className="text-sm font-medium">Every</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="24"
                                                value={formData.frequency.interval || 2}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    frequency: {
                                                        ...formData.frequency,
                                                        interval: parseInt(e.target.value) || 1
                                                    }
                                                })}
                                                className="w-16 p-2 border border-slate-300 rounded-lg text-center font-bold"
                                            />
                                            <select
                                                value={formData.frequency.unit || 'months'}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    frequency: { ...formData.frequency, unit: e.target.value }
                                                })}
                                                className="flex-1 p-2 border border-slate-300 rounded-lg font-medium"
                                            >
                                                <option value="months">Months</option>
                                                <option value="years">Years</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Summary */}
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                                    <div className="font-bold text-green-900 mb-2 flex items-center gap-2">
                                        📊 Summary
                                    </div>
                                    <div className="text-sm text-green-800 space-y-1">
                                        <div className="font-bold text-green-900">📆 Months Covered:</div>
                                        <div className="pl-4 text-xs">{getMonthRangeDisplay()}</div>

                                        <div className="border-t border-green-200 pt-2 mt-2">
                                            📅 Frequency: {
                                                formData.frequency.type === 'monthly' ? 'Monthly (every month)' :
                                                    formData.frequency.type === 'quarterly' ? 'Quarterly (every 3 months)' :
                                                        formData.frequency.type === 'yearly' ? 'Yearly (every 12 months)' :
                                                            `Every ${formData.frequency.interval} ${formData.frequency.unit}`
                                            }
                                        </div>
                                        <div className="font-bold text-green-700">
                                            ✅ Will add to approximately {calculateExpectedMonths()} months
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Validation Error */}
                        {validationError && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-red-700">{validationError}</span>
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                rows={3}
                                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                placeholder="Additional notes..."
                            />
                        </div>

                        {/* Submit */}
                        <div className="flex gap-3 pt-4">
                            <Button type="submit" disabled={isSaving} className="flex-1">
                                {isSaving ? 'Saving...' : editData ? 'Update Expense' : 'Save Recurring Expense'}
                            </Button>
                            <Button type="button" variant="secondary" onClick={onCancel}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Category Editor Modal */}
            {categoryModal && (
                <CategoryEditorModal
                    category={categoryModal}
                    onClose={() => setCategoryModal(null)}
                    onSave={handleSaveCategory}
                />
            )}
        </>
    );
};
