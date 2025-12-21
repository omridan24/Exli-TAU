import React, { useState } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from 'recharts';
import {
    Trash2, DollarSign, Wallet, CheckSquare, Square,
    Check, X, Briefcase
} from 'lucide-react';
import { Card } from '../../../components/UI';

export const AnalyticsReportsView = ({
    totalIncome, totalExpenses, totalSavings, savingsRate, dominantCurrency,
    categoryStats, incomeStats, displayIncome, displayExpenses,
    selectedMonth, selectedIds,
    handleIncomeDelete, executeDeleteMonth, isDeleteModalOpen, setIsDeleteModalOpen,
    handleDelete, toggleSelect, toggleSelectAll,
    executeBulkCategory, bulkCategory, setBulkCategory, categories,
    editingId, startEditAmount, saveAmount, editAmountVal, setEditAmountVal,
    handleCategoryChange, formatDate
}) => {
    const [hoveredIncome, setHoveredIncome] = useState(null);

    return (
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
                                    {displayExpenses.map(tx => {
                                        // Check if transaction is a refund (either flag or negative amount)
                                        const isRefundItem = tx.isRefund || tx.amount < 0;
                                        const displayAmount = Math.abs(tx.amount); // Show positive magnitude

                                        return (
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
                                                        <div onClick={() => startEditAmount(tx)} className={`font-mono font-bold cursor-pointer hover:bg-slate-100 px-2 py-1 rounded inline-flex items-center gap-2 group-hover:text-blue-600 transition-colors ${isRefundItem ? 'text-emerald-500' : 'text-slate-700'}`}>
                                                            {isRefundItem ? '+' : ''}{dominantCurrency} {displayAmount}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <select className="bg-transparent border-none text-slate-600 font-medium cursor-pointer hover:text-emerald-600" value={tx.assignedCategory} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}>
                                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                    </select>
                                                    {isRefundItem && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Refund</span>}
                                                </td>
                                                <td className="p-4 text-right"><button onClick={() => handleDelete(tx.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                                            </tr>
                                        );
                                    })}
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
    );
};
