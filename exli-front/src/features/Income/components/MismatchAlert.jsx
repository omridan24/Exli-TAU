import React, { useState } from 'react';
import { AlertTriangle, Info, CheckCircle, Edit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const themes = {
    amber: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-600',
        titleText: 'text-amber-900',
        infoText: 'text-amber-700/70',
        customLabel: 'text-amber-600',
        customHover: 'group-hover:text-amber-600'
    },
    red: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-600',
        titleText: 'text-red-900',
        infoText: 'text-red-700/70',
        customLabel: 'text-red-600',
        customHover: 'group-hover:text-red-600'
    }
};

export const MismatchAlert = ({
    actual,
    expected,
    label,
    currency = 'ILS',
    fieldKey,
    onResolve,
    resolvedValue,
    theme = 'amber'
}) => {
    const { t } = useTranslation();
    const [customMode, setCustomMode] = useState(false);
    const [customInput, setCustomInput] = useState(resolvedValue || '');

    // If either value is missing, don't show mismatch
    if (actual === null || actual === undefined || expected === null || expected === undefined) return null;

    const diff = Math.abs(actual - expected);
    const tolerance = expected * 0.05; // 5% tolerance

    // If difference is within tolerance, returned null (no alert)
    if (diff <= tolerance) return null;

    // Determine currently selected source based on value match
    // Priority: Custom if mode active, otherwise check exact value matches
    let activeSource = null;
    if (resolvedValue !== undefined) {
        if (resolvedValue === expected) activeSource = 'system';
        else if (resolvedValue === actual) activeSource = 'file';
        else activeSource = 'custom';
    }

    const handleSelect = (source, value) => {
        setCustomMode(false);
        onResolve(fieldKey, value);
    };

    const handleCustomSubmit = () => {
        const val = parseFloat(customInput);
        if (!isNaN(val)) {
            onResolve(fieldKey, val);
            setCustomMode(false);
        }
    };

    const tStyles = themes[theme] || themes.amber;

    return (
        <div className={`flex flex-col p-4 rounded-xl border ${tStyles.border} ${tStyles.bg} animate-fade-in mb-4`}>
            <div className="flex items-center gap-2 mb-3">
                {activeSource ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                    <AlertTriangle className={`w-5 h-5 ${tStyles.icon}`} />
                )}
                <div className={`font-bold text-sm ${activeSource ? 'text-emerald-800' : tStyles.titleText}`}>
                    {label} {t('income.mismatch.title')} {activeSource && t('income.mismatch.resolved')}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* System Card */}
                <button
                    type="button"
                    onClick={() => handleSelect('system', expected)}
                    className={`relative p-3 rounded-xl border-2 text-start transition-all hover:shadow-md ${activeSource === 'system'
                        ? 'bg-white border-emerald-500 shadow-sm'
                        : 'bg-white/60 border-slate-200 hover:border-emerald-300 hover:bg-white'
                        }`}
                >
                    <div className="text-xs uppercase font-extrabold text-slate-400 mb-1">{t('income.mismatch.expectedSystem')}</div>
                    <div className="font-mono font-black text-slate-700 text-lg">
                        {expected.toLocaleString()}
                        <span className="text-xs ml-1 font-bold text-slate-400">{currency}</span>
                    </div>
                    {activeSource === 'system' && (
                        <div className="absolute top-2 right-2 flex w-5 h-5 bg-emerald-500 rounded-full items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                    )}
                </button>

                {/* File Card */}
                <button
                    type="button"
                    onClick={() => handleSelect('file', actual)}
                    className={`relative p-3 rounded-xl border-2 text-start transition-all hover:shadow-md ${activeSource === 'file'
                        ? 'bg-white border-emerald-500 shadow-sm'
                        : 'bg-white/60 border-slate-200 hover:border-blue-300 hover:bg-white'
                        }`}
                >
                    <div className="text-xs uppercase font-extrabold text-blue-500 mb-1">{t('income.mismatch.foundInPayslip')}</div>
                    <div className="font-mono font-black text-slate-700 text-lg">
                        {actual.toLocaleString()}
                        <span className="text-xs ml-1 font-bold text-slate-400">{currency}</span>
                    </div>
                    {activeSource === 'file' && (
                        <div className="absolute top-2 right-2 flex w-5 h-5 bg-emerald-500 rounded-full items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                    )}
                </button>

                {/* Custom Card */}
                <button
                    type="button"
                    onClick={() => {
                        if (activeSource !== 'custom') {
                            setCustomMode(true);
                            // Don't auto-fill unless we have a value
                            setCustomInput(resolvedValue && activeSource === 'custom' ? resolvedValue : '');
                        }
                    }}
                    className={`relative p-3 rounded-xl border-2 text-start transition-all hover:shadow-md group ${activeSource === 'custom'
                        ? 'bg-white border-emerald-500 shadow-sm'
                        : 'bg-white/60 border-dashed border-slate-300 hover:border-slate-400 hover:bg-white'
                        }`}
                >
                    <div className={`text-xs uppercase font-extrabold ${tStyles.customLabel} mb-1`}>{t('income.mismatch.customValue')}</div>

                    {customMode || activeSource === 'custom' ? (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input
                                type="number"
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                                placeholder="0.00"
                                autoFocus={customMode}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCustomSubmit();
                                }}
                            />
                            {customMode && (
                                <button
                                    onClick={handleCustomSubmit}
                                    className="bg-emerald-500 text-white rounded p-1 hover:bg-emerald-600"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className={`flex items-center gap-2 text-slate-400 ${tStyles.customHover} transition-colors`}>
                            <Edit2 className="w-4 h-4" />
                            <span className="text-sm font-bold">{t('income.mismatch.setCustom')}</span>
                        </div>
                    )}

                    {activeSource === 'custom' && !customMode && (
                        <div className="absolute top-2 right-2 flex w-5 h-5 bg-emerald-500 rounded-full items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                    )}
                </button>
            </div>

            {!activeSource && (
                <div className={`${tStyles.infoText} mt-3 text-[10px] font-medium flex items-center gap-1.5 ml-1`}>
                    <Info className="w-3 h-3" />
                    {t('income.mismatch.selectValueNote')}
                </div>
            )}
        </div>
    );
};
