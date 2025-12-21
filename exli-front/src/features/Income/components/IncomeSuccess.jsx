import React from 'react';
import { CheckCircle, Plus } from 'lucide-react';
import { Button } from '../../../components/UI.jsx';

export const IncomeSuccess = ({ reportMonth, onReset, onComplete }) => {
    return (
        <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Income Saved!</h3>
            <p className="text-slate-500 mb-8">Financial data for <b>{reportMonth}</b> has been updated.</p>
            <div className="flex justify-center gap-3">
                <Button onClick={onReset} variant="secondary" className="px-8"><Plus className="w-4 h-4" /> Add Another Income</Button>
                <Button onClick={onComplete} className="px-8">Back to Dashboard</Button>
            </div>
        </div>
    );
};
