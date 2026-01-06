import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ExtractionSummary = ({ extractedData }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    if (!extractedData) return null;

    const fields = [
        { key: 'bruto', label: t('income.extraction.fields.grossSalary') },
        { key: 'neto', label: t('income.extraction.fields.netSalary') },
        { key: 'tax_income', label: t('income.extraction.fields.incomeTax') },
        { key: 'tax_health', label: t('income.extraction.fields.healthInsurance') },
        { key: 'tax_national', label: t('income.extraction.fields.nationalInsurance') },
        { key: 'pension_employee', label: t('income.extraction.fields.pensionEmployee') },
        { key: 'pension_employer', label: t('income.extraction.fields.pensionEmployer') },
        { key: 'credit_points', label: t('income.extraction.fields.creditPoints') },
        { key: 'marginal_rate', label: t('income.extraction.fields.marginalRate') },
    ];

    const foundCount = fields.filter(f => extractedData[f.key] !== null).length;
    const totalCount = fields.length;

    return (
        <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-bold text-slate-800 text-sm">{t('income.extraction.payslipDataExtracted')}</div>
                        <div className="text-xs text-slate-500">
                            {t('income.extraction.foundFields', { found: foundCount, total: totalCount })}
                        </div>
                    </div>
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>

            {isOpen && (
                <div className="p-4 bg-white border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {fields.map((field) => {
                            const value = extractedData[field.key];
                            const isFound = value !== null;

                            return (
                                <div key={field.key} className={`flex items-center justify-between p-2 rounded-lg border ${isFound ? 'border-slate-100 bg-slate-50' : 'border-red-50 bg-red-50/50'}`}>
                                    <span className="text-slate-600 font-medium">{field.label}</span>
                                    <div className="flex items-center gap-2">
                                        {isFound ? (
                                            <>
                                                <span className="font-mono font-bold text-slate-800">
                                                    {typeof value === 'number' ? value.toLocaleString() : value}
                                                </span>
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xs text-red-400 italic">{t('income.extraction.notFound')}</span>
                                                <XCircle className="w-4 h-4 text-red-300" />
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-3 text-xs text-slate-400 text-center italic">
                        {t('income.extraction.verifyNote')}
                    </div>
                </div>
            )}
        </div>
    );
};
