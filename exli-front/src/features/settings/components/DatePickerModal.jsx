import React, { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';

export const DatePickerModal = ({ isOpen, onClose, value, onSave }) => {
    const [step, setStep] = useState('year');
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(null);
    if (!isOpen) return null;
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const handleSelectYear = (y) => { setSelectedYear(y); setStep('month'); };
    const handleSelectMonth = (i) => { setSelectedMonth(i); setStep('day'); };
    const handleSelectDay = (d) => {
        const newDate = new Date(Date.UTC(selectedYear, selectedMonth, d));
        onSave(newDate.toISOString().split('T')[0]);
        setStep('year'); onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {step !== 'year' && <button onClick={() => setStep(step === 'day' ? 'month' : 'year')} className="p-2 border rounded-full"><ChevronLeft className="w-4 h-4" /></button>}
                        <h3 className="font-bold uppercase tracking-tight">{step}</h3>
                    </div>
                    <button onClick={onClose}><X /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'year' && <div className="grid grid-cols-4 gap-2">{years.map(y => <button key={y} onClick={() => handleSelectYear(y)} className="p-3 border rounded-xl hover:bg-emerald-50">{y}</button>)}</div>}
                    {step === 'month' && <div className="grid grid-cols-2 gap-2">{months.map((m, i) => <button key={m} onClick={() => handleSelectMonth(i)} className="p-4 border rounded-xl hover:bg-emerald-50">{m}</button>)}</div>}
                    {step === 'day' && <div className="grid grid-cols-5 gap-2">{Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => i + 1).map(d => <button key={d} onClick={() => handleSelectDay(d)} className="p-3 border rounded-xl hover:bg-emerald-50">{d}</button>)}</div>}
                </div>
            </div>
        </div>
    );
};
