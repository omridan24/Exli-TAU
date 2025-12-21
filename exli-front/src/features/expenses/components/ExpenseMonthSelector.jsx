import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../../../components/UI';
import { MonthYearPickerModal } from '../../../components/MonthYearPickerModal';

export const ExpenseMonthSelector = ({ reportMonth, setReportMonth, onContinue }) => {
    const [showPicker, setShowPicker] = useState(false);

    // Format display (e.g., "2024-01" => "January 2024")
    const formatMonthDisplay = (monthStr) => {
        if (!monthStr) return 'Select Month';
        const [year, month] = monthStr.split('-');
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    };

    return (
        <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Select Expense Month</h3>
            <button
                onClick={() => setShowPicker(true)}
                className="w-full p-4 border-2 border-slate-200 rounded-xl flex justify-between items-center font-bold hover:bg-slate-50 hover:border-emerald-300 transition-all text-lg mb-6 group"
            >
                <span className="text-slate-700">{formatMonthDisplay(reportMonth)}</span>
                <Calendar className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            </button>
            <Button onClick={onContinue} className="w-full justify-center">Continue &rarr;</Button>

            <MonthYearPickerModal
                isOpen={showPicker}
                onClose={() => setShowPicker(false)}
                value={reportMonth}
                onSave={(v) => { setReportMonth(v); setShowPicker(false); }}
            />
        </div>
    );
};
