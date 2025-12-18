import React, { useState, useMemo, useEffect } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
    PieChart as PieIcon, Calendar, Trash2, Landmark, Wallet,
    BarChart3, ArrowRight, X, TrendingUp, Filter, ArrowLeft,
    DollarSign, Percent, CheckSquare, Square, Edit2, Check, Briefcase, Info, RotateCcw
} from 'lucide-react';
import { doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, logUserAction } from '../../config/firebase';
import { Card, Button, CategoryIcon } from '../../components/UI';

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
    const [hoveredIncome, setHoveredIncome] = useState(null);

    // Selection & Bulk Action
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkCategory, setBulkCategory] = useState('');

    // Inline Edit
    const [editingId, setEditingId] = useState(null);
    const [editAmountVal, setEditAmountVal] = useState('');

    const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name || '');
    const [selectedIncomeType, setSelectedIncomeType] = useState('neto');
    const [selectedJobFilter, setSelectedJobFilter] = useState('All Jobs');

    const formatDate = (dateStr) => {
        try { return new Date(dateStr).toLocaleDateString(); } catch (e) { return dateStr; }
    };

    const filteredData = useMemo(() => {
        return {
            expenses: data.filter(d => (d.reportMonth || "").startsWith(year)),
            income: income.filter(d => (d.month || "").startsWith(year))
        };
    }, [data, income, year]);

    const dominantCurrency = useMemo(() => {
        if (!data.length) return 'ILS';
        const counts = {};
        const validCurrencies = ['ILS', 'USD', 'EUR', 'GBP', '₪', '$', '€', '£'];
        data.forEach(d => {
            let c = d.currency || 'ILS';
            if (!validCurrencies.includes(c) && c.length > 3) c = 'ILS';
            counts[c] = (counts[c] || 0) + 1;
        });
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'ILS');
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
        const divider = (selectedMonth === 'average' && availableMonths.length > 0) ? availableMonths.length : 1;
        return Object.keys(agg).map(key => ({
            name: key,
            value: agg[key] / divider,
            color: categories.find(c => c.name === key)?.color || '#64748b'
        })).sort((a, b) => b.value - a.value);
    }, [displayExpenses, selectedMonth, availableMonths, categories]);

    const incomeStats = useMemo(() => {
        const agg = {};
        const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
        displayIncome.forEach(item => {
            const source = item.source_name || 'Other Income';
            if (!agg[source]) agg[source] = { neto: 0, bruto: 0, taxes: 0, pension: 0, count: 0 };
            agg[source].neto += Number(item.neto) || 0;
            agg[source].bruto += Number(item.bruto) || 0;
            agg[source].taxes += Number(item.taxes) || 0;
            agg[source].pension += Number(item.pension) || 0;
            agg[source].count++;
        });
        const divider = (selectedMonth === 'average' && availableMonths.length > 0) ? availableMonths.length : 1;
        return Object.keys(agg).map((key, idx) => ({
            name: key,
            value: agg[key].neto / divider,
            bruto: agg[key].bruto / divider,
            taxes: agg[key].taxes / divider,
            pension: agg[key].pension / divider,
            color: colors[idx % colors.length]
        })).sort((a, b) => b.value - a.value);
    }, [displayIncome, selectedMonth, availableMonths]);

    const totalExpenses = categoryStats.reduce((acc, curr) => acc + curr.value, 0);
    const totalIncome = incomeStats.reduce((acc, curr) => acc + curr.value, 0);
    const totalSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

    const jobOptions = useMemo(() => {
        const jobs = new Set(filteredData.income.map(i => i.source_name).filter(Boolean));
        return ['All Jobs', ...Array.from(jobs)];
    }, [filteredData.income]);

    const activeTrendData = useMemo(() => {
        if (trendType === 'expense') {
            const relevantTx = filteredData.expenses.filter(d => (d.assignedCategory || 'Uncategorized') === selectedCategory && !d.isRefund);
            const monthlyAgg = {};
            relevantTx.forEach(tx => { const m = tx.reportMonth || 'Unknown'; monthlyAgg[m] = (monthlyAgg[m] || 0) + Number(tx.amount); });
            return Object.entries(monthlyAgg).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
        } else {
            const monthlyAgg = {};
            filteredData.income.forEach(inc => {
                if (selectedJobFilter !== 'All Jobs' && inc.source_name !== selectedJobFilter) return;
                const m = inc.month || 'Unknown';
                monthlyAgg[m] = (monthlyAgg[m] || 0) + (Number(inc[selectedIncomeType]) || 0);
            });
            return Object.entries(monthlyAgg).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
        }
    }, [filteredData, selectedCategory, selectedIncomeType, trendType, selectedJobFilter]);

    const trendOverview = useMemo(() => {
        const total = activeTrendData.reduce((acc, curr) => acc + curr.amount, 0);
        const avg = availableMonths.length > 0 ? total / availableMonths.length : 0;
        const max = Math.max(...activeTrendData.map(d => d.amount), 0);
        return { total, avg, max };
    }, [activeTrendData, availableMonths]);

    const handleIncomeDelete = async (id) => {
        if (confirm('Delete this income record?')) {
            await deleteDoc(doc(db, 'users', userId, 'income', id));
            logUserAction(userId, 'INCOME_DELETE', `Deleted income ${id}`);
        }
    };

    const executeDeleteMonth = async (mode) => {
        if (selectedMonth === 'average') return;
        setIsDeleteModalOpen(false);
        try {
            const batch = writeBatch(db);
            if (mode === 'expenses' || mode === 'both') displayExpenses.forEach(tx => batch.delete(doc(db, 'users', userId, 'expenses', tx.id)));
            if (mode === 'income' || mode === 'both') displayIncome.forEach(inc => batch.delete(doc(db, 'users', userId, 'income', inc.id)));
            await batch.commit();
            logUserAction(userId, 'DELETE_MONTH', `Deleted ${mode} for ${selectedMonth}`);
            if (mode === 'both') setSelectedMonth('average');
        } catch (error) { console.error(error); alert("Delete failed."); }
    };

    const handleDelete = async (docId) => {
        if (confirm('Delete?')) {
            await deleteDoc(doc(db, 'users', userId, 'expenses', docId));
            logUserAction(userId, 'EXPENSE_DELETE', `Deleted expense ${docId}`);
        }
    };

    const handleCategoryChange = async (docId, newCat) => {
        await updateDoc(doc(db, 'users', userId, 'expenses', docId), { assignedCategory: newCat });
        logUserAction(userId, 'CATEGORY_CHANGE', `Moved expense to ${newCat}`);
    };

    const toggleSelect = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
        else setSelectedIds([...selectedIds, id]);
    };
    const toggleSelectAll = () => {
        if (selectedIds.length === displayExpenses.length) setSelectedIds([]);
        else setSelectedIds(displayExpenses.map(t => t.id));
    };
    const executeBulkCategory = async () => {
        if (!bulkCategory || selectedIds.length === 0) return;
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
            const ref = doc(db, 'users', userId, 'expenses', id);
            batch.update(ref, { assignedCategory: bulkCategory });
        });
        await batch.commit();
        logUserAction(userId, 'BULK_UPDATE', `Moved ${selectedIds.length} items to ${bulkCategory}`);
        setSelectedIds([]);
        setBulkCategory('');
    };

    const startEditAmount = (tx) => {
        setEditingId(tx.id);
        setEditAmountVal(tx.amount);
    };
    const saveAmount = async (id) => {
        const val = parseFloat(editAmountVal);
        if (!isNaN(val) && val > 0) {
            await updateDoc(doc(db, 'users', userId, 'expenses', id), { amount: val });
            logUserAction(userId, 'EXPENSE_EDIT', `Updated amount to ${val}`);
        }
        setEditingId(null);
    };

    return (
        <div className="animate-fade-in relative pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft className="w-6 h-6" /></button>
                    <h2 className="text-2xl font-bold text-slate-800">{year} Dashboard</h2>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setViewMode('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}><PieIcon className="w-4 h-4" /> Reports</button>
                    <button onClick={() => setViewMode('category')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'category' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}><BarChart3 className="w-4 h-4" /> Trends</button>
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
                        <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Net Income</div><div className="text-2xl font-bold text-emerald-600">{dominantCurrency} {totalIncome.toLocaleString()}</div></Card>
                        <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Total Expenses</div><div className="text-2xl font-bold text-slate-800">{dominantCurrency} {totalExpenses.toLocaleString()}</div></Card>
                        <Card className={`p-4 flex flex-col justify-between border-l-4 ${totalSavings >= 0 ? 'border-emerald-500' : 'border-red-500'}`}><div className="flex justify-between text-xs font-bold uppercase text-slate-400">Spare Money <span className="text-emerald-600">{savingsRate.toFixed(1)}%</span></div><div className="text-2xl font-bold text-slate-800">{dominantCurrency} {totalSavings.toLocaleString()}</div></Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <Card className="p-6">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-red-400" /> Expenses Breakdown</h3>
                            <div className="flex flex-col md:flex-row items-center h-64">
                                <div className="h-full w-full md:w-1/2">
                                    <ResponsiveContainer minWidth={0}><PieChart><Pie data={categoryStats} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2}>{categoryStats.map((e, i) => (<Cell key={i} fill={e.color} />))}</Pie><Tooltip formatter={(v) => `${dominantCurrency} ${v.toFixed(0)}`} /></PieChart></ResponsiveContainer>
                                </div>
                                <div className="w-full md:w-1/2 overflow-y-auto h-full pr-2 space-y-2 custom-scrollbar">
                                    {categoryStats.map(s => (
                                        <div key={s.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</div>
                                            <div className="font-bold">{dominantCurrency}{s.value.toFixed(0)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> Income Sources</h3>
                            <div className="flex flex-col md:flex-row items-center h-64">
                                <div className="h-full w-full md:w-1/2">
                                    <ResponsiveContainer minWidth={0}><PieChart><Pie data={incomeStats} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2}>{incomeStats.map((e, i) => (<Cell key={i} fill={e.color} />))}</Pie><Tooltip formatter={(v) => `${dominantCurrency} ${v.toFixed(0)}`} /></PieChart></ResponsiveContainer>
                                </div>
                                <div className="w-full md:w-1/2 overflow-y-auto h-full pr-2 space-y-3 custom-scrollbar">
                                    {incomeStats.map((s, idx) => (
                                        <div
                                            key={s.name}
                                            className="relative flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-help group"
                                            onMouseEnter={() => setHoveredIncome(s.name)}
                                            onMouseLeave={() => setHoveredIncome(null)}
                                        >
                                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</div>
                                            <div className="font-bold text-emerald-600">{dominantCurrency}{s.value.toFixed(0)}</div>

                                            {hoveredIncome === s.name && (
                                                <div className={`absolute right-0 w-48 bg-slate-900 text-white rounded-xl p-3 shadow-2xl z-50 animate-fade-in ${idx < 2 ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                                    <div className="font-bold border-b border-slate-700 pb-1 mb-2 text-emerald-400 text-[11px] truncate">{s.name}</div>
                                                    <div className="space-y-1 text-[10px]">
                                                        <div className="flex justify-between">Gross <span>{dominantCurrency}{s.bruto.toFixed(0)}</span></div>
                                                        <div className="flex justify-between text-red-400">Tax <span>-{dominantCurrency}{s.taxes.toFixed(0)}</span></div>
                                                        <div className="flex justify-between text-purple-400">Pension <span>{dominantCurrency}{s.pension.toFixed(0)}</span></div>
                                                        <div className="border-t border-slate-700 mt-1 pt-1 flex justify-between font-bold text-emerald-400">Net <span>{dominantCurrency}{s.value.toFixed(0)}</span></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="mt-8 mb-20 space-y-8">
                        <div>
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Income Details ({selectedMonth})</h3>
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr><th className="p-4">Source</th><th className="p-4">Gross</th><th className="p-4">Taxes</th><th className="p-4">Net (Bank)</th><th className="p-4 text-right">Actions</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayIncome.map(inc => (
                                            <tr key={inc.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-bold text-slate-800">{inc.source_name}</td>
                                                <td className="p-4 font-mono">{dominantCurrency}{Number(inc.bruto).toLocaleString()}</td>
                                                <td className="p-4 font-mono text-red-400">-{dominantCurrency}{Number(inc.taxes).toLocaleString()}</td>
                                                <td className="p-4 font-mono font-bold text-emerald-600">{dominantCurrency}{Number(inc.neto).toLocaleString()}</td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => handleIncomeDelete(inc.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {selectedMonth !== 'average' && (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Expense History</h3>
                                    <div className="relative">
                                        <button onClick={() => setIsDeleteModalOpen(true)} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /> Clear Month</button>
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
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="p-4 w-10 text-center cursor-pointer" onClick={toggleSelectAll}>
                                                    {selectedIds.length > 0 && selectedIds.length === displayExpenses.length ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5 text-slate-300" />}
                                                </th>
                                                <th className="p-4">Date</th>
                                                <th className="p-4">Description</th>
                                                <th className="p-4">Amount</th>
                                                <th className="p-4">Category</th>
                                                <th className="p-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {displayExpenses.map(tx => (
                                                <tr key={tx.id} className={`hover:bg-slate-50 group ${selectedIds.includes(tx.id) ? 'bg-blue-50/50' : ''}`}>
                                                    <td className="p-4 text-center cursor-pointer" onClick={() => toggleSelect(tx.id)}>
                                                        {selectedIds.includes(tx.id) ? <CheckSquare className="w-5 h-5 text-blue-500" /> : <Square className="w-5 h-5 text-slate-200" />}
                                                    </td>
                                                    <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                                                    <td className="p-4 font-bold text-slate-800">{tx.description}</td>
                                                    <td className="p-4">
                                                        {editingId === tx.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <input type="number" className="w-24 p-1 border rounded" value={editAmountVal} onChange={e => setEditAmountVal(e.target.value)} autoFocus />
                                                                <button onClick={() => saveAmount(tx.id)} className="text-emerald-500"><Check className="w-4 h-4" /></button>
                                                            </div>
                                                        ) : (
                                                            <div onClick={() => startEditAmount(tx)} className="font-mono font-bold text-slate-700 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded inline-flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                                                                {dominantCurrency} {tx.amount}
                                                            </div>
                                                        )}
                                                    </td>
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
                    </div>

                    {selectedIds.length > 0 && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-fade-in">
                            <span className="font-bold text-sm">{selectedIds.length} Selected</span>
                            <div className="h-4 w-px bg-slate-700"></div>
                            <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} className="bg-slate-800 border-none text-sm text-white rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-slate-700 transition-colors">
                                <option value="">Move to...</option>
                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            <button onClick={executeBulkCategory} disabled={!bulkCategory} className="bg-emerald-500 hover:bg-emerald-400 text-white p-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setSelectedIds([])} className="ml-2 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                    )}
                </>
            ) : (
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