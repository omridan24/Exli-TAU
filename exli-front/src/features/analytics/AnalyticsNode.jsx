import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieIcon, Calendar, Trash2, Landmark, Wallet } from 'lucide-react';
import { doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card } from '../../components/UI';

export const AnalyticsNode = ({ data, income, categories, userId }) => {
    const [selectedMonth, setSelectedMonth] = useState('average');

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

    const handleDelete = async (docId) => { if (confirm('Delete?')) await deleteDoc(doc(db, 'users', userId, 'expenses', docId)); };
    const handleCategoryChange = async (docId, newCat) => { await updateDoc(doc(db, 'users', userId, 'expenses', docId), { assignedCategory: newCat }); };
    const handleDeleteMonth = async () => {
        if (selectedMonth === 'average' || selectedMonth === 'lifetime') return;
        if (!confirm(`Delete ALL transactions for ${selectedMonth}?`)) return;
        try {
            const batch = writeBatch(db);
            filteredExpenses.forEach(tx => { const ref = doc(db, 'users', userId, 'expenses', tx.id); batch.delete(ref); });
            await batch.commit();
            setSelectedMonth('average');
        } catch (error) {
            console.error("Error:", error);
        }
    };

    if (selectedMonth === 'lifetime') {
        return (<div className="p-6 animate-fade-in"><div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Landmark className="w-6 h-6 text-purple-600" /> Lifetime Totals</h2><button onClick={() => setSelectedMonth('average')} className="text-slate-500 hover:text-slate-800">Back to Reports</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><Card className="p-8 bg-gradient-to-br from-emerald-50 to-white border-emerald-100"><div className="text-emerald-600 font-bold uppercase tracking-widest text-sm mb-2">Net Wealth Generated</div><div className="text-5xl font-extrabold text-slate-800">{dominantCurrency} {lifetimeTotals.wealth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div><p className="text-slate-500 mt-2">Savings + Pension Accumulation</p></Card><div className="grid grid-cols-2 gap-4"><Card className="p-6"><div className="text-slate-400 text-xs font-bold uppercase">Total Income (Net)</div><div className="text-2xl font-bold text-slate-800 mt-1">{dominantCurrency} {lifetimeTotals.incNet.toLocaleString()}</div></Card><Card className="p-6"><div className="text-slate-400 text-xs font-bold uppercase">Total Expenses</div><div className="text-2xl font-bold text-slate-800 mt-1">{dominantCurrency} {lifetimeTotals.exp.toLocaleString()}</div></Card><Card className="p-6"><div className="text-slate-400 text-xs font-bold uppercase">Total Pension</div><div className="text-2xl font-bold text-purple-600 mt-1">{dominantCurrency} {lifetimeTotals.pension.toLocaleString()}</div></Card><Card className="p-6"><div className="text-slate-400 text-xs font-bold uppercase">Taxes Paid</div><div className="text-2xl font-bold text-red-500 mt-1">{dominantCurrency} {lifetimeTotals.taxes.toLocaleString()}</div></Card></div></div></div>);
    }

    return (<div className="p-6 animate-fade-in"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><PieIcon className="w-6 h-6 text-blue-600" /> {selectedMonth === 'average' ? 'Monthly Averages' : `Report: ${selectedMonth}`}</h2><div className="flex items-center gap-2 overflow-x-auto pb-2"><button onClick={() => setSelectedMonth('lifetime')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200`}>🚀 Lifetime</button><div className="w-px h-6 bg-slate-200 mx-1"></div><button onClick={() => setSelectedMonth('average')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === 'average' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📊 Avg</button>{availableMonths.map(m => (<button key={m} onClick={() => setSelectedMonth(m)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === m ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{m}</button>))}</div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"><Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Net Income</div><div className="text-2xl font-bold text-emerald-600">{dominantCurrency} {totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card><Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Total Expenses</div><div className="text-2xl font-bold text-slate-800">{dominantCurrency} {totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card><Card className={`p-4 flex flex-col justify-between border-l-4 ${savingsRate > 20 ? 'border-emerald-500' : savingsRate > 0 ? 'border-yellow-400' : 'border-red-500'}`}><div className="flex justify-between"><div className="text-slate-400 text-xs font-bold uppercase">Spare Money</div><div className={`text-xs font-bold px-2 rounded ${savingsRate > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{savingsRate.toFixed(1)}% Rate</div></div><div className={`text-2xl font-bold ${totalSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{dominantCurrency} {totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card></div><div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12"><Card className="p-6 lg:col-span-2"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700">Expenses Breakdown</h3></div><div className="flex flex-col md:flex-row items-center"><div className="h-64 w-full md:w-1/2"><ResponsiveContainer minWidth={0}><PieChart><Pie data={categoryStats} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>{categoryStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(val) => `${dominantCurrency} ${val.toFixed(0)}`} /></PieChart></ResponsiveContainer></div><div className="w-full md:w-1/2 space-y-2 pl-4 h-64 overflow-y-auto">{categoryStats.map(stat => (<div key={stat.name} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div><span className="text-slate-600 truncate w-32">{stat.name}</span></div><div className="font-mono font-bold text-slate-700">{dominantCurrency} {stat.value.toFixed(0)}</div></div>))}</div></div></Card><Card className="p-6"><h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> Income Details</h3><div className="space-y-4"><div className="flex justify-between items-center pb-2 border-b border-slate-100"><span className="text-slate-500 text-sm">Gross (Bruto)</span><span className="font-mono font-bold text-slate-700">{dominantCurrency} {incomeBreakdown.bruto.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div><div className="flex justify-between items-center text-red-400"><span className="text-sm">Taxes & Deductions</span><span className="font-mono font-bold">-{dominantCurrency} {incomeBreakdown.taxes.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div><div className="flex justify-between items-center pt-2"><span className="text-slate-800 font-bold">Net (Bank)</span><span className="font-mono font-bold text-emerald-600 text-lg">{dominantCurrency} {incomeBreakdown.neto.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div><div className="mt-6 pt-4 border-t border-slate-100"><div className="text-xs font-bold text-slate-400 uppercase mb-3">Hidden Savings</div><div className="flex justify-between items-center mb-2"><span className="text-slate-500 text-sm">Pension</span><span className="font-mono font-bold text-purple-600">+{dominantCurrency} {incomeBreakdown.pension.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div><div className="flex justify-between items-center"><span className="text-slate-500 text-sm">Deposits / Funds</span><span className="font-mono font-bold text-orange-500">+{dominantCurrency} {incomeBreakdown.other_deposits.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div></div></div></Card></div>{selectedMonth !== 'average' && (<div className="flex justify-end mb-8"><button onClick={handleDeleteMonth} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /> Delete Month Data</button></div>)}{selectedMonth !== 'average' && (<div className="mt-8"><h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5" /> Expense Log</h3><div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-4">Date</th><th className="p-4">Description</th><th className="p-4">Amount</th><th className="p-4">Category</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredExpenses.map(tx => (<tr key={tx.id} className="hover:bg-slate-50 group"><td className="p-4 text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td><td className="p-4 font-medium text-slate-800">{tx.description}</td><td className="p-4 font-mono font-bold text-slate-700">{tx.currency || dominantCurrency} {tx.amount.toFixed(2)}</td><td className="p-4"><select className="bg-transparent border-none text-slate-600 font-medium cursor-pointer hover:text-emerald-600" value={tx.assignedCategory} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></td><td className="p-4 text-right"><button onClick={() => handleDelete(tx.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td></tr>))}</tbody></table></div></div>)}</div>);
};