import React, { useState } from 'react';
import { Wallet, Plus, Edit2, Trash2, X, Sparkles } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../../config/firebase.js';
import { Button } from '../../../components/UI.jsx';
import { LogoImage } from './LogoImage.jsx';
import { RecurringIncomeForm } from './RecurringIncomeForm.jsx';

export const RecurringIncomeCard = ({ userId, workplaces, recurringIncomes, onUpdate }) => {
    const [showForm, setShowForm] = useState(false);
    const [editingIncome, setEditingIncome] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ show: false, income: null });
    const [deleteSuccess, setDeleteSuccess] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [analyzeError, setAnalyzeError] = useState('');

    const handleDeleteOption = async (option) => {
        const income = deleteModal.income;
        if (!income) return;

        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const incomeRef = collection(db, 'users', userId, 'income');
            const q = query(incomeRef, where('recurringIncomeId', '==', income.id));
            const snapshot = await getDocs(q);

            const deletePromises = [];
            let deletedMonths = [];

            if (option === 'this_month') {
                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.month === currentMonth) {
                        deletePromises.push(deleteDoc(doc(incomeRef, docSnap.id)));
                        deletedMonths.push(currentMonth);
                    }
                });
                await Promise.all(deletePromises);
                setDeleteSuccess(`✅ Removed ${income.workplaceName} from ${currentMonth} only`);
            } else if (option === 'past') {
                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.month <= currentMonth) {
                        deletePromises.push(deleteDoc(doc(incomeRef, docSnap.id)));
                        deletedMonths.push(data.month);
                    }
                });
                await Promise.all(deletePromises);
                setDeleteSuccess(`✅ Removed ${income.workplaceName} from ${deletedMonths.length} past month(s)`);
            } else if (option === 'future') {
                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.month >= currentMonth) {
                        deletePromises.push(deleteDoc(doc(incomeRef, docSnap.id)));
                        deletedMonths.push(data.month);
                    }
                });
                await Promise.all(deletePromises);
                setDeleteSuccess(`✅ Stopped future income for ${income.workplaceName}. Removed from ${deletedMonths.length} month(s)`);
            }

            setDeleteModal({ show: false, income: null });
            onUpdate();

            setTimeout(() => setDeleteSuccess(null), 5000);
        } catch (err) {
            console.error('Delete recurring income failed:', err);
            alert('Failed to delete recurring income');
        }
    };

    const deleteRecurringCompletely = async (recurringId, workplaceName) => {
        if (!confirm(`Delete ${workplaceName} completely from ALL months?`)) return;
        try {
            const incomeRef = collection(db, 'users', userId, 'income');
            const q = query(incomeRef, where('recurringIncomeId', '==', recurringId));
            const snapshot = await getDocs(q);

            const deletePromises = snapshot.docs.map(docSnap =>
                deleteDoc(doc(incomeRef, docSnap.id))
            );
            await Promise.all(deletePromises);

            await deleteDoc(doc(db, 'users', userId, 'recurring_income', recurringId));

            setDeleteModal({ show: false, income: null });
            setDeleteSuccess(`✅ Completely deleted ${workplaceName} from all months`);
            onUpdate();

            setTimeout(() => setDeleteSuccess(null), 5000);
        } catch (err) {
            console.error('Delete recurring failed:', err);
        }
    };

    const analyzeRecurringIncome = async () => {
        setIsAnalyzing(true);
        setAnalyzeError('');
        setSuggestions([]);

        try {
            // Get existing recurring income to exclude from suggestions
            const existingNames = recurringIncomes.map(inc => inc.workplaceName.toLowerCase());

            const response = await fetch(`${CLOUD_RUN_URL}/analyze-recurring-income`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    excludeWorkplaces: existingNames
                })
            });

            const data = await response.json();

            if (data.suggestions && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
            } else {
                setAnalyzeError('No recurring income patterns found in your data.');
            }
        } catch (err) {
            console.error('AI analysis failed:', err);
            setAnalyzeError('Failed to analyze. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const acceptSuggestion = (suggestion) => {
        setEditingIncome({
            workplaceName: suggestion.workplaceName,
            occupation: suggestion.occupation || '',
            grossAmount: suggestion.amount_average,
            netAmount: suggestion.amount_average * 0.75, // Estimate
            frequency: suggestion.frequency || 'monthly',
            currency: suggestion.currency || 'ILS'
        });
        setShowForm(true);
        setSuggestions([]);
    };

    return (
        <div className="border-2 border-teal-200 bg-teal-50 rounded-2xl p-6 relative">
            {/* Success Message */}
            {deleteSuccess && (
                <div className="absolute top-2 left-2 right-2 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg text-sm font-medium animate-fade-in z-10 shadow-lg">
                    {deleteSuccess}
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-teal-600" />
                    <h3 className="text-lg font-bold text-teal-900">Recurring Income</h3>
                </div>
                <div className="text-xs text-teal-600 font-medium">
                    {recurringIncomes.length} active
                </div>
            </div>

            {/* Existing recurring income list */}
            {recurringIncomes.length > 0 && (
                <div className="space-y-3 mb-4">
                    {recurringIncomes.map(inc => (
                        <div
                            key={inc.id}
                            onClick={() => { setEditingIncome(inc); setShowForm(true); }}
                            className="bg-white p-4 rounded-lg hover:shadow-md transition-all cursor-pointer group border border-transparent hover:border-teal-200"
                        >
                            <div className="flex items-start gap-3">
                                <LogoImage
                                    logo={inc.workplaceLogo}
                                    domain={inc.workplaceDomain}
                                    className="w-12 h-12 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-slate-800 group-hover:text-teal-600 truncate">
                                        {inc.workplaceName}
                                    </div>
                                    <div className="text-xs text-slate-500 capitalize truncate">
                                        {inc.occupation} • {inc.frequency}
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <span className="text-lg font-mono font-black text-teal-600">
                                            {inc.netAmount?.toLocaleString() || 0}
                                        </span>
                                        <span className="text-xs font-bold text-slate-400">{inc.currency}</span>
                                    </div>

                                    {/* Pension Breakdown */}
                                    {inc.expectedPension > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Expected Pension</span>
                                                <span className="text-xs font-mono font-bold text-purple-600">
                                                    {Number(inc.expectedPension).toLocaleString()}
                                                </span>
                                            </div>

                                            {/* Visual breakdown */}
                                            <div className="flex gap-2 text-[10px] text-slate-400 bg-slate-50 p-1.5 rounded-lg">
                                                <span className="font-medium">
                                                    You: <span className="text-slate-700">{inc.employeePct}%</span>
                                                </span>
                                                <span className="text-slate-300">|</span>
                                                <span className="font-medium">
                                                    Work: <span className="text-slate-700">{inc.employerPct}%</span>
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteModal({ show: true, income: inc }); }}
                                    className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Analysis Error */}
            {analyzeError && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-xs">
                    {analyzeError}
                </div>
            )}

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-bold text-teal-700 uppercase tracking-wide flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI Found {suggestions.length} Pattern(s)
                    </div>
                    {suggestions.map((sug, idx) => (
                        <div
                            key={idx}
                            className="bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-lg p-3"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold text-slate-800">{sug.workplaceName}</div>
                                    <div className="text-xs text-slate-500">{sug.frequency || 'monthly'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono font-black text-teal-600">
                                        ~{sug.amount_average?.toLocaleString() || 0}
                                    </div>
                                    <div className="text-xs text-slate-500">{sug.currency || 'ILS'}</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => acceptSuggestion(sug)}
                                    className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    ✓ Accept & Edit
                                </button>
                                <button
                                    onClick={() => setSuggestions(suggestions.filter((_, i) => i !== idx))}
                                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-medium rounded-lg transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={() => setSuggestions([])}
                        className="w-full text-xs text-slate-500 hover:text-slate-700 py-1"
                    >
                        Dismiss All
                    </button>
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <RecurringIncomeForm
                    userId={userId}
                    workplaces={workplaces}
                    currency="ILS"
                    editData={editingIncome}
                    onSave={() => {
                        setShowForm(false);
                        setEditingIncome(null);
                        onUpdate();
                    }}
                    onCancel={() => { setShowForm(false); setEditingIncome(null); }}
                />
            )}

            {/* Delete Options Modal */}
            {deleteModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl text-slate-800">Remove Recurring Income</h3>
                            <button onClick={() => setDeleteModal({ show: false, income: null })} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-slate-600 mb-4">
                            Choose how to remove <strong>{deleteModal.income?.workplaceName}</strong>:
                        </p>

                        <div className="grid grid-cols-3 gap-4">
                            <button
                                onClick={() => handleDeleteOption('this_month')}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center text-center group"
                            >
                                <div className="text-3xl mb-2">📅</div>
                                <div className="font-bold text-sm text-slate-800">This Month Only</div>
                                <div className="text-xs text-slate-500 mt-1">Skip this month</div>
                            </button>

                            <button
                                onClick={() => handleDeleteOption('past')}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-orange-500 hover:bg-orange-50 transition-all flex flex-col items-center text-center group"
                            >
                                <div className="text-3xl mb-2">⏮️</div>
                                <div className="font-bold text-sm text-slate-800">All Past Months</div>
                                <div className="text-xs text-slate-500 mt-1">Remove from history</div>
                            </button>

                            <button
                                onClick={() => handleDeleteOption('future')}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-red-500 hover:bg-red-50 transition-all flex flex-col items-center text-center group"
                            >
                                <div className="text-3xl mb-2">⏭️</div>
                                <div className="font-bold text-sm text-slate-800">Stop Future</div>
                                <div className="text-xs text-slate-500 mt-1">End contract</div>
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <button
                                onClick={() => deleteRecurringCompletely(deleteModal.income.id, deleteModal.income.workplaceName)}
                                className="w-full p-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                            >
                                🗑️ Delete Completely (Recurring + All Months)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
