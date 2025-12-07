import React, { useState, useMemo } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
    PieChart as PieIcon, Calendar, Trash2, Landmark, Wallet,
    BarChart3, ArrowRight, X, TrendingUp, Filter
} from 'lucide-react';
import { doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card, Button } from '../../components/UI';

export const AnalyticsNode = ({ data, income, categories, userId }) => {
    // View State: 'month' (original) or 'category' (new comparison view)
    const [viewMode, setViewMode] = useState('month');

    // Month View State
    const [selectedMonth, setSelectedMonth] = useState('average');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Category View State
    const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name || '');

    // --- COMMON HELPERS ---
    const dominantCurrency = useMemo(() => {
        if (!data.length) return 'ILS';
        const counts = {};
        data.forEach(d => {
            const c = d.currency || 'ILS';
            counts[c] = (counts[c] || 0) + 1;
        });
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }, [data]);

    const availableMonths = useMemo(() => {
        const months = new Set([...data.map(d => d.reportMonth), ...income.map(d => d.month)].filter(Boolean));
        return Array.from(months).sort().reverse();
    }, [data, income]);

    // --- MONTH VIEW LOGIC ---
    const filteredExpenses = useMemo(() => selectedMonth === 'average' ? data : data.filter(d => d.reportMonth === selectedMonth), [data, selectedMonth]);
    const filteredIncome = useMemo(() => selectedMonth === 'average' ? income : income.filter(d => d.month === selectedMonth), [income, selectedMonth]);

    const categoryStats = useMemo(() => {
        const agg = {};
        filteredExpenses.forEach(item => {
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
    }, [filteredExpenses, selectedMonth, availableMonths, categories]);

    const totalExpenses = categoryStats.reduce((acc, curr) => acc + curr.value, 0);

    const totalIncome = useMemo(() => {
        const agg = filteredIncome.reduce((acc, curr) => acc + (Number(curr.neto) || 0), 0);
        return selectedMonth === 'average' && availableMonths.length > 0 ? agg / availableMonths.length : agg;
    }, [filteredIncome, selectedMonth, availableMonths]);

    const totalSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

    const incomeBreakdown = useMemo(() => {
        const keys = ['bruto', 'neto', 'taxes', 'pension', 'other_deposits'];
        const agg = { bruto: 0, neto: 0, taxes: 0, pension: 0, other_deposits: 0 };
        filteredIncome.forEach(inc => {
            keys.forEach(k => agg[k] += (Number(inc[k]) || 0));
        });
        if (selectedMonth === 'average' && availableMonths.length > 0) {
            keys.forEach(k => agg[k] = agg[k] / availableMonths.length);
        }
        return agg;
    }, [filteredIncome, selectedMonth, availableMonths]);

    const lifetimeTotals = useMemo(() => {
        const exp = data.reduce((acc, curr) => acc + (curr.isRefund ? 0 : Number(curr.amount)), 0);
        const incNet = income.reduce((acc, curr) => acc + (Number(curr.neto) || 0), 0);
        const pension = income.reduce((acc, curr) => acc + (Number(curr.pension) || 0), 0);
        const taxes = income.reduce((acc, curr) => acc + (Number(curr.taxes) || 0), 0);
        return { exp, incNet, pension, taxes, wealth: (incNet - exp) + pension };
    }, [data, income]);

    // --- CATEGORY VIEW LOGIC ---
    const categoryTrendData = useMemo(() => {
        if (!selectedCategory) return [];
        // Filter all expenses for this category
        const relevantTx = data.filter(d => (d.assignedCategory || 'Uncategorized') === selectedCategory && !d.isRefund);

        // Group by month
        const monthlyAgg = {};
        relevantTx.forEach(tx => {
            const m = tx.reportMonth || 'Unknown';
            monthlyAgg[m] = (monthlyAgg[m] || 0) + Number(tx.amount);
        });

        // Fill in missing months with 0 so the chart looks continuous (optional, but good for "trends")
        // For simplicity, we just map existing data sorted by month
        return Object.entries(monthlyAgg)
            .map(([month, amount]) => ({ month, amount }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [data, selectedCategory]);

    const categoryOverview = useMemo(() => {
        const total = categoryTrendData.reduce((acc, curr) => acc + curr.amount, 0);
        const count = categoryTrendData.length;
        const avg = count > 0 ? total / availableMonths.length : 0; // Avg over ALL months being tracked
        const max = Math.max(...categoryTrendData.map(d => d.amount), 0);
        return { total, avg, max };
    }, [categoryTrendData, availableMonths]);

    const categoryTransactions = useMemo(() => {
        return data
            .filter(d => (d.assignedCategory || 'Uncategorized') === selectedCategory && !d.isRefund)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [data, selectedCategory]);


    // --- ACTIONS ---
    const handleDelete = async (docId) => { if (confirm('Delete?')) await deleteDoc(doc(db, 'users', userId, 'expenses', docId)); };
    const handleCategoryChange = async (docId, newCat) => { await updateDoc(doc(db, 'users', userId, 'expenses', docId), { assignedCategory: newCat }); };

    const executeDeleteMonth = async (mode) => {
        if (selectedMonth === 'average' || selectedMonth === 'lifetime') return;
        setIsDeleteModalOpen(false);

        try {
            const batch = writeBatch(db);
            let count = 0;

            if (mode === 'expenses' || mode === 'both') {
                filteredExpenses.forEach(tx => {
                    const ref = doc(db, 'users', userId, 'expenses', tx.id);
                    batch.delete(ref);
                    count++;
                });
            }

            if (mode === 'income' || mode === 'both') {
                filteredIncome.forEach(inc => {
                    const ref = doc(db, 'users', userId, 'income', inc.id);
                    batch.delete(ref);
                    count++;
                });
            }

            await batch.commit();
            console.log(`Deleted ${count} docs`);
            if (mode === 'both') setSelectedMonth('average');
        } catch (error) {
            console.error("Error:", error);
            alert("Delete failed.");
        }
    };

    // --- RENDERERS ---

    if (selectedMonth === 'lifetime') {
        return (
            <div className="p-6 animate-fade-in">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Landmark className="w-6 h-6 text-purple-600" /> Lifetime Totals</h2>
                    <button onClick={() => setSelectedMonth('average')} className="text-slate-500 hover:text-slate-800">Back to Reports</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-8 bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
                        <div className="text-emerald-600 font-bold uppercase tracking-widest text-sm mb-2">Net Wealth Generated</div>
                        <div className="text-5xl font-extrabold text-slate-800">{dominantCurrency} {lifetimeTotals.wealth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <p className="text-slate-500 mt-2">Savings + Pension Accumulation</p>
                    </Card>
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="p-6"><div className="text-slate-400 text-xs font-bold uppercase">Total Income (Net)</div><div className="text-2xl font-bold text-slate-800 mt-1">{dominantCurrency} {lifetimeTotals.incNet.toLocaleString()}</div></Card>
                        <Card className="p-6"><div className="text-slate-400 text-xs font-bold uppercase">Total Expenses</div><div className="text-2xl font-bold text-slate-800 mt-1">{dominantCurrency} {lifetimeTotals.exp.toLocaleString()}</div></Card>
                        <Card className="p-6"><div className="text-slate-400 text-xs font-bold uppercase">Total Pension</div><div className="text-2xl font-bold text-purple-600 mt-1">{dominantCurrency} {lifetimeTotals.pension.toLocaleString()}</div></Card>
                        <Card className="p-6"><div className="text-slate-400 text-xs font-bold uppercase">Taxes Paid</div><div className="text-2xl font-bold text-red-500 mt-1">{dominantCurrency} {lifetimeTotals.taxes.toLocaleString()}</div></Card>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 animate-fade-in">
            {/* --- TOP BAR: View Mode Toggler --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('month')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <PieIcon className="w-4 h-4" /> Monthly Reports
                    </button>
                    <button
                        onClick={() => setViewMode('category')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'category' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BarChart3 className="w-4 h-4" /> Category Trends
                    </button>
                </div>

                {viewMode === 'month' && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 max-w-full">
                        <button onClick={() => setSelectedMonth('lifetime')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200`}>🚀 Lifetime</button>
                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        <button onClick={() => setSelectedMonth('average')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === 'average' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📊 Avg</button>
                        {availableMonths.map(m => (
                            <button key={m} onClick={() => setSelectedMonth(m)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === m ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{m}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* ==================== MONTHLY REPORT VIEW ==================== */}
            {viewMode === 'month' && (
                <>
                    <h2 className="text-xl font-bold text-slate-800 mb-6">{selectedMonth === 'average' ? 'Monthly Averages' : `Report: ${selectedMonth}`}</h2>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <Card className="p-4 flex flex-col justify-between">
                            <div className="text-slate-400 text-xs font-bold uppercase">Net Income</div>
                            <div className="text-2xl font-bold text-emerald-600">{dominantCurrency} {totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </Card>
                        <Card className="p-4 flex flex-col justify-between">
                            <div className="text-slate-400 text-xs font-bold uppercase">Total Expenses</div>
                            <div className="text-2xl font-bold text-slate-800">{dominantCurrency} {totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </Card>
                        <Card className={`p-4 flex flex-col justify-between border-l-4 ${savingsRate > 20 ? 'border-emerald-500' : savingsRate > 0 ? 'border-yellow-400' : 'border-red-500'}`}>
                            <div className="flex justify-between">
                                <div className="text-slate-400 text-xs font-bold uppercase">Spare Money</div>
                                <div className={`text-xs font-bold px-2 rounded ${savingsRate > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{savingsRate.toFixed(1)}% Rate</div>
                            </div>
                            <div className={`text-2xl font-bold ${totalSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{dominantCurrency} {totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </Card>
                    </div>

                    {/* Breakdown & Income */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                        <Card className="p-6 lg:col-span-2">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700">Expenses Breakdown</h3></div>
                            <div className="flex flex-col md:flex-row items-center">
                                <div className="h-64 w-full md:w-1/2">
                                    <ResponsiveContainer minWidth={0}>
                                        <PieChart>
                                            <Pie data={categoryStats} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                                                {categoryStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                            </Pie>
                                            <Tooltip formatter={(val) => `${dominantCurrency} ${val.toFixed(0)}`} />
                                        </PieChart>
                                    </ResponsiveContainer>
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
                        <Card className="p-6">
                            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> Income Details</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100"><span className="text-slate-500 text-sm">Gross (Bruto)</span><span className="font-mono font-bold text-slate-700">{dominantCurrency} {incomeBreakdown.bruto.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                <div className="flex justify-between items-center text-red-400"><span className="text-sm">Taxes & Deductions</span><span className="font-mono font-bold">-{dominantCurrency} {incomeBreakdown.taxes.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                <div className="flex justify-between items-center pt-2"><span className="text-slate-800 font-bold">Net (Bank)</span><span className="font-mono font-bold text-emerald-600 text-lg">{dominantCurrency} {incomeBreakdown.neto.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                <div className="mt-6 pt-4 border-t border-slate-100">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-3">Hidden Savings</div>
                                    <div className="flex justify-between items-center mb-2"><span className="text-slate-500 text-sm">Pension</span><span className="font-mono font-bold text-purple-600">+{dominantCurrency} {incomeBreakdown.pension.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-500 text-sm">Deposits / Funds</span><span className="font-mono font-bold text-orange-500">+{dominantCurrency} {incomeBreakdown.other_deposits.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Delete Month Button & Modal */}
                    {selectedMonth !== 'average' && (
                        <div className="flex justify-end mb-8 relative">
                            <button onClick={() => setIsDeleteModalOpen(true)} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
                                <Trash2 className="w-4 h-4" /> Delete Month Data
                            </button>

                            {/* Delete Selection Modal */}
                            {isDeleteModalOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-10 animate-fade-in">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-slate-800 text-sm">Clear {selectedMonth}</h4>
                                        <button onClick={() => setIsDeleteModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                    </div>
                                    <div className="space-y-2">
                                        <button onClick={() => executeDeleteMonth('expenses')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-medium">Clear Expenses Only</button>
                                        <button onClick={() => executeDeleteMonth('income')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-600 text-sm font-medium">Clear Income Only</button>
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button onClick={() => executeDeleteMonth('both')} className="w-full text-left px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Clear Everything</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Transaction Log */}
                    {selectedMonth !== 'average' && (
                        <div className="mt-8">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5" /> Expense Log</h3>
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-4">Date</th><th className="p-4">Description</th><th className="p-4">Amount</th><th className="p-4">Category</th><th className="p-4 text-right">Actions</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredExpenses.map(tx => (
                                            <tr key={tx.id} className="hover:bg-slate-50 group">
                                                <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                                <td className="p-4 font-medium text-slate-800">{tx.description}</td>
                                                <td className="p-4 font-mono font-bold text-slate-700">{tx.currency || dominantCurrency} {tx.amount.toFixed(2)}</td>
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
                        </div>
                    )}
                </>
            )}

            {/* ==================== CATEGORY TRENDS VIEW ==================== */}
            {viewMode === 'category' && (
                <div className="animate-fade-in">
                    {/* Category Selector */}
                    <div className="mb-8">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">Select Category to Analyze</div>
                        <div className="flex gap-2 flex-wrap">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.name)}
                                    className={`px-4 py-2 rounded-xl border-2 transition-all flex items-center gap-2 ${selectedCategory === cat.name ? 'border-emerald-500 bg-emerald-50 text-slate-800 shadow-sm' : 'border-white bg-white text-slate-500 hover:border-slate-200'}`}
                                >
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                    <span className="font-bold text-sm">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Summary Stats for Category */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <Card className="p-4">
                            <div className="text-slate-400 text-xs font-bold uppercase">Total Spent</div>
                            <div className="text-2xl font-bold text-slate-800">{dominantCurrency} {categoryOverview.total.toLocaleString()}</div>
                            <div className="text-xs text-slate-400 mt-1">Lifetime</div>
                        </Card>
                        <Card className="p-4">
                            <div className="text-slate-400 text-xs font-bold uppercase">Monthly Average</div>
                            <div className="text-2xl font-bold text-blue-600">{dominantCurrency} {categoryOverview.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-slate-400 mt-1">Per active month</div>
                        </Card>
                        <Card className="p-4">
                            <div className="text-slate-400 text-xs font-bold uppercase">Highest Month</div>
                            <div className="text-2xl font-bold text-orange-500">{dominantCurrency} {categoryOverview.max.toLocaleString()}</div>
                            <div className="text-xs text-slate-400 mt-1">Peak spending</div>
                        </Card>
                    </div>

                    {/* Chart */}
                    <Card className="p-6 mb-8">
                        <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500" /> Spending Trend: {selectedCategory}</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Transaction List for Category */}
                    <div className="mt-8">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Filter className="w-4 h-4" /> Transaction History</h3>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-4">Date</th><th className="p-4">Description</th><th className="p-4">Amount</th><th className="p-4 text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {categoryTransactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50 group">
                                            <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                            <td className="p-4 font-medium text-slate-800">{tx.description}</td>
                                            <td className="p-4 font-mono font-bold text-slate-700">{tx.currency || dominantCurrency} {tx.amount.toFixed(2)}</td>
                                            <td className="p-4 text-right"><button onClick={() => handleDelete(tx.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
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