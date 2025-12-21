import React from 'react';
import { Button } from '../../../components/UI.jsx';

export const IncomeMonthSelector = ({ reportMonth, setReportMonth, onContinue }) => {
    return (
        <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Select Income Month</h3>
            <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-lg mb-6 outline-none"
            />
            <Button onClick={onContinue} className="w-full justify-center">Continue &rarr;</Button>
        </div>
    );
};
