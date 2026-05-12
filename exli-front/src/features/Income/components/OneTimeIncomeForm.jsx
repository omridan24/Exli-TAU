import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../config/firebase.js';
import { Button } from '../../../components/UI.jsx';
import { LogoImage } from './LogoImage.jsx';
import { calculateMarginalTax, calculateAdditionalTaxes } from '../../../utils/taxCalculator.js';
import { getTaxConfig } from '../../../config/taxBrackets.js';
import { TaxBracketGraph } from './TaxBracketGraph.jsx';
import { MismatchAlert } from './MismatchAlert.jsx';
import { ExtractionSummary } from './ExtractionSummary.jsx';
import { CloseConfirmationModal } from '../../../components/CloseConfirmationModal.jsx';

const PENSION_PERCENTAGES = [6.0, 6.5, 7.0, 7.5, 8.0, 8.33, 8.5];

// Helper Component for Editing Values
const EditValuePopover = ({ initialValue, onSave, onCancel, title }) => {
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
                    {t('income.oneTimeForm.save')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                    {t('common.cancel')}
                </button>
            </div>
            {/* Arrow */}
            <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-t border-l border-slate-200 transform rotate-45"></div>
        </div>
    );
};

export const OneTimeIncomeForm = ({ userId, workplaces, currency, reportMonth, onSave, onCancel, extractedData }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        workplaceName: '',
        occupation: '',
        grossAmount: '',
        netAmount: '',
        currency: currency || 'ILS',
        employeePct: 6.0,
        employerPct: 6.5,
        severancePct: 8.33,
        expectedPension: 0,
        workplaceLogo: '',
        workplaceDomain: ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState('');
    const [employeeCustom, setEmployeeCustom] = useState(false);
    const [employerCustom, setEmployerCustom] = useState(false);
    const [severanceCustom, setSeveranceCustom] = useState(false);
    const [userCountry, setUserCountry] = useState('Israel');
    const [taxCreditPoints, setTaxCreditPoints] = useState(2.25);
    const [defaultCreditPoints, setDefaultCreditPoints] = useState(2.25);
    const [calculatedTax, setCalculatedTax] = useState(0);
    const [taxBracketInfo, setTaxBracketInfo] = useState(null);
    const [additionalTaxes, setAdditionalTaxes] = useState({ total: 0, breakdown: [] });
    const [customEmployeePcts, setCustomEmployeePcts] = useState([]);
    const [customEmployerPcts, setCustomEmployerPcts] = useState([]);
    const [customSeverancePcts, setCustomSeverancePcts] = useState([]);
    const [hasPension, setHasPension] = useState(true);
    const [hasOtherDeposits, setHasOtherDeposits] = useState(false);
    const [hasTax, setHasTax] = useState(true);
    const [showFullForm, setShowFullForm] = useState(false);
    const [manualOverrides, setManualOverrides] = useState({});
    const [editingField, setEditingField] = useState(null);

    // Other Deposits State
    const [otherDepositEmployeePct, setOtherDepositEmployeePct] = useState(0);
    const [otherDepositEmployerPct, setOtherDepositEmployerPct] = useState(0);
    const [otherEmployeeCustom, setOtherEmployeeCustom] = useState(false);
    const [otherEmployerCustom, setOtherEmployerCustom] = useState(false);
    const [customOtherEmployeePcts, setCustomOtherEmployeePcts] = useState([]);
    const [customOtherEmployerPcts, setCustomOtherEmployerPcts] = useState([]);

    // Close confirmation state
    const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
    const initialFormDataRef = useRef(JSON.stringify({
        workplaceName: '',
        grossAmount: ''
    }));

    // Check if form has unsaved changes
    const hasUnsavedChanges = () => {
        const current = JSON.stringify({
            workplaceName: formData.workplaceName,
            grossAmount: formData.grossAmount
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

    const handleMismatchResolution = (key, value) => {
        if (key === 'neto') {
            // For Neto, we directly update the editable form field
            setFormData(prev => ({ ...prev, netAmount: value }));
        } else {
            // For calculated fields, we store an override
            // This will trigger the useEffect that recalculates netAmount
            setManualOverrides(prev => ({ ...prev, [key]: value }));
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
                    const points = data.profile?.taxCreditPoints || 2.25;
                    setTaxCreditPoints(points);
                    setDefaultCreditPoints(points);
                }
            } catch (err) {
                console.error('Failed to fetch user tax settings:', err);
            }
        };
        if (userId) fetchUserTaxSettings();
    }, [userId]);

    // Pre-fill from extractedData
    useEffect(() => {
        if (extractedData) {
            setFormData(prev => ({
                ...prev,
                grossAmount: extractedData.bruto || prev.grossAmount,
                // We keep calculated neto as the default, but user can see the mismatch
                // If they want to force neto from payslip, they can edit it.
            }));
        }
    }, [extractedData]);

    // Progressive form reveal
    useEffect(() => {
        if (formData.workplaceName && formData.grossAmount) {
            setShowFullForm(true);
        } else {
            setShowFullForm(false);
        }
    }, [formData.workplaceName, formData.grossAmount]);

    // Auto-calculate expected tax
    useEffect(() => {
        if (!hasTax) {
            setCalculatedTax(0);
            setAdditionalTaxes({ total: 0, breakdown: [] });
            setTaxBracketInfo(null);
            return;
        }

        if (formData.grossAmount && userCountry) {
            const monthlyGross = parseFloat(formData.grossAmount);
            const annualGross = monthlyGross * 12;

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
        }
    }, [formData.grossAmount, userCountry, taxCreditPoints, hasTax]);

    // Auto-calculate additional taxes (MONTHLY INPUT - NO CONVERSION NEEDED)
    useEffect(() => {
        if (formData.grossAmount && userCountry) {
            const monthlyGross = parseFloat(formData.grossAmount);

            const taxConfig = getTaxConfig(userCountry);
            if (taxConfig?.additionalTaxes) {
                const result = calculateAdditionalTaxes(monthlyGross, taxConfig.additionalTaxes);
                setAdditionalTaxes(result);
            }
        }
    }, [formData.grossAmount, userCountry]);

    // Auto-calculate expected pension (employee + employer + severance)
    useEffect(() => {
        if (formData.grossAmount) {
            const gross = parseFloat(formData.grossAmount);
            const empPct = parseFloat(formData.employeePct) || 0;
            const workPct = parseFloat(formData.employerPct) || 0;
            const sevPct = parseFloat(formData.severancePct) || 0;
            const total = Math.round(gross * ((empPct + workPct + sevPct) / 100));

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

            if (autoNeto !== formData.netAmount) {
                setFormData(prev => ({ ...prev, netAmount: autoNeto }));
            }
        }
    }, [formData.grossAmount, calculatedTax, additionalTaxes, formData.employeePct, manualOverrides, otherDepositEmployeePct]);

    const handleWorkplaceSelect = (workplace) => {
        setFormData({
            ...formData,
            workplaceName: workplace.name,
            occupation: workplace.linkedOccupation || formData.occupation,
            workplaceLogo: workplace.logo || '',
            workplaceDomain: workplace.domain || ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.workplaceName || !formData.grossAmount) {
            setValidationError('Please fill in Workplace and Gross Amount');
            return;
        }

        setIsSaving(true);
        setValidationError('');

        try {
            // Save to income collection for the specific month only
            const incomeData = {
                userId,
                month: reportMonth,
                source_name: formData.workplaceName,
                occupation: formData.occupation,
                bruto: parseFloat(formData.grossAmount),
                neto: parseFloat(formData.netAmount),
                taxes: (manualOverrides.tax_income ?? calculatedTax) +
                    (manualOverrides.tax_health ?? (additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0)) +
                    (manualOverrides.tax_national ?? (additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0)),
                pension: manualOverrides.pension_employee ?? Math.round(parseFloat(formData.grossAmount) * (formData.employeePct / 100)),
                currency: formData.currency,
                type: 'one-time',
                isRecurring: false,
                workplaceLogo: formData.workplaceLogo,
                workplaceDomain: formData.workplaceDomain,
                createdAt: serverTimestamp(),
                // Store overrides metadata for reference
                manualOverrides: manualOverrides,
                otherDeposits: {
                    employeePct: otherDepositEmployeePct,
                    employerPct: otherDepositEmployerPct,
                    totalMonthly: Math.round(formData.grossAmount * ((otherDepositEmployeePct + otherDepositEmployerPct) / 100))
                }
            };

            await addDoc(collection(db, 'users', userId, 'income'), incomeData);

            await onSave();
        } catch (err) {
            console.error('Save failed:', err);
            setValidationError(t('income.oneTimeForm.validation.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    // Reusable Percentage Row Component (EXACT COPY from RecurringIncomeForm)
    const PercentageRow = ({ label, value, onChange, color, isCustom, setIsCustom, customList, setCustomList }) => {
        const [customInput, setCustomInput] = useState('');

        const handleApproveCustom = () => {
            const num = parseFloat(customInput);
            if (!isNaN(num) && num >= 0 && num <= 100) {
                if (!customList.includes(num)) {
                    setCustomList([...customList, num]);
                }
                onChange(num);
                setIsCustom(false);
                setCustomInput('');
            }
        };

        return (
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>

                {isCustom ? (
                    <div className="flex gap-2 items-center">
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleApproveCustom()}
                            className="w-24 p-2 border border-slate-300 rounded-lg text-center font-bold"
                            placeholder="%"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleApproveCustom}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xl transition-colors"
                        >
                            ✓
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsCustom(false); setCustomInput(''); }}
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {PENSION_PERCENTAGES.map(pct => (
                            <button
                                key={pct}
                                type="button"
                                onClick={() => onChange(pct)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${value === pct
                                    ? `bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent shadow-md`
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-purple-300'
                                    }`}
                            >
                                {pct}%
                            </button>
                        ))}

                        {customList.map((pct, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => onChange(pct)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${value === pct
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
                            className="px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors"
                        >
                            ✏️ {t('income.oneTimeForm.custom')}
                        </button>
                    </div>
                )}
            </div>
        );
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
                    className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header - MATCHES RecurringIncomeForm */}
                    <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
                        <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                            {t('income.oneTimeForm.title')} - {reportMonth}
                        </h3>
                        <button type="button" onClick={handleCloseAttempt} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Extraction Summary (if data exists) */}
                        {extractedData && <ExtractionSummary extractedData={extractedData} />}

                        {/* Workplace Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t('income.oneTimeForm.workplace')}</label>
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
                                placeholder={t('income.oneTimeForm.orEnterWorkplace')}
                                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>

                        {/* Gross Salary - EXACT COPY */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t('income.oneTimeForm.grossSalary')}</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.grossAmount}
                                onChange={(e) => setFormData({ ...formData, grossAmount: e.target.value })}
                                placeholder="e.g., 10000"
                                className="w-full p-4 border-2 border-slate-300 rounded-xl text-lg font-mono font-bold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                required
                            />
                        </div>

                        {/* Progressive Reveal: Show rest of form after workplace + gross amount filled */}
                        {!showFullForm && (
                            <div className="text-center py-6 text-slate-400 text-sm">
                                {t('income.oneTimeForm.fillToProgress')}
                            </div>
                        )}

                        {showFullForm && (
                            <>
                                {/* Tax Calculator - EXACT COPY */}
                                {parseFloat(formData.grossAmount || 0) > 0 && (
                                    <div className={`border-2 rounded-xl p-4 transition-colors ${hasTax ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className={`font-bold flex items-center gap-2 ${hasTax ? 'text-blue-900' : 'text-slate-500'}`}>
                                                {t('income.oneTimeForm.taxCalculator')}
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => setHasTax(!hasTax)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${hasTax
                                                    ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                    }`}
                                            >
                                                {hasTax ? t('income.oneTimeForm.taxableIncome') : t('income.oneTimeForm.taxFree')}
                                            </button>
                                        </div>

                                        {hasTax ? (
                                            <>
                                                <TaxBracketGraph
                                                    annualIncome={parseFloat(formData.grossAmount || 0) * 12}
                                                    brackets={getTaxConfig(userCountry)?.brackets || []}
                                                    currency={formData.currency}
                                                    effectiveRate={taxBracketInfo?.effectiveRate || 0}
                                                    taxBreakdown={taxBracketInfo?.breakdown || []}
                                                />

                                                {/* Tax Details */}
                                                <div className="mt-4 space-y-3">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-blue-700">{t('income.oneTimeForm.taxCreditPoints')}</span>
                                                        <span className="font-mono font-bold text-blue-900">{taxCreditPoints}</span>
                                                    </div>
                                                    {taxBracketInfo?.creditValue > 0 && (
                                                        <div className="text-[10px] text-blue-600/80 -mt-2 leading-tight">
                                                            {t('income.oneTimeForm.taxSavedByCredits', {
                                                                defaultValue: '{{points}} tax credits saves you {{amount}} {{currency}} in taxes a month',
                                                                points: taxCreditPoints,
                                                                amount: Math.round(Math.min(taxBracketInfo.annualTaxBeforeCredits, taxBracketInfo.creditValue) / 12).toLocaleString(),
                                                                currency: formData.currency
                                                            })}
                                                        </div>
                                                    )}
                                                    {extractedData && (
                                                        <MismatchAlert
                                                            label={t('income.oneTimeForm.taxCreditPoints')}
                                                            actual={extractedData.credit_points ?? 0}
                                                            expected={defaultCreditPoints}
                                                            currency="pts"
                                                            fieldKey="credit_points"
                                                            onResolve={(key, val) => {
                                                                setManualOverrides(prev => ({ ...prev, [key]: val }));
                                                                setTaxCreditPoints(val);
                                                            }}
                                                            resolvedValue={manualOverrides.credit_points}
                                                            theme="red"
                                                        />
                                                    )}

                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-blue-700">{t('income.oneTimeForm.monthlyGross')}</span>
                                                        <span className="font-mono text-emerald-700 font-bold">
                                                            {parseFloat(formData.grossAmount).toLocaleString()} {formData.currency}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between items-center text-xs text-blue-600">
                                                        <span>{t('income.oneTimeForm.annualGross')}</span>
                                                        <span className="font-mono">
                                                            {(parseFloat(formData.grossAmount) * 12).toLocaleString()} {formData.currency}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-4 space-y-2 text-sm border-t border-blue-200 pt-3">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex justify-between">
                                                            <span className="text-blue-700">{t('income.oneTimeForm.incomeTax')}</span>
                                                            <span className="font-mono font-bold">
                                                                {(manualOverrides.tax_income !== undefined ? manualOverrides.tax_income : calculatedTax).toLocaleString()} {formData.currency}
                                                                {manualOverrides.tax_income !== undefined && <span className="text-[10px] text-amber-600 ml-1">{t('income.oneTimeForm.edited')}</span>}
                                                            </span>
                                                        </div>
                                                        {extractedData && (
                                                            <MismatchAlert
                                                                label={t('income.oneTimeForm.incomeTax')}
                                                                actual={extractedData.tax_income ?? 0}
                                                                expected={calculatedTax}
                                                                currency={formData.currency}
                                                                fieldKey="tax_income"
                                                                onResolve={handleMismatchResolution}
                                                                resolvedValue={manualOverrides.tax_income}
                                                                theme="red"
                                                            />
                                                        )}
                                                    </div>
                                                    
                                                    {additionalTaxes.breakdown && additionalTaxes.breakdown.map((tax, idx) => {
                                                        const isHealth = tax.name.includes('Health');
                                                        const isNational = tax.name.includes('National');
                                                        const expectedValue = tax.amount;
                                                        const actualValue = isHealth ? extractedData?.tax_health : isNational ? extractedData?.tax_national : undefined;
                                                        const fieldKey = isHealth ? 'tax_health' : isNational ? 'tax_national' : '';
                                                        const resolvedVal = isHealth ? manualOverrides.tax_health : isNational ? manualOverrides.tax_national : undefined;
                                                        
                                                        return (
                                                            <React.Fragment key={idx}>
                                                                <div className="flex justify-between">
                                                                    <span className="text-blue-700">
                                                                        {isHealth ? t('income.oneTimeForm.healthTax') :
                                                                            isNational ? t('income.oneTimeForm.nationalInsurance') :
                                                                                tax.name}:
                                                                    </span>
                                                                    <span className="font-mono font-bold">
                                                                        {(tax.amount || 0).toLocaleString()} {formData.currency}
                                                                        <span className="text-xs text-blue-600 ml-2">
                                                                            ({(tax.rate * 100).toFixed(1)}%)
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                                {extractedData && fieldKey && actualValue !== undefined && (
                                                                    <MismatchAlert
                                                                        label={isHealth ? t('income.oneTimeForm.healthTax') : t('income.oneTimeForm.nationalInsurance')}
                                                                        actual={actualValue ?? 0}
                                                                        expected={expectedValue || 0}
                                                                        currency={formData.currency}
                                                                        fieldKey={fieldKey}
                                                                        onResolve={handleMismatchResolution}
                                                                        resolvedValue={resolvedVal}
                                                                        theme="red"
                                                                    />
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    <div className="flex justify-between pt-2 border-t border-blue-200">
                                                        <span className="font-bold text-blue-900">{t('income.oneTimeForm.totalMonthlyTaxes')}</span>
                                                        <span className="font-mono font-black text-blue-600">
                                                            {(
                                                                (manualOverrides.tax_income ?? calculatedTax) +
                                                                (manualOverrides.tax_health ?? (additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0)) +
                                                                (manualOverrides.tax_national ?? (additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0))
                                                            ).toLocaleString()} {formData.currency}
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-6 text-slate-400 text-sm italic">
                                                {t('income.oneTimeForm.noTaxesCalculated')}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Pension Calculator with No Pension Toggle */}
                                {parseFloat(formData.grossAmount || 0) > 0 && (
                                    <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-bold text-purple-900">{t('income.oneTimeForm.pensionCalculator')}</h4>
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
                                                {hasPension ? t('income.oneTimeForm.hasPension') : t('income.oneTimeForm.noPension')}
                                            </button>
                                        </div>

                                        {hasPension ? (
                                            <>
                                                <PercentageRow
                                                    label={t('income.oneTimeForm.employeeContribution')}
                                                    value={formData.employeePct}
                                                    onChange={(val) => setFormData({ ...formData, employeePct: val })}
                                                    color="text-blue-600"
                                                    isCustom={employeeCustom}
                                                    setIsCustom={setEmployeeCustom}
                                                    customList={customEmployeePcts}
                                                    setCustomList={setCustomEmployeePcts}
                                                />
                                                {extractedData && extractedData.pension_employee !== undefined && (
                                                    <div className="mt-2 mb-2">
                                                        <MismatchAlert
                                                            label={t('income.oneTimeForm.employeeContribution')}
                                                            actual={extractedData.pension_employee}
                                                            expected={Math.round(parseFloat(formData.grossAmount || 0) * (formData.employeePct / 100))}
                                                            currency={formData.currency}
                                                            fieldKey="pension_employee"
                                                            onResolve={handleMismatchResolution}
                                                            resolvedValue={manualOverrides.pension_employee}
                                                            theme="red"
                                                        />
                                                    </div>
                                                )}

                                                <PercentageRow
                                                    label={t('income.oneTimeForm.employerContribution')}
                                                    value={formData.employerPct}
                                                    onChange={(val) => setFormData({ ...formData, employerPct: val })}
                                                    color="text-green-600"
                                                    isCustom={employerCustom}
                                                    setIsCustom={setEmployerCustom}
                                                    customList={customEmployerPcts}
                                                    setCustomList={setCustomEmployerPcts}
                                                />
                                                {extractedData && extractedData.pension_employer !== undefined && (
                                                    <div className="mt-2 mb-2">
                                                        <MismatchAlert
                                                            label={t('income.oneTimeForm.employerContribution')}
                                                            actual={extractedData.pension_employer}
                                                            expected={Math.round(parseFloat(formData.grossAmount || 0) * (formData.employerPct / 100))}
                                                            currency={formData.currency}
                                                            fieldKey="pension_employer"
                                                            onResolve={handleMismatchResolution}
                                                            resolvedValue={manualOverrides.pension_employer}
                                                            theme="red"
                                                        />
                                                    </div>
                                                )}

                                                <PercentageRow
                                                    label={t('income.oneTimeForm.severanceEmployerPays')}
                                                    value={formData.severancePct}
                                                    onChange={(val) => setFormData({ ...formData, severancePct: val })}
                                                    color="text-amber-600"
                                                    isCustom={severanceCustom}
                                                    setIsCustom={setSeveranceCustom}
                                                    customList={customSeverancePcts}
                                                    setCustomList={setCustomSeverancePcts}
                                                />
                                                {extractedData && extractedData.pension_severance !== undefined && (
                                                    <div className="mt-2 mb-2">
                                                        <MismatchAlert
                                                            label={t('income.oneTimeForm.severanceEmployerPays')}
                                                            actual={extractedData.pension_severance}
                                                            expected={Math.round(parseFloat(formData.grossAmount || 0) * (formData.severancePct / 100))}
                                                            currency={formData.currency}
                                                            fieldKey="pension_severance"
                                                            onResolve={handleMismatchResolution}
                                                            resolvedValue={manualOverrides.pension_severance}
                                                            theme="red"
                                                        />
                                                    </div>
                                                )}

                                                <div className="mt-4 pt-4 border-t border-purple-200">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-bold text-purple-900">{t('income.oneTimeForm.expectedPensionTotal')}</span>
                                                        <span className="text-2xl font-mono font-black text-purple-600">
                                                            {formData.expectedPension.toLocaleString()} {formData.currency}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-purple-600 mt-1 text-right">
                                                        {t('income.oneTimeForm.pensionTotalCalculation', {
                                                            emp: formData.employeePct,
                                                            empr: formData.employerPct,
                                                            sev: formData.severancePct,
                                                            total: (formData.employeePct + formData.employerPct + formData.severancePct).toFixed(2)
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-6 text-slate-500">
                                                <div className="text-4xl mb-2">🚫</div>
                                                <div className="text-sm">No pension deductions</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Other Deposits (Keren Hishtalmut, etc.) */}
                                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                                            {t('income.oneTimeForm.otherDeposits')}
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => setHasOtherDeposits(!hasOtherDeposits)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${hasOtherDeposits
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                }`}
                                        >
                                            {hasOtherDeposits ? t('income.oneTimeForm.active') : t('income.oneTimeForm.none')}
                                        </button>
                                    </div>

                                    {hasOtherDeposits && (
                                        <>
                                            <PercentageRow
                                                label={t('income.oneTimeForm.employeeContribution')}
                                                value={otherDepositEmployeePct}
                                                onChange={(val) => setOtherDepositEmployeePct(val)}
                                                color="text-emerald-700"
                                                isCustom={otherEmployeeCustom}
                                                setIsCustom={setOtherEmployeeCustom}
                                                customList={customOtherEmployeePcts}
                                                setCustomList={setCustomOtherEmployeePcts}
                                            />
                                            {extractedData && extractedData.keren_hishtalmut_employee !== undefined && (
                                                <div className="mt-2 mb-2">
                                                    <MismatchAlert
                                                        label={t('income.oneTimeForm.employeeContribution')}
                                                        actual={extractedData.keren_hishtalmut_employee}
                                                        expected={Math.round(parseFloat(formData.grossAmount || 0) * (otherDepositEmployeePct / 100))}
                                                        currency={formData.currency}
                                                        fieldKey="keren_hishtalmut_employee"
                                                        onResolve={handleMismatchResolution}
                                                        resolvedValue={manualOverrides.keren_hishtalmut_employee}
                                                        theme="red"
                                                    />
                                                </div>
                                            )}

                                            <PercentageRow
                                                label={t('income.oneTimeForm.employerContribution')}
                                                value={otherDepositEmployerPct}
                                                onChange={(val) => setOtherDepositEmployerPct(val)}
                                                color="text-emerald-700"
                                                isCustom={otherEmployerCustom}
                                                setIsCustom={setOtherEmployerCustom}
                                                customList={customOtherEmployerPcts}
                                                setCustomList={setCustomOtherEmployerPcts}
                                            />
                                            {extractedData && extractedData.keren_hishtalmut_employer !== undefined && (
                                                <div className="mt-2 mb-2">
                                                    <MismatchAlert
                                                        label={t('income.oneTimeForm.employerContribution')}
                                                        actual={extractedData.keren_hishtalmut_employer}
                                                        expected={Math.round(parseFloat(formData.grossAmount || 0) * (otherDepositEmployerPct / 100))}
                                                        currency={formData.currency}
                                                        fieldKey="keren_hishtalmut_employer"
                                                        onResolve={handleMismatchResolution}
                                                        resolvedValue={manualOverrides.keren_hishtalmut_employer}
                                                        theme="red"
                                                    />
                                                </div>
                                            )}

                                            <div className="mt-2 text-xs text-emerald-600 font-bold border-t border-emerald-200 pt-2 text-right">
                                                {t('income.oneTimeForm.totalOtherDeposit')} {Math.round(parseFloat(formData.grossAmount || 0) * ((otherDepositEmployeePct + otherDepositEmployerPct) / 100)).toLocaleString()} {formData.currency}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Net Salary - EDITABLE (New Card Design) */}
                                {parseFloat(formData.grossAmount || 0) > 0 && (
                                    <div>
                                        <div className="bg-white border-2 border-teal-100 rounded-xl p-5 shadow-sm">
                                            <label className="block text-sm font-bold text-teal-900 mb-3 uppercase tracking-wider">
                                                {t('income.oneTimeForm.netSalary')}
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
                                                    <span>{t('income.oneTimeForm.grossSalaryLabel')}</span>
                                                    <span className="font-bold">{parseFloat(formData.grossAmount || 0).toLocaleString()}</span>
                                                </div>



                                                <div className="flex justify-between items-center text-red-500 relative">
                                                    <span className="flex items-center gap-1 cursor-help" title="Income Tax + Health + National">
                                                        - {t('income.oneTimeForm.taxes')} ({((manualOverrides.tax_income ?? calculatedTax) +
                                                            (manualOverrides.tax_health ?? (additionalTaxes.breakdown.find(t => t.name.includes('Health'))?.amount || 0)) +
                                                            (manualOverrides.tax_national ?? (additionalTaxes.breakdown.find(t => t.name.includes('National'))?.amount || 0))
                                                        ).toLocaleString()})
                                                        {(manualOverrides.tax_income !== undefined || manualOverrides.tax_health !== undefined || manualOverrides.tax_national !== undefined) && (
                                                            <span className="bg-amber-100 text-amber-700 text-[10px] px-1 rounded border border-amber-200">EDITED</span>
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
                                                            title={t('income.oneTimeForm.overrideTaxes')}
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
                                                        - {t('income.oneTimeForm.pensionLabel')}
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
                                                            title={t('income.oneTimeForm.overridePension')}
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
                                                            - {t('income.oneTimeForm.kerenHishtalmutLabel')}
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
                                                                title={t('income.oneTimeForm.overrideOtherDeposit')}
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
                                                    <span>= {t('income.oneTimeForm.netSalary')}</span>
                                                    <span>{formData.netAmount?.toLocaleString()}</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 text-xs text-slate-400 text-center">
                                                {t('income.oneTimeForm.employerPensionNote', { emp: formData.employerPct, sev: formData.severancePct })}
                                            </div>

                                            {/* Mismatch Alert for Neto */}
                                            {extractedData && (
                                                <div className="mt-4">
                                                    <MismatchAlert
                                                        label={t('income.oneTimeForm.netSalary')}
                                                        actual={extractedData.neto}
                                                        expected={formData.netAmount}
                                                        currency={formData.currency}
                                                        fieldKey="neto"
                                                        onResolve={handleMismatchResolution}
                                                        resolvedValue={manualOverrides.neto}
                                                    // No resolvedValue needed for neto as we update the form directly
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Validation Error */}
                        {validationError && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-red-700">{validationError}</span>
                            </div>
                        )}

                        {/* Submit - EXACT COPY */}
                        <div className="flex gap-3 pt-4">
                            <Button type="submit" disabled={isSaving} className="flex-1">
                                {isSaving ? t('income.oneTimeForm.saving') : t('income.oneTimeForm.saveButton')}
                            </Button>
                            <Button type="button" variant="secondary" onClick={handleCloseAttempt}>
                                {t('common.cancel')}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};
