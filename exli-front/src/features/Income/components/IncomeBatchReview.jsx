import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CheckCircle2, AlertCircle, ArrowRight, Wallet, Edit2, Check, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/UI.jsx';
import { MonthYearPickerModal } from '../../../components/MonthYearPickerModal.jsx';
import { WorkplacePickerModal } from '../../settings/components/WorkplacePickerModal.jsx';

export const IncomeBatchReview = ({
    batchResults,
    onRowClick,
    onComplete,
    workplaces = [],
    onUpdateRow,
    onAddWorkplace,
    onDeleteRow
}) => {
    const { t } = useTranslation();

    // Calculate overall stats
    const totalGross = batchResults.reduce((sum, res) => sum + (res.data?.bruto || 0), 0);
    const completedCount = batchResults.filter(res => res.status === 'saved').length;
    const pendingCount = batchResults.length - completedCount;
    const allCompleted = completedCount === batchResults.length;

    // Inline edit state
    const [editingMonthIdx, setEditingMonthIdx] = useState(null);
    const [editingEmployerIdx, setEditingEmployerIdx] = useState(null);
    const [showWorkplacePicker, setShowWorkplacePicker] = useState(false);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Summary Cards */}
            <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-800 mb-6 flex items-center gap-2">
                    <Wallet className="w-8 h-8 text-emerald-600" />
                    {t('income.batchReview.title', 'Review Payslips')}
                </h2>

                <div className="flex flex-wrap gap-4 mb-4">
                    <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-100 flex-1 min-w-[120px]">
                        <div className="text-xs font-bold text-slate-400 mb-1">
                            {t('income.batchReview.summaryTotal', 'Total Gross (ILS)')}
                        </div>
                        <div className="text-xl font-black text-slate-700">
                            {totalGross.toLocaleString()}
                        </div>
                    </div>

                    <div className={`px-4 py-3 rounded-xl border flex-1 min-w-[120px] ${pendingCount === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`text-xs font-bold mb-1 ${pendingCount === 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {t('income.batchReview.summaryCompleted', 'Completed')}
                        </div>
                        <div className={`text-xl font-black flex items-center gap-2 ${pendingCount === 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {completedCount} / {batchResults.length}
                            {pendingCount === 0 && <CheckCircle2 className="w-5 h-5" />}
                        </div>
                    </div>

                    {pendingCount > 0 && (
                        <div className="bg-amber-50 px-4 py-3 rounded-xl border border-amber-200 flex-1 min-w-[120px]">
                            <div className="text-xs font-bold text-amber-600 mb-1">
                                {t('income.batchReview.summaryPending', 'Pending Review')}
                            </div>
                            <div className="text-xl font-black text-amber-700 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                {pendingCount}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('income.batchReview.month', 'Month')}</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('income.batchReview.employer', 'Employer')}</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('income.batchReview.gross', 'Gross')}</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('income.batchReview.net', 'Net')}</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{t('income.batchReview.status', 'Status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {batchResults.map((res, idx) => {
                                const isSaved = res.status === 'saved';
                                const isError = res.status === 'error';

                                return (
                                    <tr
                                        key={idx}
                                        className={`transition-colors ${isError ? 'bg-red-50/50' :
                                                isSaved ? 'bg-emerald-50/10' :
                                                    'hover:bg-slate-50'
                                            }`}
                                    >
                                        <td className="p-4 group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSaved ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div className="font-bold text-slate-700 flex items-center gap-2">
                                                    {res.data?.pay_month ? res.data.pay_month : (
                                                        <span className="text-amber-600 font-medium flex items-center gap-1">
                                                            {t('income.batchReview.unknownMonth', 'Unknown Month')}
                                                        </span>
                                                    )}
                                                    {!isSaved && !isError && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingMonthIdx(idx); }}
                                                            className={`p-1 rounded transition-colors ${!res.data?.pay_month ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 opacity-0 group-hover:opacity-100'}`}
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 group">
                                            <div className="font-medium text-slate-600 flex items-center gap-2">
                                                {res.data?.employer_name ? res.data.employer_name : (
                                                    <span className="text-amber-600 font-medium">
                                                        {t('income.batchReview.unknownEmployer', 'Unknown')}
                                                    </span>
                                                )}
                                                {!isSaved && !isError && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingEmployerIdx(idx);
                                                        }}
                                                        className={`p-1 rounded transition-colors ${!res.data?.employer_name ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 opacity-0 group-hover:opacity-100'}`}
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[150px]" title={res.filename}>
                                                {res.filename}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="font-bold text-slate-700">
                                                {res.data?.bruto ? res.data.bruto.toLocaleString() : '-'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="font-bold text-emerald-600">
                                                {res.data?.neto ? res.data.neto.toLocaleString() : '-'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center items-center gap-2">
                                                {isError ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        {t('income.batchReview.error', 'Error')}
                                                    </span>
                                                ) : isSaved ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            {t('income.batchReview.saved', 'Saved')}
                                                        </span>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onRowClick(idx); }}
                                                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                            title={t('common.edit', 'Edit')}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => onRowClick(idx)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                                    >
                                                        {t('income.batchReview.review', 'Review')}
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onDeleteRow && onDeleteRow(idx); }}
                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title={t('common.delete', 'Delete')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-end pt-4">
                <Button
                    onClick={onComplete}
                    disabled={!allCompleted}
                    className={allCompleted ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                    {allCompleted
                        ? <><CheckCircle2 className="w-4 h-4 mr-2" /> {t('income.batchReview.finish', 'Finish Import')}</>
                        : t('income.batchReview.completeAllToFinish', 'Review all to finish')}
                </Button>
            </div>
            {/* Employer Selection Modal */}
            {editingEmployerIdx !== null && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[32px] p-6 shadow-2xl relative">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 uppercase">{t('income.batchReview.selectEmployer', 'Select Employer')}</h3>
                            <button onClick={() => setEditingEmployerIdx(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {workplaces.map(wp => (
                                <button
                                    key={wp.name}
                                    onClick={() => {
                                        onUpdateRow(editingEmployerIdx, { employer_name: wp.name });
                                        setEditingEmployerIdx(null);
                                    }}
                                    className="p-4 border-2 border-slate-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 text-left transition-all group"
                                >
                                    <div className="font-bold text-slate-700 group-hover:text-emerald-700">{wp.name}</div>
                                    {wp.domain && <div className="text-xs text-slate-400 truncate">{wp.domain}</div>}
                                </button>
                            ))}

                            <button
                                onClick={() => {
                                    setShowWorkplacePicker(true);
                                }}
                                className="p-4 border-2 border-dashed border-emerald-200 rounded-2xl hover:bg-emerald-50 text-emerald-600 flex flex-col items-center justify-center gap-2 transition-all"
                            >
                                <Plus className="w-6 h-6" />
                                <span className="font-bold text-sm">{t('income.batchReview.addNew', 'Add New')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <WorkplacePickerModal
                isOpen={showWorkplacePicker}
                occupationName={t('income.batchReview.employer', 'Employer')}
                onClose={() => setShowWorkplacePicker(false)}
                onSelect={(company) => {
                    if (editingEmployerIdx !== null) {
                        onUpdateRow(editingEmployerIdx, { employer_name: company.name });
                        if (onAddWorkplace) {
                            onAddWorkplace(company);
                        }
                    }
                    setShowWorkplacePicker(false);
                    setEditingEmployerIdx(null);
                }}
            />

            <MonthYearPickerModal
                isOpen={editingMonthIdx !== null}
                onClose={() => setEditingMonthIdx(null)}
                value={editingMonthIdx !== null ? batchResults[editingMonthIdx]?.data?.pay_month || new Date().toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7)}
                onSave={(v) => {
                    if (editingMonthIdx !== null) {
                        onUpdateRow(editingMonthIdx, { pay_month: v });
                    }
                    setEditingMonthIdx(null);
                }}
            />
        </div>
    );
};
