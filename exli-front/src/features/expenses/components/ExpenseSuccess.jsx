import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '../../../components/UI';

export const ExpenseSuccess = ({ isManualMode, onReset, onComplete }) => {
    return (
        <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">{isManualMode ? "Expense Added!" : "Import Complete!"}</h3>
            <div className="flex justify-center gap-4 mt-6">
                <Button onClick={onReset}>Add More</Button>
                <Button variant="secondary" onClick={onComplete}>Go to Dashboard</Button>
            </div>
        </div>
    );
};
