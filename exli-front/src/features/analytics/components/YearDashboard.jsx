import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PieChart as PieIcon, BarChart3, ArrowLeft
} from 'lucide-react';
import { doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, logUserAction } from '../../../config/firebase';
import { AnalyticsReportsView } from './AnalyticsReportsView';
import { expensesApi } from '../../../config/expensesApi';
import { AnalyticsTrendsView } from './AnalyticsTrendsView';
import { useFx } from '../../../lib/fx/useFx';

export const YearDashboard = ({ year, data, income, categories, userId, onBack, initialViewMode = 'month', initialCategory }) => {
    const { t } = useTranslation();
    // Called early, before any useMemo below that depends on it - see the
    // FX plan §1's flagged bug (mixed-currency amounts summed as if they
    // were one) and the InvestmentNode.jsx TDZ mistake this project already
    // hit once from getting this ordering wrong.
    const { toDefault, defaultCurrency, dataVersion } = useFx();
    const [viewMode, setViewMode] = useState(initialViewMode);
    const [trendType, setTrendType] = useState('expense');
    const [selectedMonth, setSelectedMonth] = useState('average');
    const [hoveredMonth, setHoveredMonth] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Selection & Bulk Action
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkCategory, setBulkCategory] = useState('');

    // Toast notifications
    const [successMessage, setSuccessMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    // Inline Edit
    const [editingId, setEditingId] = useState(null);
    const [editAmountVal, setEditAmountVal] = useState('');

    const [selectedCategory, setSelectedCategory] = useState(initialCategory || categories[0]?.name || '');
    const [selectedIncomeType, setSelectedIncomeType] = useState('neto');
    const [selectedJobFilter, setSelectedJobFilter] = useState('ALL_JOBS');

    const formatDate = (dateStr) => {
        try { return new Date(dateStr).toLocaleDateString(); } catch (e) { return dateStr; }
    };

    const formatMonthOnly = (monthStr) => {
        const parts = monthStr.split('-');
        if (parts.length === 2) {
            const monthNum = parseInt(parts[1], 10);
            const monthNamesEn = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            if (monthNum >= 1 && monthNum <= 12) {
                const enName = monthNamesEn[monthNum - 1];
                return t(`datePicker.months.${enName}`, { defaultValue: enName.charAt(0).toUpperCase() + enName.slice(1) });
            }
        }
        const date = new Date(monthStr + '-01');
        return date.toLocaleDateString('en-US', { month: 'long' });
    };

    const formatMonth = (monthStr) => {
        const parts = monthStr.split('-');
        if (parts.length === 2) {
            return `${formatMonthOnly(monthStr)} ${parts[0]}`;
        }
        const date = new Date(monthStr + '-01');
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    // Auto-dismiss success messages
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const filteredData = useMemo(() => {
        return {
            expenses: data.filter(d => (d.reportMonth || "").startsWith(year)),
            income: income.filter(d => (d.month || "").startsWith(year))
        };
    }, [data, income, year]);

    const availableMonths = useMemo(() => {
        const months = new Set([
            ...filteredData.expenses.map(d => d.reportMonth),
            ...filteredData.income.map(d => d.month)
        ].filter(Boolean));
        return Array.from(months).sort().reverse();
    }, [filteredData]);

    // Detect forecast-only months
    const forecastMonths = useMemo(() => {
        const forecast = new Set();
        availableMonths.forEach(month => {
            const monthExpenses = filteredData.expenses.filter(exp => exp.reportMonth === month);
            const monthIncome = filteredData.income.filter(inc => inc.month === month);

            // A month is forecast-only if it has expenses and ALL expenses are forecasted, and no income
            const hasExpenses = monthExpenses.length > 0;
            const allForecast = monthExpenses.every(exp => exp.isForecast);
            const hasIncome = monthIncome.length > 0;

            if (hasExpenses && allForecast && !hasIncome) {
                forecast.add(month);
            }
        });
        return forecast;
    }, [availableMonths, filteredData]);

    const displayExpenses = useMemo(() => selectedMonth === 'average' ? filteredData.expenses : filteredData.expenses.filter(d => d.reportMonth === selectedMonth), [filteredData.expenses, selectedMonth]);
    const displayIncome = useMemo(() => selectedMonth === 'average' ? filteredData.income : filteredData.income.filter(d => d.month === selectedMonth), [filteredData.income, selectedMonth]);

    // Converts each item to the default currency at ITS OWN date/month before
    // aggregating - a naive Number(item.amount) here was the exact bug
    // flagged in docs/fx/01-fx-plan.md §1 (mixed currencies summed as if
    // they were one). Items that can't be converted are skipped from the
    // stats (never silently summed) and counted in excludedCount below.
    const categoryStats = useMemo(() => {
        const agg = {};
        displayExpenses.forEach(item => {
            const converted = toDefault({ amount: Number(item.amount) || 0, currency: item.currency || 'ILS', date: item.date, month: item.reportMonth });
            if (converted.value == null) return; // unsupported currency - excluded, not summed as 0 either

            // Subtract if refund, add otherwise.
            // Note: We use Math.abs just in case, though amount should be positive + isRefund=true.
            // If we allow negative inputs as per recent change, we should handle that too.
            // Logic: if isRefund OR amount < 0, it reduces expense.
            const rawAmt = converted.value;
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayExpenses, selectedMonth, availableMonths, categories, toDefault, dataVersion]);

    const incomeStats = useMemo(() => {
        const agg = {};
        const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
        displayIncome.forEach(item => {
            const source = item.source_name || 'Other Income';
            // All four fields share one currency/month, so one rate lookup
            // (via a trivial "convert 1 unit" call) applies to every field,
            // instead of four separate lookups per item.
            const rateResult = toDefault({ amount: 1, currency: item.currency || 'ILS', month: item.month });
            if (rateResult.value == null) return; // unsupported currency - excluded
            const rate = rateResult.value;
            if (!agg[source]) agg[source] = { neto: 0, bruto: 0, taxes: 0, pension: 0, count: 0 };
            agg[source].neto += (Number(item.neto) || 0) * rate;
            agg[source].bruto += (Number(item.bruto) || 0) * rate;
            agg[source].taxes += (Number(item.taxes) || 0) * rate;
            agg[source].pension += (Number(item.pension) || 0) * rate;
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayIncome, selectedMonth, availableMonths, toDefault, dataVersion]);

    // A count-only pass (mirrors the skip conditions above) so the UI can
    // show "N items not included" without changing categoryStats/incomeStats'
    // shape - both are consumed as plain arrays by child components below.
    const excludedCount = useMemo(() => {
        let count = 0;
        displayExpenses.forEach(item => {
            const r = toDefault({ amount: Number(item.amount) || 0, currency: item.currency || 'ILS', date: item.date, month: item.reportMonth });
            if (r.value == null) count++;
        });
        displayIncome.forEach(item => {
            const r = toDefault({ amount: 1, currency: item.currency || 'ILS', month: item.month });
            if (r.value == null) count++;
        });
        return count;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayExpenses, displayIncome, toDefault, dataVersion]);

    const totalExpenses = categoryStats.reduce((acc, curr) => acc + curr.value, 0);
    const totalIncome = incomeStats.reduce((acc, curr) => acc + curr.value, 0);
    const totalSavings = totalIncome - totalExpenses;

    const categorySpending = useMemo(() => {
        if (totalIncome === 0) return [];
        return categoryStats
            .map(cat => ({
                category: cat.name,
                amount: cat.value,
                percentage: (cat.value / totalIncome) * 100
            }))
            .sort((a, b) => b.percentage - a.percentage);
    }, [categoryStats, totalIncome]);
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

    const jobOptions = useMemo(() => {
        const jobs = new Set(filteredData.income.map(i => i.source_name).filter(Boolean));
        return ['ALL_JOBS', ...Array.from(jobs)];
    }, [filteredData.income]);

    const activeTrendData = useMemo(() => {
        if (trendType === 'expense') {
            const relevantTx = filteredData.expenses.filter(d => (d.assignedCategory || 'Uncategorized') === selectedCategory && !d.isRefund);
            const monthlyAgg = {};
            relevantTx.forEach(tx => {
                const converted = toDefault({ amount: Number(tx.amount) || 0, currency: tx.currency || 'ILS', date: tx.date, month: tx.reportMonth });
                if (converted.value == null) return; // unsupported currency - excluded, not summed as 0
                const m = tx.reportMonth || 'Unknown';
                if (!monthlyAgg[m]) monthlyAgg[m] = { amount: 0, recurringAmount: 0 };
                if (tx.isRecurring) {
                    monthlyAgg[m].recurringAmount += converted.value;
                } else {
                    monthlyAgg[m].amount += converted.value;
                }
            });
            return Object.entries(monthlyAgg).map(([month, data]) => ({ month, amount: data.amount, recurringAmount: data.recurringAmount, totalAmount: data.amount + data.recurringAmount })).sort((a, b) => a.month.localeCompare(b.month));
        } else {
            const monthlyAgg = {};
            filteredData.income.forEach(inc => {
                if (selectedJobFilter !== 'ALL_JOBS' && inc.source_name !== selectedJobFilter) return;
                const converted = toDefault({ amount: Number(inc[selectedIncomeType]) || 0, currency: inc.currency || 'ILS', month: inc.month });
                if (converted.value == null) return; // unsupported currency - excluded
                const m = inc.month || 'Unknown';
                monthlyAgg[m] = (monthlyAgg[m] || 0) + converted.value;
            });
            return Object.entries(monthlyAgg).map(([month, amount]) => ({ month, amount, totalAmount: amount })).sort((a, b) => a.month.localeCompare(b.month));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredData, selectedCategory, selectedIncomeType, trendType, selectedJobFilter, toDefault, dataVersion]);

    const trendOverview = useMemo(() => {
        const total = activeTrendData.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const avg = availableMonths.length > 0 ? total / availableMonths.length : 0;
        const max = Math.max(...activeTrendData.map(d => d.totalAmount), 0);
        return { total, avg, max };
    }, [activeTrendData, availableMonths]);

    const handleIncomeDelete = async (id) => {
        if (confirm(t('analytics.deleteIncomeConfirm'))) {
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
            setSuccessMessage(t('analytics.deletedMonth', { mode, month: formatMonth(selectedMonth) }));
            if (mode === 'both') setSelectedMonth('average');
        } catch (error) {
            console.error(error);
            setErrorMessage(t('analytics.deleteMonthFailed'));
        }
    };

    const handleDelete = async (docId) => {
        if (confirm(t('analytics.deleteConfirm'))) {
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
            setSuccessMessage(t('analytics.addedNoteSuccess', { count: ids.length }));
            setSelectedIds([]);
        } catch (e) {
            console.error("Add note failed", e);
            setErrorMessage(t('analytics.addNoteFailed'));
        }
    };

    const handleMarkSuspect = async (ids) => {
        if (!ids.length) return;
        try {
            await Promise.all(ids.map(id => {
                const ref = doc(db, 'users', userId, 'expenses', id);
                return updateDoc(ref, { isSuspect: true });
            }));
            setSuccessMessage(t('analytics.markedSuspectSuccess', { count: ids.length }));
            setSelectedIds([]);
        } catch (e) {
            console.error("Mark suspect failed", e);
            setErrorMessage(t('analytics.markSuspectFailed'));
        }
    };

    const handleClearSuspect = async (ids) => {
        if (!ids.length) return;
        try {
            await Promise.all(ids.map(id => {
                const ref = doc(db, 'users', userId, 'expenses', id);
                return updateDoc(ref, { isSuspect: false });
            }));
            setSuccessMessage(t('analytics.clearedSuspectSuccess', { count: ids.length }));
            setSelectedIds([]);
        } catch (e) {
            console.error("Clear suspect failed", e);
            setErrorMessage(t('analytics.clearSuspectFailed'));
        }
    };

    const handleMoveMonth = async (ids, targetMonth) => {
        if (!ids.length || !targetMonth) return;
        // Server-side: also sets a date inside the target month so date and month never disagree.
        await runDateChange(() => expensesApi.moveMonth(ids, targetMonth), targetMonth);
    };

    const runDateChange = async (call, targetMonth) => {
        try {
            const res = await call();
            if (res.blockedShared?.length) setErrorMessage(t('analytics.changeDate.sharedBlocked', { count: res.blockedShared.length }));
            else if (res.updated?.length) setSuccessMessage(t('analytics.changeDate.success', { count: res.updated.length }));
            setSelectedIds([]);
        } catch (e) {
            console.error("Date change failed", e);
            setErrorMessage(e?.message || t('analytics.changeDate.failed'));
        }
    };

    const handleChangeDate = (ids, date) => runDateChange(() => expensesApi.changeDate(ids, date));
    const handleFixMismatch = (ids) => runDateChange(() => expensesApi.fixMonthMismatch(ids));

    const handleRemoveNote = async (ids) => {
        if (!ids.length) return;
        if (!confirm(t('analytics.removeNotesConfirm', { count: ids.length }))) return;
        try {
            await Promise.all(ids.map(id => {
                const ref = doc(db, 'users', userId, 'expenses', id);
                return updateDoc(ref, { note: null });
            }));
            setSuccessMessage(t('analytics.removedNotesSuccess', { count: ids.length }));
            setSelectedIds([]);
        } catch (e) {
            console.error("Remove note failed", e);
            setErrorMessage(t('analytics.removeNotesFailed'));
        }
    };

    const handleUpdateIncome = async (id, updates) => {
        try {
            const ref = doc(db, 'users', userId, 'income', id);
            await updateDoc(ref, updates);
            setSuccessMessage(t('analytics.updatedIncomeSuccess'));
        } catch (e) {
            console.error("Update income failed", e);
            setErrorMessage(t('analytics.updateIncomeFailed'));
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

    // Auto-convert forecasted expenses to regular when month becomes current/past
    useEffect(() => {
        const convertForecastedExpenses = async () => {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const forecastedExpenses = filteredData.expenses.filter(
                exp => exp.isForecast && exp.reportMonth <= currentMonth
            );

            if (forecastedExpenses.length > 0) {
                try {
                    const batch = writeBatch(db);
                    forecastedExpenses.forEach(exp => {
                        const ref = doc(db, 'users', userId, 'expenses', exp.id);
                        batch.update(ref, { isForecast: false });
                    });
                    await batch.commit();
                    console.log(`Converted ${forecastedExpenses.length} forecasted expenses to regular`);
                } catch (error) {
                    console.error('Failed to convert forecasted expenses:', error);
                }
            }
        };

        convertForecastedExpenses();
    }, [filteredData.expenses, userId]);

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in relative pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft className="w-6 h-6" /></button>
                    <h2 className="text-2xl font-bold text-slate-800">{t('analytics.dashboard', { year })}</h2>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setViewMode('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}><PieIcon className="w-4 h-4" /> {t('analytics.reports')}</button>
                    <button onClick={() => setViewMode('category')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'category' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}><BarChart3 className="w-4 h-4" /> {t('analytics.trends')}</button>
                </div>
            </div>

            {viewMode === 'month' && (
                <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 border-b border-slate-100">
                    <button onClick={() => setSelectedMonth('average')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === 'average' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{t('analytics.yearlyAvg')}</button>
                    {availableMonths.map(m => {
                        const currentMonth = new Date().toISOString().slice(0, 7);
                        const isForecast = forecastMonths.has(m);
                        const isFuture = m > currentMonth;
                        return (
                            <div key={m} className="relative">
                                <button
                                    onClick={() => setSelectedMonth(m)}
                                    onMouseEnter={() => setHoveredMonth(m)}
                                    onMouseLeave={() => setHoveredMonth(null)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${selectedMonth === m
                                        ? isForecast
                                            ? 'bg-purple-600 text-white shadow-md'
                                            : 'bg-emerald-600 text-white shadow-md'
                                        : isForecast
                                            ? 'bg-purple-50 text-purple-700 border-2 border-dashed border-purple-300 hover:bg-purple-100'
                                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    {isForecast && '🔮 '}{formatMonthOnly(m)}
                                </button>
                                {hoveredMonth === m && isForecast && (
                                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl p-3 shadow-2xl z-50 animate-fade-in w-64 text-left">
                                        <div className="font-bold text-purple-400 text-xs mb-1 flex items-center gap-1">
                                            🔮 {t('analytics.forecastMonth')}
                                        </div>
                                        <div className="text-[11px] text-slate-300">
                                            {t('analytics.forecastDescription')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Toast Notifications */}
            {successMessage && (
                <div className="fixed top-4 right-4 bg-green-100 border-2 border-green-300 text-green-800 px-6 py-3 rounded-xl shadow-lg animate-fade-in z-50 max-w-md">
                    {successMessage}
                </div>
            )}
            {errorMessage && (
                <div className="fixed top-4 right-4 bg-red-100 border-2 border-red-300 text-red-800 px-6 py-3 rounded-xl shadow-lg animate-fade-in z-50 max-w-md flex justify-between items-center gap-3">
                    <span>{errorMessage}</span>
                    <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {viewMode === 'month' ? (
                <AnalyticsReportsView
                    totalIncome={totalIncome}
                    totalExpenses={totalExpenses}
                    totalSavings={totalSavings}
                    savingsRate={savingsRate}
                    dominantCurrency={defaultCurrency}
                    excludedCount={excludedCount}
                    categoryStats={categoryStats}
                    incomeStats={incomeStats}
                    displayIncome={displayIncome}
                    displayExpenses={displayExpenses}
                    userId={userId}
                    selectedMonth={selectedMonth}
                    selectedIds={selectedIds}
                    isForecastMonth={forecastMonths.has(selectedMonth)}
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
                    onMarkSuspect={handleMarkSuspect}
                    onClearSuspect={handleClearSuspect}
                    onMoveMonth={handleMoveMonth}
                    onChangeDate={handleChangeDate}
                    onFixMismatch={handleFixMismatch}
                    formatMonth={formatMonth}
                    onRemoveNote={handleRemoveNote}
                    onUpdateIncome={handleUpdateIncome}
                    setSelectedIds={setSelectedIds}
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
                    dominantCurrency={defaultCurrency}
                    activeTrendData={activeTrendData}
                    totalIncome={totalIncome}
                    categorySpending={categorySpending}
                />
            )}
        </div>
    );
};
