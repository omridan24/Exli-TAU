
import React, { useState, useMemo } from 'react';
import { CreditCard, RotateCcw, ArrowUp, ArrowDown, Edit2, Check, Plus, XCircle, Trash2, X, Flag, AlertTriangle, Calendar, Type, Repeat, HelpCircle, FileWarning, ShieldAlert, Link, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, CategoryIcon } from '../../../components/UI';

// Category translation mapping
const categoryKeyMap = {
    'food': 'food', 'groceries': 'groceries', 'transport': 'transport', 'shopping': 'shopping',
    'housing': 'housing', 'bills': 'bills', 'travel': 'travel', 'health': 'health',
    'education': 'education', 'pets': 'pets', 'gifts': 'gifts', 'entertainment': 'entertainment', 'other': 'other'
};

export const ExpenseStepCategorize = ({
    isCreatingCat,
    setIsCreatingCat,
    newCatName,
    setNewCatName,
    onQuickAddCategory,
    currentTx,
    currentIndex,
    handleUndo,
    lastUndoChoice,
    onShiftAmount,
    categories,
    suggestedCategoryId,
    onCategorize,
    onSkip,
    cleanDateDisplay,
    onUpdateTransaction, // Added prop for editing transaction
    recurringExpenses // NEW: for recurring detection
}) => {
    const { t } = useTranslation();

    // Internal state
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [isSuspectModalOpen, setIsSuspectModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isRecurringListOpen, setIsRecurringListOpen] = useState(false);

    // Edit Modal State
    const [editForm, setEditForm] = useState({ description: '', amount: '', date: '' });

    // Suspect Reason Options
    const suspectOptions = [
        { id: 'unrecognized', labelKey: 'expenses.suspectReasons.unrecognized', icon: HelpCircle, noteKey: 'expenses.suspectReasons.unrecognizedNote' },
        { id: 'duplicate', labelKey: 'expenses.suspectReasons.duplicate', icon: FileWarning, noteKey: 'expenses.suspectReasons.duplicateNote' },
        { id: 'amount', labelKey: 'expenses.suspectReasons.amount', icon: AlertTriangle, noteKey: 'expenses.suspectReasons.amountNote' },
        { id: 'fraud', labelKey: 'expenses.suspectReasons.fraud', icon: ShieldAlert, noteKey: 'expenses.suspectReasons.fraudNote' }
    ];

    const getCategoryName = (cat) => {
        const key = categoryKeyMap[cat.id];
        return key ? t(`categories.${key}`) : cat.name;
    };

    const openEditModal = () => {
        setEditForm({
            description: currentTx.description,
            amount: currentTx.amount,
            date: currentTx.date
        });
        setIsEditModalOpen(true);
    };

    const saveEdit = () => {
        onUpdateTransaction({
            description: editForm.description,
            amount: parseFloat(editForm.amount),
            date: editForm.date
        });
        setIsEditModalOpen(false);
    };

    // Check if current transaction matches a recurring expense
    // IMPROVED: Uses confidence scoring and priority matching
    const matchingRecurring = useMemo(() => {
        if (!recurringExpenses || !currentTx) return null;

        // Normalize function for comparison - preserves Hebrew characters
        const normalize = (str) => str
            .toLowerCase()
            .replace(/[^a-z0-9א-ת\s]/gi, '')  // Keep letters, numbers, Hebrew, spaces
            .replace(/\s+/g, ' ')
            .trim();

        const normalizedDesc = normalize(currentTx.description);

        // Score each recurring expense
        const matches = recurringExpenses
            .map(rec => {
                const pattern = normalize(rec.matchPattern || rec.name || '');

                // Skip if pattern is empty or too short
                if (!pattern || pattern.length < 2) return null;

                // Check different match types
                const isExactMatch = normalizedDesc === pattern;
                const startsWithPattern = normalizedDesc.startsWith(pattern);
                const containsPattern = normalizedDesc.includes(pattern);

                // Require pattern to be at least 3 characters for contains match
                // to avoid false positives from short patterns
                const validContains = containsPattern && pattern.length >= 3;

                if (!isExactMatch && !startsWithPattern && !validContains) {
                    return null;
                }

                // Amount matching with variable tolerance
                const amountDiff = Math.abs(currentTx.amount - rec.amount);
                const amountRatio = rec.amount > 0 ? amountDiff / rec.amount : 1;

                // Stricter for exact matches, looser for utility-type expenses (bills, rent)
                const isUtilityCategory = ['bills', 'utilities', 'housing']
                    .includes(rec.category?.toLowerCase());
                const amountTolerance = isUtilityCategory ? 0.15 : 0.05;

                if (amountRatio > amountTolerance) {
                    return null;
                }

                // Calculate confidence score (0-100)
                let confidence = 0;
                if (isExactMatch) confidence = 100;
                else if (startsWithPattern) confidence = 80;
                else if (validContains) confidence = 60;

                // Bonus for closer amount match
                confidence += Math.round((1 - amountRatio) * 20);

                return { recurring: rec, confidence };
            })
            .filter(Boolean)
            .sort((a, b) => b.confidence - a.confidence);

        // Return highest confidence match (if above threshold of 70)
        return matches.length > 0 && matches[0].confidence >= 70
            ? matches[0].recurring
            : null;
    }, [currentTx, recurringExpenses]);

    if (isCreatingCat) {
        return (
            <div className="mb-6 p-6 bg-white rounded-3xl shadow-xl border border-slate-100">
                <h4 className="font-bold text-slate-800 mb-4 text-lg">{t('expenses.categorize.createNewCategory')}</h4>
                <div className="flex gap-2">
                    <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500" placeholder={t('expenses.categorize.categoryPlaceholder')} autoFocus />
                    <Button onClick={onQuickAddCategory} disabled={!newCatName}>{t('expenses.categorize.create')}</Button>
                    <Button variant="secondary" onClick={() => setIsCreatingCat(false)}><X className="w-4 h-4" /></Button>
                </div>
            </div>
        );
    }

    if (isRefundModalOpen) {
        return (
            <div className="p-6 bg-amber-50 rounded-3xl shadow-xl border border-amber-200 animate-fade-in mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-amber-800 text-lg flex items-center gap-2"><XCircle className="w-5 h-5" /> {t('expenses.categorize.selectRefundCategory')}</h4>
                    <button onClick={() => setIsRefundModalOpen(false)} className="p-2 hover:bg-amber-100 rounded-full text-amber-700"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-amber-700 mb-6 font-medium">{t('expenses.categorize.whichCategoryRefund')}</p>
                <div className="grid grid-cols-3 gap-3">
                    {categories.map(cat => (
                        <button key={cat.id} onClick={() => { onCategorize(cat.name, true); setIsRefundModalOpen(false); }} className="p-3 rounded-xl border-2 border-white bg-white hover:border-amber-300 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 shadow-sm">
                            <CategoryIcon iconName={cat.icon} color={cat.color} className="w-6 h-6" />
                            <span className="text-xs font-bold text-slate-600">{getCategoryName(cat)}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (isSuspectModalOpen) {
        return (
            <div className="p-6 bg-red-50 rounded-3xl shadow-xl border border-red-200 animate-fade-in mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-red-800 text-lg flex items-center gap-2"><Flag className="w-5 h-5" /> {t('expenses.categorize.whySuspicious')}</h4>
                    <button onClick={() => setIsSuspectModalOpen(false)} className="p-2 hover:bg-red-100 rounded-full text-red-700"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-red-700 mb-6 font-medium">{t('expenses.categorize.selectReason')}</p>
                <div className="grid grid-cols-2 gap-3">
                    {suspectOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => {
                                onCategorize("Uncategorized", false, true, null, t(option.noteKey));
                                setIsSuspectModalOpen(false);
                            }}
                            className="p-4 rounded-xl border-2 border-white bg-white hover:border-red-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 text-center h-28 group"
                        >
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <option.icon className="w-5 h-5 text-red-600" />
                            </div>
                            <span className="text-sm font-bold text-slate-700 leading-tight">{t(option.labelKey)}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Full Edit Modal
    if (isEditModalOpen) {
        return (
            <div className="p-6 bg-white rounded-3xl shadow-xl border border-slate-200 animate-fade-in mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Edit2 className="w-5 h-5" /> {t('expenses.categorize.editExpenseDetails')}</h4>
                    <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('expenses.columnFields.description')}</label>
                        <input type="text" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('expenses.columnFields.amount')}</label>
                            <input type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('expenses.columnFields.date')}</label>
                            <input type="datetime-local" value={editForm.date ? new Date(editForm.date).toISOString().slice(0, 16) : ''} onChange={e => setEditForm({ ...editForm, date: new Date(e.target.value).toISOString() })} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={saveEdit}>{t('expenses.categorize.saveChanges')}</Button>
                </div>
            </div>
        );
    }

    // Recurring Expense List Modal
    if (isRecurringListOpen) {
        return (
            <div className="p-6 bg-white rounded-3xl shadow-xl border border-slate-200 animate-fade-in mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Repeat className="w-5 h-5 text-purple-600" />
                        {t('expenses.recurring.linkTitle') || 'Link to Recurring Expense'}
                    </h4>
                    <button onClick={() => setIsRecurringListOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                    {t('expenses.recurring.linkDescription') || 'Select which recurring expense this transaction belongs to:'}
                </p>
                {recurringExpenses && recurringExpenses.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {recurringExpenses.map(rec => (
                            <button
                                key={rec.id}
                                onClick={() => {
                                    onCategorize(rec.category, false, false, rec.id);
                                    setIsRecurringListOpen(false);
                                }}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-all text-start group"
                            >
                                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Repeat className="w-6 h-6 text-purple-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 truncate">{rec.name}</div>
                                    <div className="text-sm text-slate-500 flex items-center gap-2">
                                        <span className="font-mono font-bold">{rec.amount} {rec.currency}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-xs uppercase">{rec.frequency?.type || 'monthly'}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400">
                        <Repeat className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>{t('expenses.recurring.noRecurring') || 'No recurring expenses set up yet'}</p>
                    </div>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <Button variant="secondary" onClick={() => setIsRecurringListOpen(false)} className="w-full">
                        {t('common.cancel')}
                    </Button>
                </div>
            </div>
        );
    }

    if (!currentTx) return null;

    return (
        <div className="flex flex-col md:flex-row gap-6 mb-8">
            {/* Main Content Area */}
            <div className="flex-1 space-y-4">
                {/* Transaction Card */}
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden relative min-h-[250px] flex flex-col justify-between">
                    <div className="absolute top-4 end-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm opacity-80 z-10">
                        <CreditCard className="w-3 h-3" /> {currentTx.sourceCard}
                    </div>

                    <div className="bg-slate-50 p-6 flex-1 flex flex-col justify-center items-center text-center relative">
                        <div className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">{cleanDateDisplay(currentTx.date)}</div>
                        <h3 className="text-2xl font-black text-slate-800 mb-4 px-8 leading-tight">{currentTx.description}</h3>

                        <div className="text-4xl font-mono font-black text-slate-800 flex items-center gap-2 group">
                            {currentTx.amount} <span className="text-lg text-slate-400 font-bold">{currentTx.currency}</span>
                        </div>
                        {currentTx.originalCategory && <div className="mt-4 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">{t('expenses.categorize.original')} {currentTx.originalCategory}</div>}
                    </div>

                    {/* Navigation Controls Overlay */}
                    <div className="absolute bottom-4 start-4">
                        {currentIndex > 0 && (
                            <button onClick={handleUndo} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-full shadow-sm transition-all">
                                <RotateCcw className="w-3 h-3" /> {t('common.back')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Recurring Hint Box */}
                {matchingRecurring && (
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 animate-fade-in shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                                <Repeat className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-bold text-purple-900">{t('expenses.recurring.detected')}</span>
                        </div>
                        <p className="text-sm text-purple-700 mb-3">
                            {t('expenses.recurring.matches', { name: matchingRecurring.name, frequency: matchingRecurring.frequency })}
                        </p>
                        <Button
                            onClick={() => onCategorize(matchingRecurring.category, false, false, matchingRecurring.id)}
                            className="bg-purple-600 hover:bg-purple-700 w-full flex items-center justify-center gap-2"
                        >
                            <Link className="w-4 h-4" /> {t('expenses.recurring.linkAndMerge')}
                        </Button>
                    </div>
                )}

                {/* Categories Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {categories.map(cat => {
                        const isSuggested = suggestedCategoryId === cat.id;
                        const isPrevious = lastUndoChoice === cat.name; // Check if this was the last choice
                        return (
                            <button key={cat.id} onClick={() => onCategorize(cat.name)} className={`p-2 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 ${isPrevious ? 'ring-4 ring-slate-200 border-slate-400 bg-slate-50' : ''} ${isSuggested ? 'border-emerald-500 bg-emerald-50 shadow-md scale-105' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
                                <CategoryIcon iconName={cat.icon} color={cat.color} className={`w-6 h-6 ${isSuggested ? 'text-emerald-600' : ''}`} />
                                <span className={`text-[11px] font-bold leading-tight ${isSuggested ? 'text-emerald-700' : 'text-slate-600'}`}>{getCategoryName(cat)}</span>
                                {isPrevious && <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-200 px-1 rounded">{t('expenses.categorize.wasThis')}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-full md:w-64 flex flex-col gap-3">
                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest ps-1">{t('expenses.categorize.actions')}</span>

                    <button onClick={openEditModal} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors text-start border border-transparent hover:border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><Edit2 className="w-4 h-4" /></div> {t('expenses.categorize.editExpense')}
                    </button>

                    <button onClick={() => setIsCreatingCat(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors text-start border border-transparent hover:border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center"><Plus className="w-4 h-4" /></div> {t('expenses.categorize.addCategory')}
                    </button>

                    <div className="h-px bg-slate-100 my-2"></div>

                    <button onClick={() => setIsRefundModalOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 text-slate-600 font-bold text-sm transition-colors text-start border border-transparent hover:border-emerald-100 group">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Check className="w-4 h-4" /></div>
                        <span className="group-hover:text-emerald-700">{t('expenses.categorize.refundedIncome')}</span>
                    </button>

                    <button onClick={onSkip} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-400 font-bold text-sm transition-colors text-start border border-transparent hover:border-slate-200 hover:text-slate-600">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Trash2 className="w-4 h-4" /></div> {t('expenses.categorize.skip')}
                    </button>

                    {recurringExpenses && recurringExpenses.length > 0 && (
                        <button onClick={() => setIsRecurringListOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 text-slate-600 font-bold text-sm transition-colors text-start border border-transparent hover:border-purple-100 group">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Repeat className="w-4 h-4" /></div>
                            <span className="group-hover:text-purple-700">{t('expenses.recurring.linkToRecurring') || 'Link to Recurring'}</span>
                        </button>
                    )}

                    <div className="h-px bg-slate-100 my-2"></div>

                    <button onClick={() => setIsSuspectModalOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 font-bold text-sm transition-colors text-start border border-transparent hover:border-red-100 group">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center group-hover:animate-pulse"><Flag className="w-4 h-4" /></div>
                        <span className="group-hover:text-red-600">{t('expenses.categorize.markAsSuspect')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

