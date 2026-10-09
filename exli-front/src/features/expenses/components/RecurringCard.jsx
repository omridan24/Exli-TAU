import React, { useState } from 'react';
import { Repeat, Sparkles, Plus, Edit2, Loader2, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../../config/firebase.js';
import { Button } from '../../../components/UI.jsx';
import { RecurringForm } from './RecurringForm.jsx';
import { Money } from '../../../components/Money.jsx';
import { useConvertInPlace } from '../../../lib/fx/useConvertInPlace';

export const RecurringCard = ({ userId, categories, recurringExpenses, onUpdate }) => {
    const { convertAmountRecord } = useConvertInPlace(userId);
    const { t } = useTranslation();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzeProgress, setAnalyzeProgress] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ show: false, expense: null });
    const [deleteSuccess, setDeleteSuccess] = useState(null);

    const analyzeRecurring = async () => {
        setIsAnalyzing(true);
        setAnalyzeProgress(0);
        setError(null);

        // Start 20-second progress simulation
        const startTime = Date.now();
        const estimatedSeconds = 20;

        const progressInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const progress = Math.min((elapsed / estimatedSeconds) * 100, 95);
            setAnalyzeProgress(progress);

            if (elapsed >= estimatedSeconds) {
                clearInterval(progressInterval);
            }
        }, 500);

        try {
            // Fetch existing recurring expenses to exclude
            const existingRecurring = await getDocs(collection(db, 'users', userId, 'recurring_expenses'));
            const exclusions = existingRecurring.docs.map(doc => ({
                name: doc.data().name,
                pattern: doc.data().matchPattern || doc.data().name.toLowerCase(),
                amount: doc.data().amount
            }));

            const response = await fetch(`${CLOUD_RUN_URL}/analyze-recurring`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    existing_recurring: exclusions  // Send exclusions to AI
                })
            });

            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();

            // Filter duplicates on frontend as backup
            const filteredSuggestions = (data.suggestions || []).filter(suggestion => {
                return !exclusions.some(existing => {
                    const nameSimilar = suggestion.name.toLowerCase() === existing.name.toLowerCase();
                    const patternSimilar = suggestion.description_pattern === existing.pattern;
                    const amountSimilar = existing.amount && Math.abs(suggestion.amount_average - existing.amount) / existing.amount < 0.1;
                    return nameSimilar || (patternSimilar && amountSimilar);
                });
            });

            clearInterval(progressInterval);
            setAnalyzeProgress(100);

            setTimeout(() => {
                setSuggestions(filteredSuggestions);

                if (filteredSuggestions.length === 0) {
                    setError(t('expenses.recurring.noNewPatterns'));
                }

                setIsAnalyzing(false);
                setAnalyzeProgress(null);
            }, 500);
        } catch (err) {
            clearInterval(progressInterval);
            console.error('Recurring analysis failed:', err);
            setError(err.message || "Failed to analyze recurring expenses.");
            setIsAnalyzing(false);
            setAnalyzeProgress(null);
        }
    };

    const saveRecurring = async (suggestion) => {
        try {
            await addDoc(collection(db, 'users', userId, 'recurring_expenses'), {
                name: suggestion.name,
                amount: suggestion.amount_average,
                currency: suggestion.currency,
                frequency: suggestion.frequency.toLowerCase(),
                category: suggestion.suggested_category,
                matchPattern: suggestion.description_pattern,
                source: 'ai_detected',
                isActive: true,
                createdAt: serverTimestamp()
            });

            setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
            onUpdate();
        } catch (err) {
            console.error('Save recurring failed:', err);
        }
    };

    const handleDeleteOption = async (option) => {
        const expense = deleteModal.expense;
        if (!expense) return;

        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const expensesRef = collection(db, 'users', userId, 'expenses');
            const q = query(expensesRef, where('recurringExpenseId', '==', expense.id));
            const snapshot = await getDocs(q);

            const deletePromises = [];
            let deletedMonths = [];

            if (option === 'this_month') {
                // Delete only from current month
                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.reportMonth === currentMonth) {
                        deletePromises.push(deleteDoc(doc(expensesRef, docSnap.id)));
                        deletedMonths.push(currentMonth);
                    }
                });
                await Promise.all(deletePromises);
                setDeleteSuccess(`✅ ${t('expenses.recurringDelete.removedFromMonth', { name: expense.name, month: currentMonth })}`);
            } else if (option === 'past') {
                // Delete from all past months (including current)
                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.reportMonth <= currentMonth) {
                        deletePromises.push(deleteDoc(doc(expensesRef, docSnap.id)));
                        deletedMonths.push(data.reportMonth);
                    }
                });
                await Promise.all(deletePromises);
                setDeleteSuccess(`✅ ${t('expenses.recurringDelete.removedFromPast', { name: expense.name, count: deletedMonths.length, months: deletedMonths.sort().join(', ') })}`);
            } else if (option === 'future') {
                // Delete from current and future months
                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.reportMonth >= currentMonth) {
                        deletePromises.push(deleteDoc(doc(expensesRef, docSnap.id)));
                        deletedMonths.push(data.reportMonth);
                    }
                });
                await Promise.all(deletePromises);
                setDeleteSuccess(`✅ ${t('expenses.recurringDelete.stoppedFuture', { name: expense.name, count: deletedMonths.length, months: deletedMonths.sort().join(', ') })}`);
            }

            setDeleteModal({ show: false, expense: null });
            onUpdate();

            // Clear success message after 5 seconds
            setTimeout(() => setDeleteSuccess(null), 5000);
        } catch (err) {
            console.error('Delete recurring failed:', err);
            alert('Failed to delete recurring expense');
        }
    };

    const deleteRecurring = async (recurringId) => {
        if (!confirm(t('expenses.recurringDelete.confirmDeleteAll'))) return;
        try {
            const expensesRef = collection(db, 'users', userId, 'expenses');
            const q = query(expensesRef, where('recurringExpenseId', '==', recurringId));
            const snapshot = await getDocs(q);

            const deletedMonths = snapshot.docs.map(d => d.data().reportMonth);

            const deletePromises = snapshot.docs.map(docSnap =>
                deleteDoc(doc(expensesRef, docSnap.id))
            );
            await Promise.all(deletePromises);

            // Delete the recurring expense definition
            await deleteDoc(doc(db, 'users', userId, 'recurring_expenses', recurringId));

            setDeleteModal({ show: false, expense: null });
            setDeleteSuccess(`✅ ${t('expenses.recurringDelete.deletedCompletely', { count: deletedMonths.length, months: deletedMonths.sort().join(', ') })}`);
            onUpdate();

            setTimeout(() => setDeleteSuccess(null), 5000);
        } catch (err) {
            console.error('Delete recurring failed:', err);
        }
    };

    return (
        <div className="border-2 border-purple-200 bg-purple-50 rounded-2xl p-6 relative">
            {/* Success Message */}
            {deleteSuccess && (
                <div className="absolute top-2 start-2 end-2 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg text-sm font-medium animate-fade-in z-10 shadow-lg">
                    {deleteSuccess}
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Repeat className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-bold text-purple-900">{t('expenses.recurring.title')}</h3>
                </div>
                <div className="text-xs text-purple-600 font-medium">
                    {t('expenses.recurring.count', { count: recurringExpenses.length })}
                </div>
            </div>

            {/* Existing recurring list */}
            {recurringExpenses.length > 0 && (
                <div className="space-y-2 mb-4">
                    {recurringExpenses.map(exp => (
                        <div
                            key={exp.id}
                            onClick={() => { setEditingExpense(exp); setShowForm(true); }}
                            className="flex justify-between items-center bg-white p-3 rounded-lg hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex-1">
                                <div className="font-bold text-sm text-slate-800 group-hover:text-purple-600">{exp.name}</div>
                                <div className="text-xs text-slate-500 capitalize">{exp.frequency} • {t('expenses.recurring.day', { day: exp.dayOfMonth || 1 })}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-purple-600">
                                    <Money
                                        amount={exp.amount} currency={exp.currency} original={exp.original} fx={exp.fx}
                                        onConvert={async () => { await convertAmountRecord('recurring_expenses', exp, exp.amount); onUpdate(); }}
                                    />
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteModal({ show: true, expense: exp }); }}
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                    title={t('common.delete')}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
                <div className="bg-white border border-purple-200 rounded-xl p-4 mb-4 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-yellow-500" />
                        <div className="font-bold text-sm text-purple-900">{t('expenses.recurring.aiDetectedPatterns')}</div>
                    </div>
                    <div className="space-y-2">
                        {suggestions.map((sug, i) => (
                            <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-700">{sug.name}</div>
                                    <div className="text-xs text-slate-500 capitalize">
                                        {sug.frequency} • {t('expenses.recurring.times', { count: sug.occurrences })} • {t('expenses.recurring.confidence', { level: sug.confidence })}
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => saveRecurring(sug)} className="ms-3">
                                    <Plus className="w-3 h-3 me-1" /> {t('common.add')}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-sm mb-4">
                    {error}
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-center">
                {isAnalyzing ? (
                    <div className="w-full">
                        <div className="flex items-center gap-3 mb-2">
                            <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                            <span className="font-bold text-purple-900">{t('expenses.recurring.analyzingPatterns')}</span>
                        </div>
                        <div className="w-full bg-purple-200 rounded-full h-2.5">
                            <div
                                className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${analyzeProgress}%` }}
                            />
                        </div>
                        <div className="text-xs text-purple-600 mt-1 text-end font-medium">
                            {Math.round(analyzeProgress)}%
                        </div>
                    </div>
                ) : (
                    <Button
                        onClick={analyzeRecurring}
                        variant="secondary"
                        className="w-full max-w-xs"
                    >
                        <Sparkles className="w-4 h-4" /> {t('expenses.recurring.autoAnalyze')}
                    </Button>
                )}
            </div>

            {/* Manual form modal */}
            {showForm && (
                <RecurringForm
                    userId={userId}
                    categories={categories}
                    editData={editingExpense}
                    onSave={() => {
                        setShowForm(false);
                        setEditingExpense(null);
                        onUpdate();
                    }}
                    onCancel={() => { setShowForm(false); setEditingExpense(null); }}
                />
            )}

            {/* Delete Options Modal */}
            {deleteModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl text-slate-800">{t('expenses.recurringDelete.title')}</h3>
                            <button onClick={() => setDeleteModal({ show: false, expense: null })} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-slate-600 mb-4">
                            {t('expenses.recurringDelete.chooseHow', { name: deleteModal.expense?.name })}
                        </p>

                        <div className="grid grid-cols-3 gap-4">
                            <button
                                onClick={() => handleDeleteOption('this_month')}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center text-center group"
                            >
                                <div className="text-3xl mb-2">📅</div>
                                <div className="font-bold text-sm text-slate-800">{t('expenses.recurringDelete.thisMonthOnly')}</div>
                                <div className="text-xs text-slate-500 mt-1">{t('expenses.recurringDelete.skipThisMonth')}</div>
                            </button>

                            <button
                                onClick={() => handleDeleteOption('past')}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-orange-500 hover:bg-orange-50 transition-all flex flex-col items-center text-center group"
                            >
                                <div className="text-3xl mb-2">⏮️</div>
                                <div className="font-bold text-sm text-slate-800">{t('expenses.recurringDelete.allPastMonths')}</div>
                                <div className="text-xs text-slate-500 mt-1">{t('expenses.recurringDelete.removeFromHistory')}</div>
                            </button>

                            <button
                                onClick={() => handleDeleteOption('future')}
                                className="p-6 rounded-xl border-2 border-slate-200 hover:border-red-500 hover:bg-red-50 transition-all flex flex-col items-center text-center group"
                            >
                                <div className="text-3xl mb-2">⏭️</div>
                                <div className="font-bold text-sm text-slate-800">{t('expenses.recurringDelete.stopFuture')}</div>
                                <div className="text-xs text-slate-500 mt-1">{t('expenses.recurringDelete.cancelSubscription')}</div>
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <button
                                onClick={() => deleteRecurring(deleteModal.expense.id)}
                                className="w-full p-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                            >
                                🗑️ {t('expenses.recurringDelete.deleteCompletely')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
