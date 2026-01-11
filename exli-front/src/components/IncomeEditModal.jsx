import React, { useState, useEffect } from 'react';
import { X, Briefcase, DollarSign, PiggyBank, Building2, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const IncomeEditModal = ({ isOpen, onClose, onSave, income }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        source_name: '',
        bruto: '',
        neto: '',
        taxes: '',
        pension: '',
        otherDepositsTotal: ''
    });

    useEffect(() => {
        if (income) {
            // Extract other deposits total safely
            let otherDepositsTotal = 0;
            if (typeof income.otherDeposits === 'number') {
                otherDepositsTotal = income.otherDeposits;
            } else if (income.otherDeposits?.totalMonthly) {
                otherDepositsTotal = income.otherDeposits.totalMonthly;
            }

            setFormData({
                source_name: income.source_name || '',
                bruto: income.bruto || 0,
                neto: income.neto || 0,
                taxes: income.taxes || 0,
                pension: income.pension || 0,
                otherDepositsTotal: otherDepositsTotal
            });
        }
    }, [income, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        const updates = {
            source_name: formData.source_name,
            bruto: parseFloat(formData.bruto) || 0,
            neto: parseFloat(formData.neto) || 0,
            taxes: parseFloat(formData.taxes) || 0,
            pension: parseFloat(formData.pension) || 0,
            // We update otherDeposits.totalMonthly if it's an object, or just the field if it was a number
            // To be consistent with new recurring structure, we should probably prefer object structure if possible,
            // but for simple manual edit, let's keep it simple.
            // If the original was an object, update the total inside.
            otherDeposits: income.otherDeposits && typeof income.otherDeposits === 'object'
                ? { ...income.otherDeposits, totalMonthly: parseFloat(formData.otherDepositsTotal) || 0 }
                : parseFloat(formData.otherDepositsTotal) || 0
        };
        onSave(income.id, updates);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col transform transition-all scale-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 border-b border-emerald-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-xl shadow-sm">
                            <Briefcase className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">{t('income.editTitle', 'Edit Income')}</h3>
                            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">{income?.type === 'recurring' ? t('common.recurring', 'Recurring') : t('common.oneTime', 'One-time')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-full transition-colors group">
                        <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Source Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('income.sourceName', 'Workplace / Source')}</label>
                        <div className="relative group">
                            <Building2 className="w-5 h-5 text-slate-400 absolute left-3 top-3.5 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="text"
                                value={formData.source_name}
                                onChange={(e) => setFormData({ ...formData, source_name: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-emerald-500 transition-all font-bold text-slate-700 bg-slate-50 focus:bg-white"
                                placeholder="E.g. Microsoft"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        {/* Bruto */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('income.gross', 'Gross (Bruto)')}</label>
                            <input
                                type="number"
                                value={formData.bruto}
                                onChange={(e) => setFormData({ ...formData, bruto: e.target.value })}
                                className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all font-mono font-medium text-slate-600 focus:text-blue-600 bg-slate-50 focus:bg-white"
                            />
                        </div>
                        {/* Taxes */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('income.taxes', 'Taxes (Total)')}</label>
                            <input
                                type="number"
                                value={formData.taxes}
                                onChange={(e) => setFormData({ ...formData, taxes: e.target.value })}
                                className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-red-400 transition-all font-mono font-medium text-slate-600 focus:text-red-600 bg-slate-50 focus:bg-white"
                            />
                        </div>
                    </div>

                    {/* Neto (Highlighted) */}
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                        <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Wallet className="w-4 h-4" />
                            {t('income.net', 'Net Salary (Bank)')}
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-lg">₪</span>
                            <input
                                type="number"
                                value={formData.neto}
                                onChange={(e) => setFormData({ ...formData, neto: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-white border-2 border-emerald-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono text-2xl font-bold text-emerald-700 placeholder-emerald-300"
                            />
                        </div>
                    </div>

                    {/* Additional Benefits */}
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <PiggyBank className="w-4 h-4 text-purple-500" />
                            {t('income.benefits', 'Benefits & Savings')}
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">{t('income.pension', 'Pension')}</label>
                                <input
                                    type="number"
                                    value={formData.pension}
                                    onChange={(e) => setFormData({ ...formData, pension: e.target.value })}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl outline-none focus:border-purple-400 transition-all font-mono text-sm bg-slate-50 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">{t('income.otherDeposits', 'Other Deposits')}</label>
                                <input
                                    type="number"
                                    value={formData.otherDepositsTotal}
                                    onChange={(e) => setFormData({ ...formData, otherDepositsTotal: e.target.value })}
                                    className="w-full p-2.5 border-2 border-slate-200 rounded-xl outline-none focus:border-purple-400 transition-all font-mono text-sm bg-slate-50 focus:bg-white"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transform active:scale-95 transition-all flex items-center gap-2"
                    >
                        {t('common.saveChanges', 'Save Changes')}
                    </button>
                </div>
            </div>
        </div>
    );
};
