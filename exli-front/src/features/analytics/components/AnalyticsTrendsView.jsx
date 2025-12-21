import React from 'react';
import { DollarSign } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip
} from 'recharts';
import { Card } from '../../../components/UI';

export const AnalyticsTrendsView = ({
    trendType,
    setTrendType,
    categories,
    selectedCategory,
    setSelectedCategory,
    selectedIncomeType,
    setSelectedIncomeType,
    selectedJobFilter,
    setSelectedJobFilter,
    jobOptions,
    trendOverview,
    dominantCurrency,
    activeTrendData
}) => {
    return (
        <div className="animate-fade-in">
            <div className="flex justify-center mb-8 bg-slate-100 p-1 rounded-xl w-fit mx-auto">
                <button onClick={() => setTrendType('expense')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${trendType === 'expense' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Expense Trends</button>
                <button onClick={() => setTrendType('income')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${trendType === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Income Trends</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Filter Category / Metric</label>
                    <div className="flex flex-wrap gap-2">
                        {trendType === 'expense' ? categories.map(c => (
                            <button key={c.id} onClick={() => setSelectedCategory(c.name)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedCategory === c.name ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}>{c.name}</button>
                        )) : ['neto', 'bruto', 'taxes'].map(t => (
                            <button key={t} onClick={() => setSelectedIncomeType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border uppercase transition-all ${selectedIncomeType === t ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>{t}</button>
                        ))}
                    </div>
                </div>
                {trendType === 'income' && jobOptions.length > 2 && (
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Filter by Job</label>
                        <div className="flex flex-wrap gap-2">
                            {jobOptions.map(job => (
                                <button key={job} onClick={() => setSelectedJobFilter(job)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedJobFilter === job ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>{job}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Total {trendType === 'expense' ? 'Spent' : 'Earned'}</div><div className="text-2xl font-bold text-slate-800">{dominantCurrency} {trendOverview.total.toLocaleString()}</div></Card>
                <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Monthly Average</div><div className="text-2xl font-bold text-blue-600">{dominantCurrency} {trendOverview.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card>
                <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Highest Month</div><div className="text-2xl font-bold text-orange-500">{dominantCurrency} {trendOverview.max.toLocaleString()}</div></Card>
            </div>

            <div className="h-72 mb-8">
                <ResponsiveContainer>
                    <BarChart data={activeTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(v) => `${dominantCurrency}${v.toLocaleString()}`} />
                        <Bar dataKey="amount" fill={trendType === 'expense' ? "#3b82f6" : "#10b981"} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
