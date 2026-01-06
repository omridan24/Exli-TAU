import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase.js';
import { Button } from '../../../components/UI.jsx';
import { LogoImage } from './LogoImage.jsx';
import { calculateMarginalTax, getTaxBracketDescription, calculateAdditionalTaxes } from '../../../utils/taxCalculator.js';
import { getTaxConfig } from '../../../config/taxBrackets.js';
import { TaxBracketGraph } from './TaxBracketGraph.jsx';
import { MismatchAlert } from './MismatchAlert.jsx';
import { ExtractionSummary } from './ExtractionSummary.jsx';


const PENSION_PERCENTAGES = [6.0, 6.5, 7.0, 7.5, 8.0, 8.33, 8.5];

// Helper Component for Editing Values
const EditValuePopover = ({ initialValue, onSave, onCancel, title, saveLabel, cancelLabel }) => {
    const { t } = useTranslation();
    const [val, setVal] = useState(initialValue);

    // Auto-select text on mount
    const inputRef = React.useRef(null);
    useEffect(() => {
        if (inputRef.current) inputRef.current.select();
    }, []);

    return (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white shadow-xl rounded-xl border border-slate-200 p-4 w-64 animate-in fade-in zoom-in-95 duration-200">
            <h5 className="text-xs font-bold text-slate-500 mb-2 uppercase">{title}</h5>
            <input
                ref={inputRef}
                type="number"
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') onSave(parseFloat(val));
                    if (e.key === 'Escape') onCancel();
                }}
                className="w-full p-2 border border-slate-300 rounded-lg mb-3 text-lg font-bold text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
                autoFocus
            />
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onSave(parseFloat(val))}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg font-bold text-sm transition-colors"
                >
                    {saveLabel || t('income.recurringForm.save')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                    {cancelLabel || t('common.cancel')}
                </button>
            </div>
            {/* Arrow */}
            <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-t border-l border-slate-200 transform rotate-45"></div>
        </div>
    );
};

export const RecurringIncomeForm = ({ userId, workplaces, currency, onSave, onCancel, editData = null, extractedData }) => {
    const { t, i18n } = useTranslation();

    const PERIOD_PRESETS = [
        { label: t('income.recurringForm.periodPresets.3months'), count: 3, unit: 'months' },
        { label: t('income.recurringForm.periodPresets.6months'), count: 6, unit: 'months' },
        { label: t('income.recurringForm.periodPresets.1year'), count: 1, unit: 'years' },
        { label: t('income.recurringForm.periodPresets.2years'), count: 2, unit: 'years' }
    ];
    const [formData, setFormData] = useState({
        workplaceName: editData?.workplaceName || '',
        occupation: editData?.occupation || '',
        grossAmount: editData?.grossAmount || '',
        netAmount: editData?.netAmount || '',
        currency: editData?.currency || currency || 'ILS',
        employeePct: editData?.employeePct || 6.0,
        employerPct: editData?.employerPct || 6.5,
        severancePct: editData?.severancePct || 8.33,
        expectedPension: editData?.expectedPension || 0,
        frequency: editData?.frequency || 'monthly',
        direction: editData?.direction || '',
        pastPeriodCount: editData?.pastPeriodCount || 12,
        pastPeriodUnit: editData?.pastPeriodUnit || 'months',
        futurePeriodCount: editData?.futurePeriodCount || 12,
        futurePeriodUnit: editData?.futurePeriodUnit || 'months',
        workplaceLogo: editData?.workplaceLogo || '',
        workplaceDomain: editData?.workplaceDomain || ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [selectedDirection, setSelectedDirection] = useState(editData?.direction || '');
    const [validationError, setValidationError] = useState('');
    const [employeeCustom, setEmployeeCustom] = useState(false);
    const [employerCustom, setEmployerCustom] = useState(false);
    const [userCountry, setUserCountry] = useState('Israel');
    const [taxCreditPoints, setTaxCreditPoints] = useState(2.25);
    const [calculatedTax, setCalculatedTax] = useState(0);
    const [taxBracketInfo, setTaxBracketInfo] = useState(null);
    const [additionalTaxes, setAdditionalTaxes] = useState({ total: 0, breakdown: [] });
    const [customEmployeePcts, setCustomEmployeePcts] = useState([]);
    const [customEmployerPcts, setCustomEmployerPcts] = useState([]);
    const [customSeverancePcts, setCustomSeverancePcts] = useState([]);
    const [severanceCustom, setSeveranceCustom] = useState(false);
    const [customPastPeriods, setCustomPastPeriods] = useState([]);
    const [customFuturePeriods, setCustomFuturePeriods] = useState([]);
    const [isPastCustom, setIsPastCustom] = useState(false);
    const [isFutureCustom, setIsFutureCustom] = useState(false);
    const [hasPension, setHasPension] = useState(true);
    const [hasOtherDeposits, setHasOtherDeposits] = useState(
        (editData?.otherDepositEmployeePct || 0) > 0 || (editData?.otherDepositEmployerPct || 0) > 0
    );
    const [hasTax, setHasTax] = useState(true);
    const [showFullForm, setShowFullForm] = useState(false);
    const [manualOverrides, setManualOverrides] = useState(editData?.manualOverrides || {});
    const [editingField, setEditingField] = useState(null);

    // Other Deposits State
    const [otherDepositEmployeePct, setOtherDepositEmployeePct] = useState(editData?.otherDepositEmployeePct || 0);
    const [otherDepositEmployerPct, setOtherDepositEmployerPct] = useState(editData?.otherDepositEmployerPct || 0);
    const [otherEmployeeCustom, setOtherEmployeeCustom] = useState(false);
    const [otherEmployerCustom, setOtherEmployerCustom] = useState(false);
    const [customOtherEmployeePcts, setCustomOtherEmployeePcts] = useState([]);
    const [customOtherEmployerPcts, setCustomOtherEmployerPcts] = useState([]);


    const handleMismatchResolution = (key, value) => {
        const newOverrides = { ...manualOverrides, [key]: value };
        setManualOverrides(newOverrides);

        // NOTE: We don't need to manually setFormData.netAmount here because the 
        // useEffect monitoring `manualOverrides` will trigger and recalculate it automatically
        // using the new tax/pension values.

        if (key === 'neto') {
            setFormData(prev => ({ ...prev, netAmount: value }));
        }
    };

    // Clear validation error on change
    useEffect(() => {
        if (validationError) setValidationError('');
    }, [formData.workplaceName, formData.grossAmount]);

    // Fetch user's country and tax credit points
    useEffect(() => {
        const fetchUserTaxSettings = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setUserCountry(data.profile?.country || 'Israel');
                    setTaxCreditPoints(data.profile?.taxCreditPoints || 2.25);
                }
            } catch (err) {
                console.error('Failed to fetch user tax settings:', err);
            }
        };
        if (userId) fetchUserTaxSettings();
    }, [userId]);

    // Pre-fill from extractedData
    useEffect(() => {
        if (extractedData && !editData) {
            setFormData(prev => ({
                ...prev,
                grossAmount: extractedData.bruto || prev.grossAmount,
            }));
        }
    }, [extractedData, editData]);

    // Auto-calculate expected tax (MONTHLY input → ANNUAL calc → MONTHLY result)
    useEffect(() => {
        if (!hasTax) {
            setCalculatedTax(0);
            setAdditionalTaxes({ total: 0, breakdown: [] });
            setTaxBracketInfo(null);
            return;
        }

        if (formData.grossAmount && userCountry) {
            const monthlyGross = parseFloat(formData.grossAmount);
            const annualGross = monthlyGross * 12; // Convert to annual

            const taxConfig = getTaxConfig(userCountry);
            if (taxConfig) {
                const taxResult = calculateMarginalTax(
                    annualGross,
                    taxConfig.brackets,
                    taxCreditPoints,
                    taxConfig.creditValuePerPoint
                );

                setCalculatedTax(taxResult.monthlyTax);
                setTaxBracketInfo(taxResult);
            }

            // Calculate additional taxes (Health Tax, National Insurance, etc.)
            if (taxConfig?.additionalTaxes) {
                const additionalResult = calculateAdditionalTaxes(
                    monthlyGross,
                    taxConfig.additionalTaxes
                );
                setAdditionalTaxes(additionalResult);
            }
        }
    }, [formData.grossAmount, userCountry, taxCreditPoints, hasTax]);

    // Auto-calculate expected pension (employee + employer + severance)
    useEffect(() => {
        if (formData.grossAmount) {
            const gross = parseFloat(formData.grossAmount);
            const empPct = parseFloat(formData.employeePct) || 0;
            const workPct = parseFloat(formData.employerPct) || 0;
            const sevPct = parseFloat(formData.severancePct) || 0;
            const total = Math.round(gross * ((empPct + workPct + sevPct) / 100));

            // Only update if different to prevent unnecessary re-renders
            if (total !== formData.expectedPension) {
                setFormData(prev => ({ ...prev, expectedPension: total }));
            }
        }
    }, [formData.grossAmount, formData.employeePct, formData.employerPct, formData.severancePct]);

    // Auto-calculate Neto from Bruto - Tax - Employee Pension - Other Deposits
    useEffect(() => {
        // If Net is explicitly overridden, don't auto-calculate
        if (manualOverrides.neto !== undefined) {
            if (formData.netAmount !== manualOverrides.neto) {
                setFormData(prev => ({ ...prev, netAmount: manualOverrides.neto }));
            }
            return;
        }

        if (formData.grossAmount) {
            const gross = parseFloat(formData.grossAmount);

            // 1. Employee Pension
            const pension = manualOverrides.pension_employee !== undefined
                ? manualOverrides.pension_employee
                : Math.round(gross * (formData.employeePct / 100));

            // 2. Taxes (Income + Health + National)
            const incomeTax = manualOverrides.tax_income !== undefined ? manualOverrides.tax_income : calculatedTax;
            const healthTax = manualOverrides.tax_health !== undefined
                ? manualOverrides.tax_health
                : (additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0);
            const nationalTax = manualOverrides.tax_national !== undefined
                ? manualOverrides.tax_national
                : (additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0);

            const totalTaxes = incomeTax + healthTax + nationalTax;

            // 3. Other Deposits (Employee Only reduces net)
            const otherDeposits = manualOverrides.other_deposit_employee !== undefined
                ? manualOverrides.other_deposit_employee
                : Math.round(gross * (otherDepositEmployeePct / 100));

            const totalDeductions = totalTaxes + pension + otherDeposits;
            const autoNeto = Math.max(0, Math.round(gross - totalDeductions));

            // Only update if different to prevent unnecessary re-renders
            if (autoNeto !== formData.netAmount) {
                setFormData(prev => ({ ...prev, netAmount: autoNeto }));
            }
        }
    }, [formData.grossAmount, calculatedTax, additionalTaxes, formData.employeePct, manualOverrides, otherDepositEmployeePct]);
    // NOTE: NOT including employerPct - employer pension doesn't reduce take-home!

    const handleWorkplaceSelect = (workplace) => {
        setFormData(prev => ({
            ...prev,
            workplaceName: workplace.name,
            occupation: workplace.linkedOccupation,
            workplaceLogo: workplace.logo || '',
            workplaceDomain: workplace.domain || ''
        }));
    };

    const handleDirectionToggle = (direction) => {
        let newDirection = selectedDirection;
        if (direction === 'past') {
            if (selectedDirection === 'past') newDirection = '';
            else if (selectedDirection === 'future') newDirection = 'both';
            else if (selectedDirection === 'both') newDirection = 'future';
            else newDirection = 'past';
        } else if (direction === 'future') {
            if (selectedDirection === 'future') newDirection = '';
            else if (selectedDirection === 'past') newDirection = 'both';
            else if (selectedDirection === 'both') newDirection = 'past';
            else newDirection = 'future';
        }
        setSelectedDirection(newDirection);
        setFormData({ ...formData, direction: newDirection });
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
        const incomeRef = collection(db, 'users', userId, 'income');
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthsToAdd = new Map();

        // Add current month first
        monthsToAdd.set(currentMonth, { month: currentMonth, isForecast: false });

        if (recurringData.direction === 'past' || recurringData.direction === 'both') {
            const totalMonths = calculateTotalMonths(
                recurringData.pastPeriodCount,
                recurringData.pastPeriodUnit
            );

            for (let i = 0; i < totalMonths; i++) {
                const targetMonth = subtractMonths(currentMonth, i + 1);
                monthsToAdd.set(targetMonth, { month: targetMonth, isForecast: false });
            }
        }

        if (recurringData.direction === 'future' || recurringData.direction === 'both') {
            const totalMonths = calculateTotalMonths(
                recurringData.futurePeriodCount,
                recurringData.futurePeriodUnit
            );

            for (let i = 0; i < totalMonths; i++) {
                const targetMonth = addMonths(currentMonth, i + 1);
                monthsToAdd.set(targetMonth, { month: targetMonth, isForecast: true });
            }
        }

        for (const { month, isForecast } of monthsToAdd.values()) {
            const incomeId = `recurring_${recurringId}_${month}`;

            await setDoc(doc(incomeRef, incomeId), {
                source_name: `${recurringData.occupation} at ${recurringData.workplaceName}`,
                bruto: recurringData.grossAmount,
                neto: recurringData.netAmount,
                pension: recurringData.expectedPension,
                taxes: recurringData.grossAmount - recurringData.netAmount - recurringData.expectedPension,
                other_deposits: 0,
                month: month,
                currency: recurringData.currency,
                isRecurring: true,
                isForecast: isForecast,
                recurringIncomeId: recurringId,
                source: 'recurring_auto',
                createdAt: serverTimestamp()
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.workplaceName.trim()) {
            setValidationError(t('income.recurringForm.validation.selectWorkplace'));
            return;
        }
        if (!formData.grossAmount || formData.grossAmount <= 0) {
            setValidationError(t('income.recurringForm.validation.enterValidGross'));
            return;
        }
        if (!formData.netAmount || formData.netAmount <= 0) {
            setValidationError(t('income.recurringForm.validation.enterValidNet'));
            return;
        }
        if (!selectedDirection) {
            setValidationError(t('income.recurringForm.validation.selectDirection'));
            return;
        }

        setIsSaving(true);
        setValidationError('');

        try {
            const recurringData = {
                workplaceName: formData.workplaceName,
                occupation: formData.occupation,
                grossAmount: parseFloat(formData.grossAmount),
                netAmount: parseFloat(formData.netAmount),
                currency: formData.currency,
                employeePct: parseFloat(formData.employeePct),
                employerPct: parseFloat(formData.employerPct),
                expectedPension: formData.expectedPension,
                frequency: formData.frequency,
                direction: selectedDirection,
                pastPeriodCount: formData.pastPeriodCount,
                pastPeriodUnit: formData.pastPeriodUnit,
                futurePeriodCount: formData.futurePeriodCount,
                futurePeriodUnit: formData.futurePeriodUnit,
                workplaceLogo: formData.workplaceLogo,
                workplaceDomain: formData.workplaceDomain,
                isActive: true,
                source: 'manual',
                serverTimestamp: serverTimestamp(),
                manualOverrides: manualOverrides,
                otherDeposits: {
                    employeePct: otherDepositEmployeePct,
                    employerPct: otherDepositEmployerPct,
                    totalMonthly: Math.round(formData.grossAmount * ((otherDepositEmployeePct + otherDepositEmployerPct) / 100))
                }
            };

            let recurringId;
            if (editData) {
                await updateDoc(doc(db, 'users', userId, 'recurring_income', editData.id), recurringData);
                recurringId = editData.id;
            } else {
                const docRef = await addDoc(collection(db, 'users', userId, 'recurring_income'), recurringData);
                recurringId = docRef.id;
            }

            await applyRecurringToMonths(recurringId, recurringData);

            onSave();
        } catch (err) {
            console.error('Save recurring income failed:', err);
            setValidationError(t('income.recurringForm.validation.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const PercentageRow = ({ label, value, onChange, color, isCustom, setIsCustom, customList, setCustomList }) => {
        const [customInput, setCustomInput] = useState('');

        const handleApproveCustom = () => {
            const pct = parseFloat(customInput);
            if (!isNaN(pct) && pct >= 0 && pct <= 100) {
                // Add to custom list if not already there
                if (!customList.includes(pct)) {
                    setCustomList([...customList, pct]);
                }
                onChange(pct);
                setIsCustom(false);
                setCustomInput('');
            }
        };

        return (
            <div className="mb-3">
                <label className={`text-[10px] font-bold uppercase tracking-wider mb-2 block ${color}`}>
                    {label} ({value}%)
                </label>
                {isCustom ? (
                    <div className="flex gap-2 items-center">
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="15"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleApproveCustom()}
                            className="flex-1 p-2 border border-slate-300 rounded-lg text-center font-bold"
                            placeholder="%"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleApproveCustom}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors text-xl"
                        >
                            ✓
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsCustom(false); setCustomInput(''); }}
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-medium transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {/* Standard presets */}
                        {PENSION_PERCENTAGES.map(pct => (
                            <button
                                key={pct}
                                type="button"
                                onClick={() => onChange(pct)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${value === pct
                                    ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                            >
                                {pct}%
                            </button>
                        ))}

                        {/* Custom percentages */}
                        {customList.map(pct => (
                            <button
                                key={`custom-${pct}`}
                                type="button"
                                onClick={() => onChange(pct)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${value === pct
                                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-md'
                                    : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:border-emerald-400'
                                    }`}
                            >
                                {pct}% ⭐
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => setIsCustom(true)}
                            className="px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 text-xs font-medium"
                        >
                            ✏️ {t('income.recurringForm.custom')}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // Period Selector Component with Custom Input
    const PeriodSelector = ({ label, value, onChange, customList, setCustomList, isCustom, setIsCustom }) => {
        const [customInput, setCustomInput] = useState({ count: '', unit: 'months' });

        const handleApproveCustom = () => {
            const count = parseInt(customInput.count);
            const unit = customInput.unit;

            if (!count || count <= 0) return;

            // Enforce 5-year (60 months) limit
            const totalMonths = unit === 'years' ? count * 12 : count;
            if (totalMonths > 60) {
                alert(t('income.recurringForm.validation.maxPeriod'));
                return;
            }

            const periodObj = { count, unit };
            const exists = customList.some(p => p.count === count && p.unit === unit);
            if (!exists) {
                setCustomList([...customList, periodObj]);
            }
            onChange(periodObj);
            setIsCustom(false);
            setCustomInput({ count: '', unit: 'months' });
        };

        return (
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>

                {isCustom ? (
                    <div className="flex gap-2 items-center">
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={customInput.count}
                            onChange={(e) => setCustomInput({ ...customInput, count: e.target.value })}
                            onKeyPress={(e) => e.key === 'Enter' && handleApproveCustom()}
                            className="w-24 p-2 border border-slate-300 rounded-lg text-center font-bold"
                            placeholder={t('income.recurringForm.count')}
                            autoFocus
                        />
                        <select
                            value={customInput.unit}
                            onChange={(e) => setCustomInput({ ...customInput, unit: e.target.value })}
                            className="p-2 border border-slate-300 rounded-lg font-medium"
                        >
                            <option value="months">{t('income.recurringForm.months')}</option>
                            <option value="years">{t('income.recurringForm.years')}</option>
                        </select>
                        <button
                            type="button"
                            onClick={handleApproveCustom}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xl"
                        >
                            ✓
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsCustom(false); setCustomInput({ count: '', unit: 'months' }); }}
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {PERIOD_PRESETS.map(preset => (
                            <button
                                key={`${preset.count}-${preset.unit}`}
                                type="button"
                                onClick={() => onChange({ count: preset.count, unit: preset.unit })}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${value.count === preset.count && value.unit === preset.unit
                                    ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'
                                    }`}
                            >
                                {preset.label}
                            </button>
                        ))}

                        {customList.map((period, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => onChange(period)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${value.count === period.count && value.unit === period.unit
                                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-md'
                                    : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:border-emerald-400'
                                    }`}
                            >
                                {formatPeriod(period.count, period.unit)} ⭐
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => setIsCustom(true)}
                            className="px-4 py-2 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 text-sm font-medium"
                        >
                            ✏️ {t('income.recurringForm.custom')}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const showPeriodConfig = selectedDirection !== '';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                        <Repeat className="w-5 h-5 text-teal-600" />
                        {editData ? 'Edit' : 'New'} Recurring Income
                    </h3>
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Extraction Summary (if data exists) */}
                    {extractedData && <ExtractionSummary extractedData={extractedData} />}

                    {/* Workplace Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t('income.recurringForm.workplace')}</label>
                        {workplaces.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                {workplaces.map((w, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleWorkplaceSelect(w)}
                                        className={`flex items-center gap-3 p-3 rounded-2xl text-left border transition-all hover:shadow-md ${formData.workplaceName === w.name
                                            ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500'
                                            : 'bg-white border-slate-100 hover:border-teal-200'
                                            }`}
                                    >
                                        <LogoImage logo={w.logo} domain={w.domain} className="w-10 h-10 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className={`text-xs font-black truncate uppercase tracking-tighter ${formData.workplaceName === w.name ? 'text-teal-700' : 'text-slate-400'
                                                }`}>
                                                {w.linkedOccupation}
                                            </div>
                                            <div className="text-sm font-bold text-slate-700 truncate">at {w.name}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        <input
                            type="text"
                            value={formData.workplaceName}
                            onChange={(e) => setFormData({ ...formData, workplaceName: e.target.value })}
                            placeholder={t('income.recurringForm.orEnterWorkplace')}
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                    </div>

                    {/* Gross Salary */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Monthly Gross Salary (Bruto) *</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.grossAmount}
                            onChange={(e) => setFormData({ ...formData, grossAmount: e.target.value })}
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                            required
                        />
                        <div className="text-xs text-slate-500 mt-1">Monthly amount (we'll calculate annual for tax)</div>
                    </div>

                    {/* Tax Calculator - FIXED: Shows for any gross amount, not just high values */}
                    {formData.grossAmount > 0 && (
                        <div className={`border-2 rounded-xl p-4 transition-colors ${hasTax ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className={`font-bold flex items-center gap-2 ${hasTax ? 'text-orange-900' : 'text-slate-500'}`}>
                                    🏛️ Tax Calculator ({userCountry})
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setHasTax(!hasTax)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${hasTax
                                        ? 'bg-orange-600 text-white shadow-sm hover:bg-orange-700'
                                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                        }`}
                                >
                                    {hasTax ? t('income.recurringForm.taxableIncome') : t('income.recurringForm.taxFree')}
                                </button>
                            </div>

                            {hasTax ? (
                                <>

                                    {/* Tax Bracket Visual Graph */}
                                    <TaxBracketGraph
                                        annualIncome={parseFloat(formData.grossAmount || 0) * 12}
                                        brackets={getTaxConfig(userCountry)?.brackets}
                                        currency={formData.currency}
                                        effectiveRate={taxBracketInfo?.effectiveRate || 0}
                                        taxBreakdown={taxBracketInfo?.breakdown || []}
                                    />

                                    {/* Tax Details */}
                                    <div className="mt-4 space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-orange-700">{t('income.recurringForm.taxCreditPoints')}</span>
                                            <span className="font-mono font-bold text-orange-900">{taxCreditPoints}</span>
                                        </div>

                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-orange-700">{t('income.recurringForm.monthlyGross')}</span>
                                            <span className="font-mono text-emerald-700 font-bold">
                                                {parseFloat(formData.grossAmount).toLocaleString()} {formData.currency}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center text-xs text-orange-600">
                                            <span>{t('income.recurringForm.annualGross')}</span>
                                            <span className="font-mono">
                                                {(parseFloat(formData.grossAmount) * 12).toLocaleString()} {formData.currency}
                                            </span>
                                        </div>

                                        {/* Divider */}
                                        <div className="border-t-2 border-orange-300 my-3"></div>

                                        {/* Income Tax */}
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-orange-800">{t('income.recurringForm.incomeTax')}</span>
                                            <span className="font-mono font-bold text-orange-900">
                                                {(manualOverrides.tax_income !== undefined ? manualOverrides.tax_income : calculatedTax).toLocaleString()} {formData.currency}
                                                {manualOverrides.tax_income !== undefined && <span className="text-[10px] text-amber-600 ml-1">{t('income.recurringForm.edited')}</span>}
                                            </span>
                                        </div>

                                        {/* Additional Taxes */}
                                        {additionalTaxes.breakdown.map((tax, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-sm">
                                                <span className="text-orange-700">
                                                    {tax.name.includes('Health') ? t('income.recurringForm.healthTax') :
                                                        tax.name.includes('National') ? t('income.recurringForm.nationalInsurance') :
                                                            tax.name}:
                                                </span>
                                                <span className="font-mono text-orange-800">
                                                    {tax.amount.toLocaleString()} {formData.currency}
                                                    <span className="text-xs text-orange-600 ml-2">
                                                        ({(tax.rate * 100).toFixed(1)}%)
                                                    </span>
                                                </span>
                                            </div>
                                        ))}

                                        {/* Total Monthly Taxes */}
                                        <div className="mt-4 pt-4 border-t-2 border-orange-300">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-orange-900">{t('income.recurringForm.totalMonthlyTaxes')}</span>
                                                <span className="text-2xl font-mono font-black text-orange-600">
                                                    {(
                                                        (manualOverrides.tax_income ?? calculatedTax) +
                                                        (manualOverrides.tax_health ?? (additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0)) +
                                                        (manualOverrides.tax_national ?? (additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0))
                                                    ).toLocaleString()} {formData.currency}
                                                </span>
                                            </div>
                                            <div className="text-xs text-orange-600 mt-1 text-right">
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mismatch Alerts for Taxes */}
                                    {extractedData && (
                                        <div className="mt-4 space-y-2">
                                            {/* Credit Points Mismatch */}
                                            <MismatchAlert
                                                label={t('income.recurringForm.taxCreditPoints')}
                                                actual={extractedData.credit_points ?? 0}
                                                expected={taxCreditPoints}
                                                currency="pts"
                                                fieldKey="credit_points"
                                                onResolve={(key, val) => {
                                                    // For credit points, we typically update the user settings or a local override
                                                    // Since we don't have a direct form field for this in the same way, 
                                                    // we might just want to update the local state to recalculate.
                                                    setTaxCreditPoints(val);
                                                    // Trigger recalculation if needed
                                                }}
                                                resolvedValue={undefined} // We don't store manual override for points in the same map yet
                                            />
                                            <MismatchAlert
                                                label={t('income.recurringForm.incomeTax')}
                                                actual={extractedData.tax_income ?? 0}
                                                expected={calculatedTax}
                                                currency={formData.currency}
                                                fieldKey="tax_income"
                                                onResolve={handleMismatchResolution}
                                                resolvedValue={manualOverrides.tax_income}
                                            />
                                            <MismatchAlert
                                                label={t('income.recurringForm.healthTax')}
                                                actual={extractedData.tax_health ?? 0}
                                                expected={additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0}
                                                currency={formData.currency}
                                                fieldKey="tax_health"
                                                onResolve={handleMismatchResolution}
                                                resolvedValue={manualOverrides.tax_health}
                                            />
                                            <MismatchAlert
                                                label={t('income.recurringForm.nationalInsurance')}
                                                actual={extractedData.tax_national ?? 0}
                                                expected={additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0}
                                                currency={formData.currency}
                                                fieldKey="tax_national"
                                                onResolve={handleMismatchResolution}
                                                resolvedValue={manualOverrides.tax_national}
                                            />
                                        </div>
                                    )}


                                </>
                            ) : (
                                <div className="text-center py-6 text-slate-400 text-sm italic">
                                    {t('income.recurringForm.noTaxesCalculated')}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pension Calculator */}
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-purple-900 flex items-center gap-2">
                                {t('income.recurringForm.pensionCalculator')}
                            </h4>
                            <button
                                type="button"
                                onClick={() => {
                                    setHasPension(!hasPension);
                                    if (hasPension) {
                                        setFormData({ ...formData, employeePct: 0, employerPct: 0, severancePct: 0 });
                                    } else {
                                        setFormData({ ...formData, employeePct: 6.0, employerPct: 6.5, severancePct: 8.33 });
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${hasPension
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                    }`}
                            >
                                {hasPension ? t('income.recurringForm.hasPension') : t('income.recurringForm.noPension')}
                            </button>
                        </div>

                        {hasPension ? (
                            <>
                                <PercentageRow
                                    label={t('income.recurringForm.employeeContribution')}
                                    value={formData.employeePct}
                                    onChange={(val) => setFormData({ ...formData, employeePct: val })}
                                    color="text-blue-600"
                                    isCustom={employeeCustom}
                                    setIsCustom={setEmployeeCustom}
                                    customList={customEmployeePcts}
                                    setCustomList={setCustomEmployeePcts}
                                />

                                <PercentageRow
                                    label={t('income.recurringForm.employerContribution')}
                                    value={formData.employerPct}
                                    onChange={(val) => setFormData({ ...formData, employerPct: val })}
                                    color="text-green-600"
                                    isCustom={employerCustom}
                                    setIsCustom={setEmployerCustom}
                                    customList={customEmployerPcts}
                                    setCustomList={setCustomEmployerPcts}
                                />

                                <PercentageRow
                                    label={t('income.recurringForm.severanceEmployerPays')}
                                    value={formData.severancePct}
                                    onChange={(val) => setFormData({ ...formData, severancePct: val })}
                                    color="text-amber-600"
                                    isCustom={severanceCustom}
                                    setIsCustom={setSeveranceCustom}
                                    customList={customSeverancePcts}
                                    setCustomList={setCustomSeverancePcts}
                                />

                                <div className="mt-4 pt-4 border-t border-purple-200">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-purple-900">{t('income.recurringForm.expectedPensionTotal')}</span>
                                        <span className="text-2xl font-mono font-black text-purple-600">
                                            {formData.expectedPension.toLocaleString()} {formData.currency}
                                        </span>
                                    </div>
                                    <div className="text-xs text-purple-600 mt-1 text-right">
                                        {t('income.recurringForm.pensionBreakdownLine', {
                                            emp: formData.employeePct,
                                            empr: formData.employerPct,
                                            sev: formData.severancePct,
                                            total: (formData.employeePct + formData.employerPct + formData.severancePct).toFixed(2)
                                        })}
                                    </div>
                                </div>

                                {/* Mismatch Alert for Pension */}
                                {extractedData && (
                                    <div className="mt-4">
                                        <MismatchAlert
                                            label={t('income.recurringForm.pensionLabel')}
                                            actual={extractedData.pension_employee}
                                            expected={Math.round(parseFloat(formData.grossAmount || 0) * (formData.employeePct / 100))}
                                            currency={formData.currency}
                                            fieldKey="pension_employee"
                                            onResolve={handleMismatchResolution}
                                            resolvedValue={manualOverrides.pension_employee}
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-6 text-slate-500">
                                <div className="text-4xl mb-2">🚫</div>
                                <div className="text-sm">No pension deductions</div>
                            </div>
                        )}
                    </div>

                    {/* Other Deposits (Keren Hishtalmut, etc.) */}
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                                {t('income.recurringForm.otherDeposits')}
                            </h4>
                            <button
                                type="button"
                                onClick={() => setHasOtherDeposits(!hasOtherDeposits)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${hasOtherDeposits
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                    }`}
                            >
                                {hasOtherDeposits ? t('income.recurringForm.active') : t('income.recurringForm.none')}
                            </button>
                        </div>

                        {hasOtherDeposits && (
                            <>
                                <PercentageRow
                                    label={t('income.recurringForm.employeeContribution')}
                                    value={otherDepositEmployeePct}
                                    onChange={(val) => setOtherDepositEmployeePct(val)}
                                    color="text-emerald-700"
                                    isCustom={otherEmployeeCustom}
                                    setIsCustom={setOtherEmployeeCustom}
                                    customList={customOtherEmployeePcts}
                                    setCustomList={setCustomOtherEmployeePcts}
                                />
                                <PercentageRow
                                    label={t('income.recurringForm.employerContribution')}
                                    value={otherDepositEmployerPct}
                                    onChange={(val) => setOtherDepositEmployerPct(val)}
                                    color="text-emerald-700"
                                    isCustom={otherEmployerCustom}
                                    setIsCustom={setOtherEmployerCustom}
                                    customList={customOtherEmployerPcts}
                                    setCustomList={setCustomOtherEmployerPcts}
                                />
                                <div className="mt-2 text-xs text-emerald-600 font-bold border-t border-emerald-200 pt-2 text-right">
                                    {t('income.recurringForm.totalOtherDeposit')} {Math.round(parseFloat(formData.grossAmount || 0) * ((otherDepositEmployeePct + otherDepositEmployerPct) / 100)).toLocaleString()} {formData.currency}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Net Salary (New Card Design) */}
                    <div>
                        <div className="bg-white border-2 border-teal-100 rounded-xl p-5 shadow-sm">
                            <label className="block text-sm font-bold text-teal-900 mb-3 uppercase tracking-wider">
                                {t('income.recurringForm.netSalary')}
                            </label>

                            <div className="relative mb-4">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.netAmount}
                                    onChange={(e) => setFormData({ ...formData, netAmount: parseFloat(e.target.value) || 0 })}
                                    className="w-full p-4 border-2 border-teal-400 rounded-xl text-4xl font-mono font-black text-teal-700 bg-teal-50 focus:ring-4 focus:ring-teal-100 outline-none text-right"
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-300 font-bold text-xl">
                                    {formData.currency}
                                </div>
                            </div>

                            {/* Calculation Flow */}
                            <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm font-mono text-slate-600">
                                <div className="flex justify-between items-center">
                                    <span>{t('income.recurringForm.monthlyGross')}</span>
                                    <span className="font-bold">{parseFloat(formData.grossAmount || 0).toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between items-center text-red-500 relative">
                                    <span className="flex items-center gap-1 cursor-help" title="Income Tax + Health + National">
                                        - {t('income.recurringForm.taxes')} ({((manualOverrides.tax_income ?? calculatedTax) +
                                            (manualOverrides.tax_health ?? (additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0)) +
                                            (manualOverrides.tax_national ?? (additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0))
                                        ).toLocaleString()})
                                        {(manualOverrides.tax_income !== undefined || manualOverrides.tax_health !== undefined || manualOverrides.tax_national !== undefined) && (
                                            <span className="bg-amber-100 text-amber-700 text-[10px] px-1 rounded border border-amber-200">{t('income.recurringForm.edited')}</span>
                                        )}
                                    </span>
                                    <span
                                        className="font-bold cursor-pointer hover:bg-red-50 px-1 rounded border border-transparent hover:border-red-200"
                                        onClick={() => setEditingField('taxes')}
                                    >
                                        -{(
                                            (manualOverrides.tax_income ?? calculatedTax) +
                                            (manualOverrides.tax_health ?? (additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0)) +
                                            (manualOverrides.tax_national ?? (additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0))
                                        ).toLocaleString()} ✏️
                                    </span>

                                    {/* Custom Edit Popover for Taxes */}
                                    {editingField === 'taxes' && (
                                        <EditValuePopover
                                            title={t('income.recurringForm.overrideTaxes')}
                                            initialValue={(
                                                (manualOverrides.tax_income ?? calculatedTax) +
                                                (manualOverrides.tax_health ?? (additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0)) +
                                                (manualOverrides.tax_national ?? (additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0))
                                            )}
                                            onCancel={() => setEditingField(null)}
                                            onSave={(newVal) => {
                                                if (!isNaN(newVal)) {
                                                    const currentTotal = (
                                                        (manualOverrides.tax_income ?? calculatedTax) +
                                                        (manualOverrides.tax_health ?? (additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0)) +
                                                        (manualOverrides.tax_national ?? (additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0))
                                                    );
                                                    const diff = newVal - currentTotal;
                                                    const currentIncomeTax = manualOverrides.tax_income !== undefined ? manualOverrides.tax_income : calculatedTax;
                                                    // adjust Income Tax to match the desired total
                                                    handleMismatchResolution('tax_income', Math.max(0, currentIncomeTax + diff));
                                                    setEditingField(null);
                                                }
                                            }}
                                        />
                                    )}
                                </div>

                                <div className="flex justify-between items-center text-red-500 relative">
                                    <span className="flex items-center gap-1">
                                        - {t('income.recurringForm.pensionLabel')}
                                        {manualOverrides.pension_employee !== undefined && (
                                            <span className="bg-amber-100 text-amber-700 text-[10px] px-1 rounded border border-amber-200">EDITED</span>
                                        )}
                                    </span>
                                    <span
                                        className="font-bold cursor-pointer hover:bg-red-50 px-1 rounded border border-transparent hover:border-red-200"
                                        onClick={() => setEditingField('pension')}
                                    >
                                        -{(manualOverrides.pension_employee !== undefined ? manualOverrides.pension_employee : Math.round(parseFloat(formData.grossAmount || 0) * (formData.employeePct / 100))).toLocaleString()} ✏️
                                    </span>
                                    {editingField === 'pension' && (
                                        <EditValuePopover
                                            title={t('income.recurringForm.overridePension')}
                                            initialValue={manualOverrides.pension_employee !== undefined ? manualOverrides.pension_employee : Math.round(parseFloat(formData.grossAmount || 0) * (formData.employeePct / 100))}
                                            onCancel={() => setEditingField(null)}
                                            onSave={(val) => {
                                                handleMismatchResolution('pension_employee', val);
                                                setEditingField(null);
                                            }}
                                        />
                                    )}
                                </div>

                                {hasOtherDeposits && (
                                    <div className="flex justify-between items-center text-red-500 relative">
                                        <span className="flex items-center gap-1">
                                            - {t('income.recurringForm.kerenHishtalmut')}
                                            {manualOverrides.other_deposit_employee !== undefined && (
                                                <span className="bg-amber-100 text-amber-700 text-[10px] px-1 rounded border border-amber-200">EDITED</span>
                                            )}
                                        </span>
                                        <span
                                            className="font-bold cursor-pointer hover:bg-red-50 px-1 rounded border border-transparent hover:border-red-200"
                                            onClick={() => setEditingField('other_deposit')}
                                        >
                                            -{(manualOverrides.other_deposit_employee !== undefined
                                                ? manualOverrides.other_deposit_employee
                                                : Math.round(parseFloat(formData.grossAmount || 0) * (otherDepositEmployeePct / 100))
                                            ).toLocaleString()} ✏️
                                        </span>
                                        {editingField === 'other_deposit' && (
                                            <EditValuePopover
                                                title="Override Other Deposit"
                                                initialValue={manualOverrides.other_deposit_employee !== undefined
                                                    ? manualOverrides.other_deposit_employee
                                                    : Math.round(parseFloat(formData.grossAmount || 0) * (otherDepositEmployeePct / 100))}
                                                onCancel={() => setEditingField(null)}
                                                onSave={(val) => {
                                                    handleMismatchResolution('other_deposit_employee', val);
                                                    setEditingField(null);
                                                }}
                                            />
                                        )}
                                    </div>
                                )}

                                <div className="border-t border-slate-200 my-2"></div>

                                <div className="flex justify-between items-center text-teal-700 font-bold text-base">
                                    <span>= {t('income.recurringForm.netSalary')}</span>
                                    <span>{formData.netAmount?.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="mt-3 text-xs text-slate-400 text-center">
                                * Employer pension ({formData.employerPct}%) is not deducted from net salary.
                            </div>

                            {/* Mismatch Alert for Neto */}
                            {extractedData && (
                                <div className="mt-4">
                                    <MismatchAlert
                                        label={t('income.recurringForm.netSalary')}
                                        actual={extractedData.neto}
                                        expected={formData.netAmount}
                                        currency={formData.currency}
                                        fieldKey="neto"
                                        onResolve={handleMismatchResolution}
                                        resolvedValue={manualOverrides.neto}
                                    />
                                </div>
                            )}
                        </div>
                    </div>



                    {/* Direction */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">{t('income.recurringForm.applyTo')}</label>
                        <div className="grid grid-cols-2 gap-4" dir="ltr">
                            <button
                                type="button"
                                onClick={() => handleDirectionToggle('past')}
                                className={`p-6 rounded-xl border-2 transition-all ${selectedDirection === 'past' || selectedDirection === 'both'
                                    ? 'border-purple-500 bg-purple-50 shadow-md'
                                    : 'border-slate-200 hover:border-purple-300'
                                    }`}
                            >
                                <div className="text-3xl mb-2">⏮️</div>
                                <div className="font-bold text-slate-800 mb-1">{t('income.recurringForm.pastMonths')}</div>
                                <div className="text-xs text-slate-600">{t('income.recurringForm.addToPrevious')}</div>
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
                                <div className="font-bold text-slate-800 mb-1">{t('income.recurringForm.futureMonths')}</div>
                                <div className="text-xs text-slate-600">{t('income.recurringForm.forecastUpcoming')}</div>
                            </button>
                        </div>
                    </div>

                    {/* Period Configuration */}
                    {showPeriodConfig && (
                        <div className="border-t border-slate-200 pt-6 space-y-6">
                            {(selectedDirection === 'past' || selectedDirection === 'both') && (
                                <PeriodSelector
                                    label={`⏮️ ${t('income.recurringForm.howFarBack')}`}
                                    value={{ count: formData.pastPeriodCount, unit: formData.pastPeriodUnit }}
                                    onChange={(period) => setFormData({
                                        ...formData,
                                        pastPeriodCount: period.count,
                                        pastPeriodUnit: period.unit
                                    })}
                                    customList={customPastPeriods}
                                    setCustomList={setCustomPastPeriods}
                                    isCustom={isPastCustom}
                                    setIsCustom={setIsPastCustom}
                                />
                            )}

                            {(selectedDirection === 'future' || selectedDirection === 'both') && (
                                <PeriodSelector
                                    label={`▶️ ${t('income.recurringForm.howFarForward')}`}
                                    value={{ count: formData.futurePeriodCount, unit: formData.futurePeriodUnit }}
                                    onChange={(period) => setFormData({
                                        ...formData,
                                        futurePeriodCount: period.count,
                                        futurePeriodUnit: period.unit
                                    })}
                                    customList={customFuturePeriods}
                                    setCustomList={setCustomFuturePeriods}
                                    isCustom={isFutureCustom}
                                    setIsCustom={setIsFutureCustom}
                                />
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-xl p-4">
                        <div className="font-bold text-teal-900 mb-2 flex items-center gap-2">
                            📊 {t('income.recurringForm.summary')}
                        </div>
                        <div className="text-sm text-teal-800 space-y-1">
                            <div className="font-bold text-teal-900">📆 {t('income.recurringForm.monthsCovered')}</div>
                            <div className="pl-4 text-xs">{getMonthRangeDisplay()}</div>
                        </div>
                    </div>

                    {/* Validation Error */}
                    {
                        validationError && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-red-700">{validationError}</span>
                            </div>
                        )
                    }

                    {/* Submit */}
                    <div className="flex gap-3 pt-4">
                        <Button type="submit" disabled={isSaving} className="flex-1">
                            {isSaving ? t('income.recurringForm.saving') : editData ? t('income.recurringForm.updateIncome') : t('income.recurringForm.saveRecurringIncome')}
                        </Button>
                        <Button type="button" variant="secondary" onClick={onCancel}>
                            {t('common.cancel')}
                        </Button>
                    </div>
                </form >
            </div >
        </div >
    );
};
