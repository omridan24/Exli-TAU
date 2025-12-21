import React from 'react';
import { Landmark, Wallet, DollarSign, Percent } from 'lucide-react';
import { Card } from '../../../components/UI';

export const StatsOverview = ({ totals, currency }) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
        <Card className="p-5 border-l-4 border-emerald-500 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Landmark className="w-4 h-4 text-emerald-500" /> Net Wealth Generated
            </div>
            <div className="text-2xl font-extrabold text-slate-800">
                {currency} {totals.wealth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
        </Card>

        <Card className="p-5 border-l-4 border-blue-500 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Wallet className="w-4 h-4 text-blue-500" /> Total Income (Net)
            </div>
            <div className="text-2xl font-bold text-slate-800">
                {currency} {totals.incNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
        </Card>

        <Card className="p-5 border-l-4 border-red-400 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <DollarSign className="w-4 h-4 text-red-400" /> Total Expenses
            </div>
            <div className="text-2xl font-bold text-slate-800">
                {currency} {totals.exp.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
        </Card>

        <Card className="p-5 border-l-4 border-purple-500 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Percent className="w-4 h-4 text-purple-500" /> Savings Rate
            </div>
            <div className="text-2xl font-bold text-slate-800">
                {totals.incNet > 0 ? ((totals.incNet - totals.exp) / totals.incNet * 100).toFixed(1) + '%' : '0%'}
            </div>
        </Card>
    </div>
);
