import React, { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const MonthYearPickerModal = ({ isOpen, onClose, value, onSave }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState('year');
    const [selectedYear, setSelectedYear] = useState(null);

    if (!isOpen) return null;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Default to last month (not current month)
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
    const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const months = monthKeys.map(key => t(`datePicker.months.${key}`));

    const handleSelectYear = (y) => {
        setSelectedYear(y);
        setStep('month');
    };

    const handleSelectMonth = (i) => {
        const year = selectedYear;
        const month = (i + 1).toString().padStart(2, '0');
        onSave(`${year}-${month}`);
        setStep('year');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {step !== 'year' && <button onClick={() => setStep('year')} className="p-2 border rounded-full hover:bg-slate-50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>}
                        <h3 className="font-bold uppercase tracking-tight text-slate-700">{step === 'year' ? t('datePicker.year') : t('datePicker.month')}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'year' && (
                        <div className="grid grid-cols-3 gap-3">
                            {years.map(y => (
                                <button
                                    key={y}
                                    onClick={() => handleSelectYear(y)}
                                    className={`p-4 border-2 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 transition-all font-bold text-slate-700 ${y === lastMonthYear ? 'bg-emerald-50 border-emerald-400' : 'border-slate-200'}`}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    )}
                    {step === 'month' && (
                        <div className="grid grid-cols-2 gap-3">
                            {months.map((m, i) => {
                                const isLastMonth = selectedYear === lastMonthYear && i === lastMonth;
                                return (
                                    <button
                                        key={m}
                                        onClick={() => handleSelectMonth(i)}
                                        className={`p-4 border-2 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 transition-all font-bold text-slate-700 ${isLastMonth ? 'bg-emerald-50 border-emerald-400' : 'border-slate-200'}`}
                                    >
                                        {m}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
