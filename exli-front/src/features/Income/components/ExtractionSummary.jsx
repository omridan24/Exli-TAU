import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export const ExtractionSummary = ({ extractedData }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!extractedData) return null;

    const fields = [
        { key: 'bruto', label: 'Gross Salary' },
        { key: 'neto', label: 'Net Salary' },
        { key: 'tax_income', label: 'Income Tax' },
        { key: 'tax_health', label: 'Health Insurance' },
        { key: 'tax_national', label: 'National Insurance' },
        { key: 'pension_employee', label: 'Pension (Employee)' },
        { key: 'pension_employer', label: 'Pension (Employer)' },
        { key: 'credit_points', label: 'Credit Points' },
        { key: 'marginal_rate', label: 'Marginal Rate' },
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
                        <div className="font-bold text-slate-800 text-sm">Payslip Data Extracted</div>
                        <div className="text-xs text-slate-500">
                            Found {foundCount}/{totalCount} fields
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
                                                <span className="text-xs text-red-400 italic">Not found</span>
                                                <XCircle className="w-4 h-4 text-red-300" />
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-3 text-xs text-slate-400 text-center italic">
                        * Verify these values against your actual payslip file.
                    </div>
                </div>
            )}
        </div>
    );
};
