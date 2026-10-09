import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from 'recharts';
import {
    Trash2, DollarSign, Wallet, CheckSquare, Square,
    Check, X, Briefcase,
    Flag, Calendar, Type, Repeat, HelpCircle, Users, Globe2, Loader2, AlertTriangle
} from 'lucide-react';
import { Card } from '../../../components/UI';
import { NoteModal } from '../../../components/NoteModal';
import { IncomeEditModal } from '../../../components/IncomeEditModal';
import { DEFAULT_CATEGORIES } from '../../../config/constants';
import { useFx } from '../../../lib/fx/useFx';
import { Money } from '../../../components/Money';
import { commitInChunks, buildAmountConversion, buildIncomeConversion } from '../../../lib/fx/convertRecordsInPlace';
import { useMyGroups } from '../../groups/hooks/useMyGroups';
import { MoveToGroupFlow } from '../../groups/components/MoveToGroupFlow';
import { BulkMoveToGroupFlow } from '../../groups/components/BulkMoveToGroupFlow';
import { GroupedExpenseActionsModal } from '../../groups/components/GroupedExpenseActionsModal';
import { ChangeDateModal } from './ChangeDateModal';
import { getMonthMismatch } from '../utils/expenseDates';

export const AnalyticsReportsView = ({
    totalIncome, totalExpenses, totalSavings, savingsRate, dominantCurrency, excludedCount = 0,
    categoryStats, incomeStats, displayIncome, displayExpenses,
    selectedMonth, selectedIds, isForecastMonth, userId,
    handleIncomeDelete, executeDeleteMonth, isDeleteModalOpen, setIsDeleteModalOpen,
    handleDelete, toggleSelect, toggleSelectAll,
    executeBulkCategory, bulkCategory, setBulkCategory, categories,
    editingId, startEditAmount, saveAmount, editAmountVal, setEditAmountVal,
    handleCategoryChange, formatDate, onAddNote, onMarkSuspect, onClearSuspect,
    onMoveMonth, onRemoveNote, onUpdateIncome, setSelectedIds,
    onChangeDate, onFixMismatch, formatMonth
}) => {
    const { t } = useTranslation();
    // totalIncome/totalExpenses/totalSavings/categoryStats/incomeStats are
    // already converted to `dominantCurrency` by YearDashboard - only the
    // separate recurringTotal/oneTimeTotal split below needs its own
    // conversion, since it re-derives from the raw displayExpenses.
    const { toDefault, convertRecord, defaultCurrency, dataVersion } = useFx();
    const [hoveredIncome, setHoveredIncome] = useState(null);
    const [movingExpense, setMovingExpense] = useState(null);
    const [bulkMoving, setBulkMoving] = useState(false);
    const [changeDateFor, setChangeDateFor] = useState(null); // array of expenses
    const [groupActionsFor, setGroupActionsFor] = useState(null);
    const { groups: myGroups } = useMyGroups(userId);

    // docs/fx/01-fx-plan.md §11: a per-record "Convert" action everywhere an
    // amount is shown (via <Money>'s onConvert), plus one safe, CONFIRMED,
    // chunked bulk action scoped to just the month in view - never "every
    // record in this currency ever", which is what silently failed before.
    const [confirmingBulkConvert, setConfirmingBulkConvert] = useState(false);
    const [bulkConverting, setBulkConverting] = useState(false);
    const [bulkConvertResult, setBulkConvertResult] = useState(null);

    const foreignExpensesThisMonth = useMemo(
        () => displayExpenses.filter((tx) => (tx.currency || 'ILS') !== defaultCurrency && !tx.fx),
        [displayExpenses, defaultCurrency]
    );
    const foreignIncomeThisMonth = useMemo(
        () => displayIncome.filter((inc) => (inc.currency || 'ILS') !== defaultCurrency && !inc.fx),
        [displayIncome, defaultCurrency]
    );
    const foreignCountThisMonth = foreignExpensesThisMonth.length + foreignIncomeThisMonth.length;

    const convertExpenseInPlace = async (tx) => {
        const fields = buildAmountConversion({
            amount: Number(tx.amount), currency: tx.currency || 'ILS', date: tx.date, month: tx.reportMonth, convertRecord,
        });
        if (!fields) throw new Error('No exchange rate available for this record.');
        await commitInChunks([{ path: ['users', userId, 'expenses', tx.id], fields }]);
    };

    const convertIncomeInPlace = async (inc) => {
        const fields = buildIncomeConversion({ ...inc, currency: inc.currency || 'ILS', toDefault, defaultCurrency });
        if (!fields) throw new Error('No exchange rate available for this record.');
        await commitInChunks([{ path: ['users', userId, 'income', inc.id], fields }]);
    };

    const handleBulkConvertMonth = async () => {
        setBulkConverting(true);
        setBulkConvertResult(null);
        try {
            const jobs = [];
            let skipped = 0;
            for (const tx of foreignExpensesThisMonth) {
                const fields = buildAmountConversion({
                    amount: Number(tx.amount), currency: tx.currency || 'ILS', date: tx.date, month: tx.reportMonth, convertRecord,
                });
                if (fields) jobs.push({ path: ['users', userId, 'expenses', tx.id], fields }); else skipped += 1;
            }
            for (const inc of foreignIncomeThisMonth) {
                const fields = buildIncomeConversion({ ...inc, currency: inc.currency || 'ILS', toDefault, defaultCurrency });
                if (fields) jobs.push({ path: ['users', userId, 'income', inc.id], fields }); else skipped += 1;
            }
            const written = await commitInChunks(jobs);
            setBulkConvertResult({ written, skipped });
        } finally {
            setBulkConverting(false);
            setConfirmingBulkConvert(false);
        }
    };

    const getCategoryName = (name) => {
        const defaultCat = DEFAULT_CATEGORIES.find(c => c.name === name);
        if (defaultCat) return t(`categories.${defaultCat.id}`);
        return name;
    };

    // Sort expenses: Suspect first, then Recurring, then date desc
    const sortedExpenses = [...displayExpenses].sort((a, b) => {
        // Suspect first
        if (a.isSuspect && !b.isSuspect) return -1;
        if (!a.isSuspect && b.isSuspect) return 1;

        // Then recurring
        if (a.isRecurring && !b.isRecurring) return -1;
        if (!a.isRecurring && b.isRecurring) return 1;

        // Then by date
        return new Date(b.date) - new Date(a.date);
    });

    // Calculate recurring vs one-time stats. This re-derives from the raw
    // displayExpenses (not categoryStats), so it needs its own conversion -
    // otherwise oneTimeTotal (= the already-converted totalExpenses minus an
    // unconverted recurringTotal) would mix currencies again.
    const recurringTotal = useMemo(() => {
        let total = 0;
        displayExpenses
            .filter(exp => exp.isRecurring && !exp.isRefund)
            .forEach(exp => {
                const converted = toDefault({ amount: Math.abs(Number(exp.amount) || 0), currency: exp.currency || 'ILS', date: exp.date, month: exp.reportMonth });
                if (converted.value != null) total += converted.value;
            });
        return total;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayExpenses, toDefault, dataVersion]);
    const oneTimeTotal = totalExpenses - recurringTotal;

    // Check if any selected items are suspect or non-suspect
    const hasNonSuspectSelected = selectedIds.some(id => {
        const item = sortedExpenses.find(exp => exp.id === id);
        return item && !item.isSuspect;
    });
    const hasSuspectSelected = selectedIds.some(id => {
        const item = sortedExpenses.find(exp => exp.id === id);
        return item && item.isSuspect;
    });
    const hasNotesSelected = selectedIds.some(id => {
        const item = sortedExpenses.find(exp => exp.id === id);
        return item && item.note;
    });
    const unsharedSelectedExpenses = selectedIds
        .map(id => sortedExpenses.find(exp => exp.id === id))
        .filter(exp => exp && !exp.groupRef);

    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [incomeEditModalOpen, setIncomeEditModalOpen] = useState(false);
    const [selectedIncome, setSelectedIncome] = useState(null);

    const handleApplyBulkActions = () => {
        // Apply category change if selected
        if (bulkCategory) {
            executeBulkCategory();
        }

        // Clear selections
        setBulkCategory('');
    };

    return (
        <>

            {selectedMonth !== 'average' && isForecastMonth && (
                <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
                    <div className="text-3xl">🔮</div>
                    <div className="flex-1">
                        <div className="font-bold text-purple-900 text-sm mb-1">{t('analytics.forecastMonth')}</div>
                        <div className="text-xs text-purple-700 leading-relaxed">
                            {t('analytics.forecastDescription')}
                        </div>
                    </div>
                </div>
            )}

            {/* ... Top Cards ... */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">{t('analytics.netIncome')}</div><div className="text-2xl font-bold text-emerald-600"><Money amount={totalIncome} currency={dominantCurrency} /></div></Card>
                <Card className="p-4 flex flex-col justify-between"><div className="text-slate-400 text-xs font-bold uppercase">{t('analytics.totalExpenses')}</div><div className="text-2xl font-bold text-slate-800"><Money amount={totalExpenses} currency={dominantCurrency} /></div></Card>
                <Card className={`p-4 flex flex-col justify-between border-l-4 ${totalSavings >= 0 ? 'border-emerald-500' : 'border-red-500'}`}><div className="flex justify-between text-xs font-bold uppercase text-slate-400">{t('analytics.spareMoney')} <span className="text-emerald-600">{savingsRate.toFixed(1)}%</span></div><div className="text-2xl font-bold text-slate-800"><Money amount={totalSavings} currency={dominantCurrency} /></div></Card>
            </div>

            {excludedCount > 0 && (
                <div className="mb-4 text-xs text-amber-600 font-bold">
                    {t('analytics.excludedFromTotals', { count: excludedCount })}
                </div>
            )}

            {/* docs/fx/01-fx-plan.md §11.1: a safe bulk action, scoped to just this
                month (never "every foreign record ever") - confirm first, then a
                single chunked write, with a plain result message, not a silent
                try-and-hope. Only shown for a specific month, not the yearly average. */}
            {selectedMonth !== 'average' && foreignCountThisMonth > 0 && (
                <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-sm font-bold text-indigo-700 flex items-center gap-2">
                            <Globe2 className="w-4 h-4" />
                            {t('analytics.foreignRecordsThisMonth', { count: foreignCountThisMonth })}
                        </span>
                        {!confirmingBulkConvert ? (
                            <button
                                onClick={() => setConfirmingBulkConvert(true)}
                                className="text-xs font-bold bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                {t('analytics.convertMonthTo', { currency: defaultCurrency })}
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-indigo-600">{t('analytics.convertMonthConfirm', { count: foreignCountThisMonth, currency: defaultCurrency })}</span>
                                <button
                                    onClick={handleBulkConvertMonth}
                                    disabled={bulkConverting}
                                    className="text-xs font-bold bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {bulkConverting && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {t('common.confirm')}
                                </button>
                                <button
                                    onClick={() => setConfirmingBulkConvert(false)}
                                    disabled={bulkConverting}
                                    className="text-xs font-bold text-indigo-500 px-2 py-2 hover:text-indigo-700"
                                >
                                    {t('common.cancel')}
                                </button>
                            </div>
                        )}
                    </div>
                    {bulkConvertResult && (
                        <p className="text-xs text-emerald-600 font-bold mt-2">
                            {bulkConvertResult.skipped > 0
                                ? t('analytics.convertMonthDoneWithSkipped', { written: bulkConvertResult.written, skipped: bulkConvertResult.skipped })
                                : t('analytics.convertMonthDone', { written: bulkConvertResult.written })}
                        </p>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* ... Pie Charts ... */}
                <Card className="p-6">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-red-400" /> {t('analytics.expensesBreakdown')}</h3>
                    <div className="flex flex-col md:flex-row items-center h-64">
                        <div className="h-full w-full md:w-1/2">
                            <ResponsiveContainer minWidth={0}><PieChart><Pie data={categoryStats} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2}>{categoryStats.map((e, i) => (<Cell key={i} fill={e.color} />))}</Pie><Tooltip formatter={(v) => `${dominantCurrency} ${v.toFixed(0)}`} /></PieChart></ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/2 overflow-y-auto h-full pr-2 space-y-2 custom-scrollbar">
                            {totalIncome > 0 && (
                                <div className="mb-3 px-2 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                                    <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-blue-700 leading-relaxed">
                                        {t('analytics.percentagesNote')}
                                    </p>
                                </div>
                            )}
                            {categoryStats.map(s => (
                                <div key={s.name} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{getCategoryName(s.name)}</div>
                                    <div className="font-bold">
                                        {s.value.toFixed(0)}
                                        {totalIncome > 0 && (
                                            <span className="text-slate-400 ml-1.5 text-[10px]">
                                                ({((s.value / totalIncome) * 100).toFixed(1)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> {t('analytics.incomeSources')}</h3>
                    <div className="flex flex-col md:flex-row items-center h-64">
                        {/* ... Income Pie ... */}
                        <div className="h-full w-full md:w-1/2">
                            <ResponsiveContainer minWidth={0}><PieChart><Pie data={incomeStats} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2}>{incomeStats.map((e, i) => (<Cell key={i} fill={e.color} />))}</Pie><Tooltip formatter={(v) => `${dominantCurrency} ${v.toFixed(0)}`} /></PieChart></ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/2 overflow-y-auto h-full pr-2 space-y-3 custom-scrollbar">
                            {/* ... Income Legend ... */}
                            {incomeStats.map((s, idx) => (
                                <div key={s.name} className="relative flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-help group" onMouseEnter={() => setHoveredIncome(s.name)} onMouseLeave={() => setHoveredIncome(null)}>
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{t(s.name, { defaultValue: s.name })}</div>
                                    <div className="font-bold text-emerald-600">{s.value.toFixed(0)}</div>
                                    {hoveredIncome === s.name && (
                                        <div className={`absolute right-0 w-48 bg-slate-900 text-white rounded-xl p-3 shadow-2xl z-50 animate-fade-in ${idx < 2 ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                            <div className="font-bold border-b border-slate-700 pb-1 mb-2 text-emerald-400 text-[11px] truncate">{s.name}</div>
                                            {/* ... tooltip content ... */}
                                            <div className="space-y-1 text-[10px]">
                                                <div className="flex justify-between">{t('analytics.gross')} <span>{dominantCurrency}{s.bruto.toFixed(0)}</span></div>
                                                <div className="flex justify-between text-red-400">{t('analytics.tax')} <span>-{dominantCurrency}{s.taxes.toFixed(0)}</span></div>
                                                <div className="flex justify-between text-purple-400">{t('analytics.pension')} <span>{dominantCurrency}{s.pension.toFixed(0)}</span></div>
                                                <div className="border-t border-slate-700 mt-1 pt-1 flex justify-between font-bold text-emerald-400">{t('analytics.net')} <span>{dominantCurrency}{s.value.toFixed(0)}</span></div>
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
                {/* Recurring vs One-Time Breakdown - Shown for both yearly and specific month */}
                {recurringTotal > 0 && (
                    <div className="mb-4 flex gap-3">
                        <div className="flex-1 bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Repeat className="w-4 h-4 text-purple-600" />
                                <span className="text-xs font-bold text-purple-900">{t('analytics.recurring')}</span>
                            </div>
                            <span className="text-sm font-bold text-purple-600">
                                <Money amount={recurringTotal} currency={dominantCurrency} />
                            </span>
                        </div>
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-slate-600" />
                                <span className="text-xs font-bold text-slate-700">{t('analytics.oneTime')}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-600">
                                <Money amount={oneTimeTotal} currency={dominantCurrency} />
                            </span>
                        </div>
                    </div>
                )}

                {/* Income Table - Hidden in Yearly Avg */}
                {selectedMonth !== 'average' && (
                    <div>
                        <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200"><Briefcase className="w-4 h-4" /> {t('analytics.incomeDetails')} ({selectedMonth})</h3>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                    <tr><th className="p-4">{t('analytics.source')}</th><th className="p-4">{t('analytics.gross')}</th><th className="p-4">{t('analytics.tax')} (Total)</th><th className="p-4">{t('analytics.net')} (Bank)</th><th className="p-4 text-right">{t('analytics.actions')}</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {displayIncome.map(inc => (
                                        <tr key={inc.id} onClick={() => { setSelectedIncome(inc); setIncomeEditModalOpen(true); }} className="hover:bg-emerald-50 cursor-pointer transition-colors">
                                            <td className="p-4 font-bold text-slate-800">{t(inc.source_name, { defaultValue: inc.source_name })}</td>
                                            <td className="p-4 font-mono"><Money amount={Number(inc.bruto)} currency={inc.currency || 'ILS'} month={inc.month} original={inc.original} fx={inc.fx} onConvert={() => convertIncomeInPlace(inc)} /></td>
                                            <td className="p-4 font-mono text-red-400">-<Money amount={Number(inc.taxes)} currency={inc.currency || 'ILS'} month={inc.month} noAlert /></td>
                                            <td className="p-4 font-mono font-bold text-emerald-600"><Money amount={Number(inc.neto)} currency={inc.currency || 'ILS'} month={inc.month} noAlert /></td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleIncomeDelete(inc.id); }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}


                {selectedMonth !== 'average' && (
                    <div>
                        <div className="flex justify-between items-center mb-4 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
                            <h3 className="font-bold text-red-800 flex items-center gap-2"><DollarSign className="w-4 h-4" /> {t('analytics.expenseHistory')}</h3>
                            <div className="relative">
                                <button onClick={() => setIsDeleteModalOpen(true)} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors bg-white"><Trash2 className="w-4 h-4" /> {t('analytics.clearMonth')}</button>
                                {isDeleteModalOpen && (
                                    <div className="absolute bottom-full ltr:right-0 rtl:left-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-10 animate-fade-in">
                                        <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-slate-800 text-sm">{t('analytics.clearMonthTitle', { month: selectedMonth })}</h4><button onClick={() => setIsDeleteModalOpen(false)}><X className="w-4 h-4" /></button></div>
                                        <div className="space-y-2">
                                            <button onClick={() => executeDeleteMonth('expenses')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-medium">{t('analytics.expensesOnly')}</button>
                                            <button onClick={() => executeDeleteMonth('income')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-600 text-sm font-medium">{t('analytics.incomeOnly')}</button>
                                            <div className="h-px bg-slate-100 my-1"></div>
                                            <button onClick={() => executeDeleteMonth('both')} className="w-full text-left px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">{t('analytics.everything')}</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recurring vs One-Time Breakdown - Moved here */}
                        {recurringTotal > 0 && (
                            <div className="mb-4 flex gap-3">
                                <div className="flex-1 bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Repeat className="w-4 h-4 text-purple-600" />
                                        <span className="text-xs font-bold text-purple-900">{t('analytics.recurring')}</span>
                                    </div>
                                    <span className="text-sm font-bold text-purple-600">
                                        <Money amount={recurringTotal} currency={dominantCurrency} />
                                    </span>
                                </div>
                                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-slate-600" />
                                        <span className="text-xs font-bold text-slate-700">{t('analytics.oneTime')}</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-600">
                                        <Money amount={oneTimeTotal} currency={dominantCurrency} />
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                    <tr>
                                        <th className="p-4 w-10 text-center cursor-pointer" onClick={toggleSelectAll}>
                                            {selectedIds.length > 0 && selectedIds.length === sortedExpenses.length ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5 text-slate-300" />}
                                        </th>
                                        <th className="p-4">{t('analytics.date')}</th>
                                        <th className="p-4">{t('analytics.description')}</th>
                                        <th className="p-4">{t('analytics.amount')}</th>
                                        <th className="p-4">{t('analytics.category')}</th>
                                        <th className="p-4 text-right">{t('analytics.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedExpenses.map(tx => {
                                        // Check if transaction is a refund (either flag or negative amount)
                                        const isRefundItem = tx.isRefund || tx.amount < 0;
                                        const isSuspectItem = tx.isSuspect;
                                        const isRecurringItem = tx.isRecurring;
                                        const isGroupSharedItem = !!tx.groupRef;
                                        const displayAmount = Math.abs(tx.amount); // Show positive magnitude

                                        return (
                                            <tr key={tx.id} className={`hover:bg-slate-50 group border-b border-slate-100 ${selectedIds.includes(tx.id) ? 'bg-blue-50/50' : ''
                                                } ${isSuspectItem ? 'bg-red-50 border-red-100 hover:bg-red-100/50' :
                                                    isRecurringItem ? 'bg-purple-50/30 border-l-4 border-l-purple-400' :
                                                        isGroupSharedItem ? 'bg-orange-50/40 border-l-4 border-l-orange-400' : ''
                                                }`}>
                                                <td className="p-4 text-center cursor-pointer" onClick={() => toggleSelect(tx.id)}>
                                                    {selectedIds.includes(tx.id) ? <CheckSquare className="w-5 h-5 text-blue-500" /> : <Square className="w-5 h-5 text-slate-200" />}
                                                </td>
                                                <td className="p-4 text-slate-500 whitespace-nowrap">
                                                    {formatDate(tx.date)}
                                                    {(() => {
                                                        const mismatch = getMonthMismatch(tx);
                                                        if (!mismatch || isGroupSharedItem) return null;
                                                        return (
                                                            <div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onFixMismatch && onFixMismatch([tx.id])}
                                                                    title={t('analytics.dateMismatch.tooltip', { dateMonth: formatMonth(mismatch.dateMonth), shownMonth: formatMonth(mismatch.reportMonth) })}
                                                                    className="mt-1 text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-200 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <AlertTriangle className="w-3 h-3" /> {t('analytics.dateMismatch.fix', { month: formatMonth(mismatch.dateMonth) })}
                                                                </button>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="p-4 font-bold text-slate-800">
                                                    {tx.description}
                                                    {tx.note && <div className="text-[10px] text-purple-600 bg-purple-50 px-1 py-0.5 rounded inline-block ml-2 border border-purple-100"><Type className="w-2 h-2 inline mr-1" />{tx.note}</div>}
                                                </td>
                                                <td className="p-4">
                                                    {editingId === tx.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" className="w-24 p-1 border rounded" value={editAmountVal} onChange={e => setEditAmountVal(e.target.value)} autoFocus />
                                                            <button onClick={() => saveAmount(tx.id)} className="text-emerald-500"><Check className="w-4 h-4" /></button>
                                                        </div>
                                                    ) : (
                                                        <div onClick={() => startEditAmount(tx)} className={`font-mono font-bold cursor-pointer hover:bg-slate-100 px-2 py-1 rounded inline-flex items-center gap-2 group-hover:text-blue-600 transition-colors ${isRefundItem ? 'text-emerald-500' : isGroupSharedItem ? 'text-orange-600' : 'text-slate-700'}`}>
                                                            {isRefundItem ? '+' : ''}
                                                            <Money
                                                                amount={displayAmount} currency={tx.currency || 'ILS'} date={tx.date} month={tx.reportMonth}
                                                                original={tx.original} fx={tx.fx}
                                                                onConvert={(tx.currency || 'ILS') !== defaultCurrency && !tx.fx ? () => convertExpenseInPlace(tx) : undefined}
                                                            />
                                                        </div>
                                                    )}
                                                    {isGroupSharedItem && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setGroupActionsFor(tx)}
                                                            title={t('analytics.sharedInGroupTooltip')}
                                                            className="mt-1 text-[10px] bg-orange-100 text-orange-700 hover:bg-orange-200 px-1.5 py-0.5 rounded font-bold uppercase inline-flex items-center gap-1 cursor-pointer transition-colors"
                                                        >
                                                            <Users className="w-3 h-3" /> {t('analytics.sharedInGroup', { name: tx.groupRef.groupName })}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <select className="bg-transparent border-none text-slate-600 font-medium cursor-pointer hover:text-emerald-600" value={tx.assignedCategory || ''} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}>
                                                        <option value="" disabled>{t('analytics.select')}...</option>
                                                        {categories.map(c => <option key={c.id} value={c.name}>{getCategoryName(c.name)}</option>)}
                                                    </select>
                                                    {isRefundItem && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">{t('analytics.refund')}</span>}
                                                    {isSuspectItem && <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase flex inline-flex items-center gap-1"><Flag className="w-3 h-3" /> {t('analytics.suspect')}</span>}
                                                    {isRecurringItem && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase flex inline-flex items-center gap-1"><Repeat className="w-3 h-3" /> {t('analytics.recurringTag')}</span>}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setChangeDateFor([tx])}
                                                            title={isGroupSharedItem ? t('analytics.changeDate.sharedBlockedShort') : t('analytics.changeDate.action')}
                                                            className="text-slate-300 hover:text-blue-500 transition-colors"
                                                        >
                                                            <Calendar className="w-4 h-4" />
                                                        </button>
                                                        {myGroups.length > 0 && !isGroupSharedItem && (
                                                            <button
                                                                onClick={() => setMovingExpense(tx)}
                                                                title={t('analytics.moveToGroup')}
                                                                className="text-slate-300 hover:text-indigo-500 transition-colors"
                                                            >
                                                                <Users className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleDelete(tx.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </td>
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
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-fade-in max-w-5xl">
                    <span className="font-bold text-sm">{t('analytics.selected', { count: selectedIds.length })}</span>
                    <div className="h-4 w-px bg-slate-700"></div>

                    {/* Change exact date */}
                    <button
                        onClick={() => setChangeDateFor(displayExpenses.filter(e => selectedIds.includes(e.id)))}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors bg-slate-800 text-blue-300 hover:bg-slate-700"
                    >
                        <Calendar className="w-3 h-3" />
                        {t('analytics.changeDate.action')}
                    </button>

                    {/* Mark/Clear Suspect */}
                    {hasNonSuspectSelected && (
                        <button
                            onClick={() => onMarkSuspect(selectedIds)}
                            className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 text-red-400 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <Flag className="w-3 h-3" /> {t('analytics.markSuspect')}
                        </button>
                    )}
                    {hasSuspectSelected && (
                        <button
                            onClick={() => onClearSuspect(selectedIds)}
                            className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <X className="w-3 h-3" /> {t('analytics.clearSuspect')}
                        </button>
                    )}

                    {/* Add Note */}
                    <button
                        onClick={() => setNoteModalOpen(true)}
                        className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 text-purple-400 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <Type className="w-3 h-3" /> {t('analytics.addNote')}
                    </button>

                    {/* Remove Note - only show if selected expenses have notes */}
                    {hasNotesSelected && onRemoveNote && (
                        <button
                            onClick={() => onRemoveNote(selectedIds)}
                            className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <X className="w-3 h-3" /> {t('analytics.removeNote')}
                        </button>
                    )}

                    {/* Bulk move to group */}
                    {myGroups.length > 0 && unsharedSelectedExpenses.length > 0 && (
                        <button
                            onClick={() => setBulkMoving(true)}
                            className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 text-indigo-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <Users className="w-3 h-3" /> {t('analytics.moveToGroup')}
                        </button>
                    )}

                    <div className="h-4 w-px bg-slate-700"></div>

                    {/* Category */}
                    <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} className="bg-slate-800 border-none text-sm text-white rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-slate-700 transition-colors">
                        <option value="">{t('analytics.category')}...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{getCategoryName(c.name)}</option>)}
                    </select>
                    <button onClick={handleApplyBulkActions} disabled={!bulkCategory} className="bg-emerald-500 hover:bg-emerald-400 text-white p-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setSelectedIds && setSelectedIds([])} className="ml-2 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
            )}

            {changeDateFor && (
                <ChangeDateModal
                    expenses={changeDateFor}
                    formatMonth={formatMonth}
                    onClose={() => setChangeDateFor(null)}
                    onKeepDay={async (month) => {
                        await onMoveMonth(changeDateFor.map(e => e.id), month);
                        setChangeDateFor(null);
                    }}
                    onConfirm={async (date) => {
                        await onChangeDate(changeDateFor.map(e => e.id), date);
                        setChangeDateFor(null);
                    }}
                />
            )}

            {/* NoteModal */}
            <NoteModal
                isOpen={noteModalOpen}
                onClose={() => setNoteModalOpen(false)}
                onSave={(note) => {
                    if (note && selectedIds.length) {
                        onAddNote(selectedIds, note);
                    }
                }}
            />

            {/* IncomeEditModal */}
            {selectedIncome && (
                <IncomeEditModal
                    isOpen={incomeEditModalOpen}
                    onClose={() => { setIncomeEditModalOpen(false); setSelectedIncome(null); }}
                    income={selectedIncome}
                    onSave={(id, updates) => {
                        onUpdateIncome(id, updates);
                        setIncomeEditModalOpen(false);
                        setSelectedIncome(null);
                    }}
                />
            )}

            {movingExpense && (
                <MoveToGroupFlow
                    expense={movingExpense}
                    userId={userId}
                    onClose={() => setMovingExpense(null)}
                    onMoved={() => setMovingExpense(null)}
                />
            )}

            {bulkMoving && (
                <BulkMoveToGroupFlow
                    expenses={unsharedSelectedExpenses}
                    userId={userId}
                    onClose={() => setBulkMoving(false)}
                    onMoved={() => { setBulkMoving(false); setSelectedIds && setSelectedIds([]); }}
                />
            )}

            {groupActionsFor && (
                <GroupedExpenseActionsModal
                    expense={groupActionsFor}
                    onClose={() => setGroupActionsFor(null)}
                    onRemoved={() => setGroupActionsFor(null)}
                    onMoveToAnother={(restoredExpense) => {
                        setGroupActionsFor(null);
                        setMovingExpense(restoredExpense);
                    }}
                />
            )}
        </>
    );
};
