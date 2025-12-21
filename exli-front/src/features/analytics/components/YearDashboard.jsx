import React, { useState, useMemo } from 'react';
import {
    PieChart as PieIcon, BarChart3, ArrowLeft
} from 'lucide-react';
import { doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, logUserAction } from '../../../config/firebase';
import { AnalyticsReportsView } from './AnalyticsReportsView';
import { AnalyticsTrendsView } from './AnalyticsTrendsView';

export const YearDashboard = ({ year, data, income, categories, userId, onBack }) => {
    const [viewMode, setViewMode] = useState('month');
    const [trendType, setTrendType] = useState('expense');
    const [selectedMonth, setSelectedMonth] = useState('average');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
            // Subtract if refund, add otherwise. 
            // Note: We use Math.abs just in case, though amount should be positive + isRefund=true.
            // If we allow negative inputs as per recent change, we should handle that too.
            // Logic: if isRefund OR amount < 0, it reduces expense.
            const rawAmt = Number(item.amount);
            const isReduction = item.isRefund || rawAmt < 0;
            const absAmt = Math.abs(rawAmt);

            const cat = item.assignedCategory || 'Uncategorized';
            if (isReduction) {
                agg[cat] = (agg[cat] || 0) - absAmt;
            } else {
                agg[cat] = (agg[cat] || 0) + absAmt;
            }
        });
        const divider = (selectedMonth === 'average' && availableMonths.length > 0) ? availableMonths.length : 1;
        return Object.keys(agg).map(key => ({
            name: key,
            value: Math.max(0, agg[key] / divider), // Clamp to 0 to prevent breaking Pie Chart
            color: categories.find(c => c.name === key)?.color || '#64748b'
        })).sort((a, b) => b.value - a.value).filter(i => i.value > 0); // Filter out zero/negative slices
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

    const handleAddNote = async (ids, note) => {
        if (!ids.length || !note) return;
        try {
            await Promise.all(ids.map(id => {
                const ref = doc(db, 'users', userId, 'expenses', id);
                return updateDoc(ref, { note: note });
            }));
            // Update local state if needed, or rely on subscription

            // Optimistic update for immediate feedback if relying on props update which might be slow
            // Actually, for now let's just rely on the subscription or parent refresh.
        } catch (e) {
            console.error("Add note failed", e);
            alert("Failed to add note.");
        }
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
                <AnalyticsReportsView
                    totalIncome={totalIncome}
                    totalExpenses={totalExpenses}
                    totalSavings={totalSavings}
                    savingsRate={savingsRate}
                    dominantCurrency={dominantCurrency}
                    categoryStats={categoryStats}
                    incomeStats={incomeStats}
                    displayIncome={displayIncome}
                    displayExpenses={displayExpenses}
                    selectedMonth={selectedMonth}
                    selectedIds={selectedIds}
                    handleIncomeDelete={handleIncomeDelete}
                    executeDeleteMonth={executeDeleteMonth}
                    isDeleteModalOpen={isDeleteModalOpen}
                    setIsDeleteModalOpen={setIsDeleteModalOpen}
                    handleDelete={handleDelete}
                    toggleSelect={toggleSelect}
                    toggleSelectAll={toggleSelectAll}
                    executeBulkCategory={executeBulkCategory}
                    bulkCategory={bulkCategory}
                    setBulkCategory={setBulkCategory}
                    categories={categories}
                    editingId={editingId}
                    startEditAmount={startEditAmount}
                    saveAmount={saveAmount}
                    editAmountVal={editAmountVal}
                    setEditAmountVal={setEditAmountVal}
                    handleCategoryChange={handleCategoryChange}
                    formatDate={formatDate}
                    onAddNote={handleAddNote}
                />
            ) : (
                <AnalyticsTrendsView
                    trendType={trendType}
                    setTrendType={setTrendType}
                    categories={categories}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    selectedIncomeType={selectedIncomeType}
                    setSelectedIncomeType={setSelectedIncomeType}
                    selectedJobFilter={selectedJobFilter}
                    setSelectedJobFilter={setSelectedJobFilter}
                    jobOptions={jobOptions}
                    trendOverview={trendOverview}
                    dominantCurrency={dominantCurrency}
                    activeTrendData={activeTrendData}
                />
            )}
        </div>
    );
};
