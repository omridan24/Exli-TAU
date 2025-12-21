import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { StatsOverview } from './components/StatsOverview';
import { YearDashboard } from './components/YearDashboard';

export const AnalyticsNode = ({ data, income, categories, userId }) => {
    const [selectedYear, setSelectedYear] = useState(null);

    const dominantCurrency = useMemo(() => {
        if (!data.length) return 'ILS';
        const counts = {};
        data.forEach(d => {
            const c = d.currency || 'ILS';
            counts[c] = (counts[c] || 0) + 1;
        });
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'ILS');
    }, [data]);

    const years = useMemo(() => {
        const allYears = new Set([...data.map(d => d.reportMonth?.split('-')[0]), ...income.map(d => d.month?.split('-')[0])].filter(Boolean));
        return Array.from(allYears).sort().reverse();
    }, [data, income]);

    useEffect(() => {
        if (years.length === 1) setSelectedYear(years[0]);
    }, [years]);

    const lifetimeTotals = useMemo(() => {
        const exp = data.reduce((acc, curr) => acc + (curr.isRefund ? 0 : Number(curr.amount)), 0);
        const incNet = income.reduce((acc, curr) => acc + (Number(curr.neto) || 0), 0);
        const pension = income.reduce((acc, curr) => acc + (Number(curr.pension) || 0), 0);
        const wealth = (incNet - exp) + pension;
        return { exp, incNet, wealth };
    }, [data, income]);

    if (selectedYear) return <YearDashboard year={selectedYear} data={data} income={income} categories={categories} userId={userId} onBack={() => setSelectedYear(null)} />;

    return (
        <div className="p-6 max-w-5xl mx-auto animate-fade-in">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">Lifetime Overview</h3>
            <StatsOverview totals={lifetimeTotals} currency={dominantCurrency} />
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Calendar className="w-5 h-5 text-slate-500" /> Select Fiscal Year</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {years.map(year => (
                    <button key={year} onClick={() => setSelectedYear(year)} className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all text-left group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Calendar className="w-24 h-24 text-emerald-600" />
                        </div>
                        <div className="text-4xl font-black text-slate-800 group-hover:text-emerald-700 transition-colors">{year}</div>
                        <div className="mt-4 text-slate-400 font-bold flex items-center gap-2">Full Report <ArrowRight className="w-4 h-4" /></div>
                    </button>
                ))}
                {years.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        No data found. Upload expenses to start.
                    </div>
                )}
            </div>
        </div>
    );
};
