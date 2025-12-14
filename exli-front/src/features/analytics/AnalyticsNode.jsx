import React, { useState, useMemo, useEffect } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
    PieChart as PieIcon, Calendar, Trash2, Landmark, Wallet,
    BarChart3, ArrowRight, X, TrendingUp, Filter, ArrowLeft, DollarSign, Percent, TrendingDown
} from 'lucide-react';
import { doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card } from '../../components/UI';

// --- SUB-COMPONENT: STATIC STATS OVERVIEW ---
const StatsOverview = ({ totals, currency }) => (
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

// --- SUB-COMPONENT: YEAR DASHBOARD ---
const YearDashboard = ({ year, data, income, categories, userId, onBack }) => {
    const [viewMode, setViewMode] = useState('month');
    const [trendType, setTrendType] = useState('expense'); 
    const [selectedMonth, setSelectedMonth] = useState('average');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name || '');
    const [selectedIncomeType, setSelectedIncomeType] = useState('neto');

    const formatDate = (dateStr) => {
        try { return new Date(dateStr).toLocaleDateString(); } catch (e) { return dateStr; }
    };

    const filteredData = useMemo(() => {
        return {
            expenses: data.filter(d => (d.reportMonth || "").startsWith(year)),
            income: income.filter(d => (d.month || "").startsWith(year))
        };
    }, [data, income, year]);

    // ROBUST CURRENCY CHECKER
    const dominantCurrency = useMemo(() => {
        if (!data.length) return 'ILS';
        const counts = {};
        const validCurrencies = ['ILS', 'USD', 'EUR', 'GBP', '₪', '$', '€', '£'];
        
        data.forEach(d => {
            let c = d.currency || 'ILS';
            // If the currency is Hebrew/Long string/Garbage, ignore it or force ILS
            if (!validCurrencies.includes(c) && c.length > 3) {
                c = 'ILS'; 
            }
            counts[c] = (counts[c] || 0) + 1;
        });
        
        if (Object.keys(counts).length === 0) return 'ILS';
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }, [data]);

    const availableMonths = useMemo(() => {
        const months = new Set([
            ...filteredData.expenses.map(d => d.reportMonth),
            ...filteredData.income.map(d => d.month)
        ].filter(Boolean));
        return Array.from(months).sort().reverse();
    }, [filteredData]);

    const displayExpenses = useMemo(() => selectedMonth === 'average' ? filteredData.expenses : filteredData.expenses.filter(d => d.reportMonth === selectedMonth), [filteredData.expenses, selectedMonth]);
    const displayIncome = useMemo(() => selectedMonth === 'average' ? filteredData.income : filteredData.income.filter(d => d.month === selectedMonth), [filteredData.income, selectedMonth]);

    const categoryStats = useMemo(() => {
        const agg = {};
        displayExpenses.forEach(item => {
            if (item.isRefund) return;
            const cat = item.assignedCategory || 'Uncategorized';
            agg[cat] = (agg[cat] || 0) + Number(item.amount);
        });
        if (selectedMonth === 'average' && availableMonths.length > 0) {
            Object.keys(agg).forEach(key => agg[key] = agg[key] / availableMonths.length);
        }
        return Object.keys(agg).map(key => ({
            name: key,
            value: agg[key],
            color: categories.find(c => c.name === key)?.color || '#64748b'
        })).sort((a, b) => b.value - a.value);
    }, [displayExpenses, selectedMonth, availableMonths, categories]);

    const totalExpenses = categoryStats.reduce((acc, curr) => acc + curr.value, 0);
    const totalIncome = useMemo(() => {
        const agg = displayIncome.reduce((acc, curr) => acc + (Number(curr.neto) || 0), 0);
        return selectedMonth === 'average' && availableMonths.length > 0 ? agg / availableMonths.length : agg;
    }, [displayIncome, selectedMonth, availableMonths]);

    const totalSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

    const incomeBreakdown = useMemo(() => {
        const keys = ['bruto', 'neto', 'taxes', 'pension', 'other_deposits'];
        const agg = { bruto: 0, neto: 0, taxes: 0, pension: 0, other_deposits: 0 };
        displayIncome.forEach(inc => {
            keys.forEach(k => agg[k] += (Number(inc[k]) || 0));
        });
        if (selectedMonth === 'average' && availableMonths.length > 0) {
            keys.forEach(k => agg[k] = agg[k] / availableMonths.length);
        }
        return agg;
    }, [displayIncome, selectedMonth, availableMonths]);

    const expenseTrendData = useMemo(() => {
        if (trendType !== 'expense' || !selectedCategory) return [];
        const relevantTx = filteredData.expenses.filter(d => (d.assignedCategory || 'Uncategorized') === selectedCategory && !d.isRefund);
        const monthlyAgg = {};
        relevantTx.forEach(tx => { const m = tx.reportMonth || 'Unknown'; monthlyAgg[m] = (monthlyAgg[m] || 0) + Number(tx.amount); });
        return Object.entries(monthlyAgg).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
    }, [filteredData.expenses, selectedCategory, trendType]);

    const incomeTrendData = useMemo(() => {
        if (trendType !== 'income') return [];
        const monthlyAgg = {};
        filteredData.income.forEach(inc => {
            const m = inc.month || 'Unknown';
            monthlyAgg[m] = (monthlyAgg[m] || 0) + (Number(inc[selectedIncomeType]) || 0);
        });
        return Object.entries(monthlyAgg).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
    }, [filteredData.income, selectedIncomeType, trendType]);

    const activeTrendData = trendType === 'expense' ? expenseTrendData : incomeTrendData;

    const trendOverview = useMemo(() => {
        const total = activeTrendData.reduce((acc, curr) => acc + curr.amount, 0);
        const avg = availableMonths.length > 0 ? total / availableMonths.length : 0;
        const max = Math.max(...activeTrendData.map(d => d.amount), 0);
        return { total, avg, max };
    }, [activeTrendData, availableMonths]);

    const trendTransactions = useMemo(() => {
        if (trendType === 'expense') {
            return filteredData.expenses
                .filter(d => (d.assignedCategory || 'Uncategorized') === selectedCategory && !d.isRefund)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            return filteredData.income
                .sort((a, b) => b.month.localeCompare(a.month))
                .map(inc => ({
                    id: inc.id,
                    date: inc.month,
                    description: `Income Report (${selectedIncomeType})`,
                    amount: inc[selectedIncomeType],
                    currency: inc.currency
                }));
        }
    }, [filteredData, selectedCategory, selectedIncomeType, trendType]);

    const executeDeleteMonth = async (mode) => {
        if (selectedMonth === 'average') return;
        setIsDeleteModalOpen(false);
        try {
            const batch = writeBatch(db);
            if (mode === 'expenses' || mode === 'both') displayExpenses.forEach(tx => batch.delete(doc(db, 'users', userId, 'expenses', tx.id)));
            if (mode === 'income' || mode === 'both') displayIncome.forEach(inc => batch.delete(doc(db, 'users', userId, 'income', inc.id)));
            await batch.commit();
            if (mode === 'both') setSelectedMonth('average');
        } catch (error) { console.error(error); alert("Delete failed."); }
    };

    const handleDelete = async (docId) => { if (confirm('Delete?')) await deleteDoc(doc(db, 'users', userId, 'expenses', docId)); };
    const handleCategoryChange = async (docId, newCat) => { await updateDoc(doc(db, 'users', userId, 'expenses', docId), { assignedCategory: newCat }); };

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft className="w-6 h-6" /></button>
                    <h2 className="text-2xl font-bold text-slate-800">{year} Dashboard</h2>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setViewMode('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><PieIcon className="w-4 h-4" /> Reports</button>
                    <button onClick={() => setViewMode('category')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'category' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><BarChart3 className="w-4 h-4" /> Trends</button>
                </div>
            </div>

            {viewMode === 'month' && (
                <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 border-b border-slate-100">
                    <button onClick={() => setSelectedMonth('average')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === 'average' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>📊 Yearly Avg</button>
                    {availableMonths.map(m => (
                        <button key={m} onClick={() => setSelectedMonth(m)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === m ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{m}</button>
                    ))}
                </div>
            )}

            {viewMode === 'month' ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Net Income</div><div className="text-2xl font-bold text-emerald-600">{dominantCurrency} {totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card>
                        <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Total Expenses</div><div className="text-2xl font-bold text-slate-800">{dominantCurrency} {totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card>
                        <Card className={`p-4 flex flex-col justify-between border-l-4 ${savingsRate > 20 ? 'border-emerald-500' : savingsRate > 0 ? 'border-yellow-400' : 'border-red-500'}`}><div className="flex justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Spare Money</div><div className={`text-xs font-bold px-2 rounded ${savingsRate > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{savingsRate.toFixed(1)}% Rate</div></div><div className={`text-2xl font-bold ${totalSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{dominantCurrency} {totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                        <Card className="p-6 lg:col-span-2">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700">Expenses Breakdown</h3></div>
                            <div className="flex flex-col md:flex-row items-center">
                                <div className="h-64 w-full md:w-1/2">
                                    <ResponsiveContainer minWidth={0}><PieChart><Pie data={categoryStats} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>{categoryStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(val) => `${dominantCurrency} ${val.toFixed(0)}`} /></PieChart></ResponsiveContainer>
                                </div>
                                <div className="w-full md:w-1/2 space-y-2 pl-4 h-64 overflow-y-auto">
                                    {categoryStats.map(stat => (
                                        <div key={stat.name} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div><span className="text-slate-600 truncate w-32">{stat.name}</span></div>
                                            <div className="font-mono font-bold text-slate-700">{dominantCurrency} {stat.value.toFixed(0)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                        <Card className="p-6"><h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> Income Details</h3><div className="space-y-4"><div className="flex justify-between items-center pb-2 border-b border-slate-100"><span className="text-slate-500 text-sm">Gross</span><span className="font-mono font-bold text-slate-700">{dominantCurrency} {incomeBreakdown.bruto.toLocaleString()}</span></div><div className="flex justify-between items-center text-red-400"><span className="text-sm">Taxes</span><span className="font-mono font-bold">-{dominantCurrency} {incomeBreakdown.taxes.toLocaleString()}</span></div><div className="flex justify-between items-center pt-2"><span className="text-slate-800 font-bold">Net</span><span className="font-mono font-bold text-emerald-600 text-lg">{dominantCurrency} {incomeBreakdown.neto.toLocaleString()}</span></div></div></Card>
                    </div>

                    {selectedMonth !== 'average' && (
                        <div className="flex justify-end mb-8 relative">
                            <button onClick={() => setIsDeleteModalOpen(true)} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /> Delete Month Data</button>
                            {isDeleteModalOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-10 animate-fade-in">
                                    <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-slate-800 text-sm">Clear {selectedMonth}</h4><button onClick={() => setIsDeleteModalOpen(false)}><X className="w-4 h-4" /></button></div>
                                    <div className="space-y-2">
                                        <button onClick={() => executeDeleteMonth('expenses')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-medium">Expenses Only</button>
                                        <button onClick={() => executeDeleteMonth('income')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-600 text-sm font-medium">Income Only</button>
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button onClick={() => executeDeleteMonth('both')} className="w-full text-left px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Everything</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedMonth !== 'average' && (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-4">Date</th><th className="p-4">Description</th><th className="p-4">Amount</th><th className="p-4">Category</th><th className="p-4 text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {displayExpenses.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50 group">
                                            <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                                            <td className="p-4 font-bold text-slate-800">{tx.description}</td>
                                            <td className="p-4 font-mono font-bold text-slate-700">{dominantCurrency} {tx.amount}</td>
                                            <td className="p-4">
                                                <select className="bg-transparent border-none text-slate-600 font-medium cursor-pointer hover:text-emerald-600" value={tx.assignedCategory} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}>
                                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-4 text-right"><button onClick={() => handleDelete(tx.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            ) : (
                <div className="animate-fade-in">
                    <div className="flex justify-center mb-8">
                        <div className="bg-slate-100 p-1 rounded-xl inline-flex">
                            <button onClick={() => setTrendType('expense')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${trendType === 'expense' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Expense Trends</button>
                            <button onClick={() => setTrendType('income')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${trendType === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Income Trends</button>
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">Select {trendType === 'expense' ? 'Category' : 'Metric'} to Analyze</div>
                        <div className="flex gap-2 flex-wrap">
                            {trendType === 'expense' ?
                                categories.map(cat => (<button key={cat.id} onClick={() => setSelectedCategory(cat.name)} className={`px-4 py-2 rounded-xl border-2 transition-all flex items-center gap-2 ${selectedCategory === cat.name ? 'border-emerald-500 bg-emerald-50 text-slate-800' : 'border-white bg-white text-slate-500'}`}><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span className="font-bold text-sm">{cat.name}</span></button>))
                                :
                                ['neto', 'bruto', 'taxes', 'pension', 'other_deposits'].map(type => (<button key={type} onClick={() => setSelectedIncomeType(type)} className={`px-4 py-2 rounded-xl border-2 uppercase font-bold text-xs transition-all ${selectedIncomeType === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-white bg-white text-slate-500'}`}>{type.replace('_', ' ')}</button>))
                            }
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <Card className="p-4"><div className="text-slate-400 text-xs font-bold uppercase">Total {trendType === 'expense' ? 'Spent' : 'Received'}</div><div className="text-2xl font-bold text-slate-800">{dominantCurrency} {trendOverview.total.toLocaleString()}</div></Card>
                        <Card className="p-4"><div className="text-slate-400 text-xs font-bold uppercase">Monthly Avg</div><div className="text-2xl font-bold text-blue-600">{dominantCurrency} {trendOverview.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card>
                        <Card className="p-4"><div className="text-slate-400 text-xs font-bold uppercase">Highest Month</div><div className="text-2xl font-bold text-orange-500">{dominantCurrency} {trendOverview.max.toLocaleString()}</div></Card>
                    </div>

                    <Card className="p-6 mb-8 h-64"><ResponsiveContainer><BarChart data={activeTrendData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="amount" fill={trendType === 'expense' ? "#3b82f6" : "#10b981"} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Card>

                    <div className="mt-8">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Filter className="w-4 h-4" /> History ({year})</h3>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-4">Date</th><th className="p-4">Description</th><th className="p-4 text-right">Amount</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {trendTransactions.map((tx, idx) => (
                                        <tr key={tx.id || idx} className="hover:bg-slate-50 group">
                                            <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                                            <td className="p-4 font-medium text-slate-800">{tx.description}</td>
                                            <td className="p-4 text-right font-mono font-bold text-slate-700">{tx.currency || dominantCurrency} {Number(tx.amount).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN PARENT COMPONENT ---
export const AnalyticsNode = ({ data, income, categories, userId }) => {
    const [selectedYear, setSelectedYear] = useState(null);

    const dominantCurrency = useMemo(() => {
        if (!data.length) return 'ILS';
        const counts = {};
        // VALIDATION LIST FOR CURRENCIES
        const validCurrencies = ['ILS', 'USD', 'EUR', 'GBP', '₪', '$', '€', '£'];
        
        data.forEach(d => { 
            let c = d.currency || 'ILS';
            // Sanitize: If it's a long string or contains Hebrew, force it to default
            if (!validCurrencies.includes(c) && c.length > 3) {
                c = 'ILS'; 
            }
            counts[c] = (counts[c] || 0) + 1; 
        });
        
        if (Object.keys(counts).length === 0) return 'ILS';
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }, [data]);

    const years = useMemo(() => {
        const allYears = new Set([
            ...data.map(d => d.reportMonth?.split('-')[0]),
            ...income.map(d => d.month?.split('-')[0])
        ].filter(Boolean));
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

    if (selectedYear) {
        return (
            <YearDashboard
                year={selectedYear}
                data={data}
                income={income}
                categories={categories}
                userId={userId}
                onBack={() => setSelectedYear(null)}
            />
        );
    }

    return (
        <div className="p-6 animate-fade-in max-w-5xl mx-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">Lifetime Overview</h3>
            <StatsOverview totals={lifetimeTotals} currency={dominantCurrency} />

            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Calendar className="w-5 h-5 text-slate-500" /> Select Fiscal Year</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {years.map(year => (
                    <button
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-emerald-200 transition-all group text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Calendar className="w-24 h-24 text-emerald-600" />
                        </div>
                        <div className="text-4xl font-extrabold text-slate-800 group-hover:text-emerald-700 transition-colors">{year}</div>
                        <div className="text-slate-400 font-medium mt-2 flex items-center gap-2">View Report <ArrowRight className="w-4 h-4" /></div>
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