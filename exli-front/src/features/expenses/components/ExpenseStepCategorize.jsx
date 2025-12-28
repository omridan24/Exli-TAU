
import React, { useState, useMemo } from 'react';
import { CreditCard, RotateCcw, ArrowUp, ArrowDown, Edit2, Check, Plus, XCircle, Trash2, X, Flag, AlertTriangle, Calendar, Type, Repeat } from 'lucide-react';
import { Button, CategoryIcon } from '../../../components/UI';

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
    // Internal state
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [isSuspectModalOpen, setIsSuspectModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Edit Modal State
    const [editForm, setEditForm] = useState({ description: '', amount: '', date: '' });

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
    const matchingRecurring = useMemo(() => {
        if (!recurringExpenses || !currentTx) return null;

        return recurringExpenses.find(rec => {
            // Match by description pattern
            const descMatch = currentTx.description
                .toLowerCase()
                .includes(rec.matchPattern?.toLowerCase() || '');

            // Match by amount (±5%)
            const amountDiff = Math.abs(currentTx.amount - rec.amount);
            const amountMatch = amountDiff / rec.amount < 0.05;

            return descMatch && amountMatch;
        });
    }, [currentTx, recurringExpenses]);

    if (isCreatingCat) {
        return (
            <div className="mb-6 p-6 bg-white rounded-3xl shadow-xl border border-slate-100">
                <h4 className="font-bold text-slate-800 mb-4 text-lg">Create New Category</h4>
                <div className="flex gap-2">
                    <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500" placeholder="e.g. Pet Supplies" autoFocus />
                    <Button onClick={onQuickAddCategory} disabled={!newCatName}>Create</Button>
                    <Button variant="secondary" onClick={() => setIsCreatingCat(false)}><X className="w-4 h-4" /></Button>
                </div>
            </div>
        );
    }

    if (isRefundModalOpen) {
        return (
            <div className="p-6 bg-amber-50 rounded-3xl shadow-xl border border-amber-200 animate-fade-in mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-amber-800 text-lg flex items-center gap-2"><XCircle className="w-5 h-5" /> Select Refund Category</h4>
                    <button onClick={() => setIsRefundModalOpen(false)} className="p-2 hover:bg-amber-100 rounded-full text-amber-700"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-amber-700 mb-6 font-medium">Which category is this refund for?</p>
                <div className="grid grid-cols-3 gap-3">
                    {categories.map(cat => (
                        <button key={cat.id} onClick={() => { onCategorize(cat.name, true); setIsRefundModalOpen(false); }} className="p-3 rounded-xl border-2 border-white bg-white hover:border-amber-300 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 shadow-sm">
                            <CategoryIcon iconName={cat.icon} color={cat.color} className="w-6 h-6" />
                            <span className="text-xs font-bold text-slate-600">{cat.name}</span>
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
                    <h4 className="font-bold text-red-800 text-lg flex items-center gap-2"><Flag className="w-5 h-5" /> Select Suspect Category</h4>
                    <button onClick={() => setIsSuspectModalOpen(false)} className="p-2 hover:bg-red-100 rounded-full text-red-700"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-red-700 mb-6 font-medium">Which category do you suspect this belongs to?</p>
                <div className="grid grid-cols-3 gap-3">
                    {categories.map(cat => (
                        <button key={cat.id} onClick={() => { onCategorize(cat.name, false, true); setIsSuspectModalOpen(false); }} className="p-3 rounded-xl border-2 border-white bg-white hover:border-red-300 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 shadow-sm">
                            <CategoryIcon iconName={cat.icon} color={cat.color} className="w-6 h-6" />
                            <span className="text-xs font-bold text-slate-600">{cat.name}</span>
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
                    <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Edit2 className="w-5 h-5" /> Edit Expense Details</h4>
                    <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                        <input type="text" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</label>
                            <input type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                            <input type="datetime-local" value={editForm.date ? new Date(editForm.date).toISOString().slice(0, 16) : ''} onChange={e => setEditForm({ ...editForm, date: new Date(e.target.value).toISOString() })} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                    <Button onClick={saveEdit}>Save Changes</Button>
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
                    <div className="absolute top-4 right-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm opacity-80 z-10">
                        <CreditCard className="w-3 h-3" /> {currentTx.sourceCard}
                    </div>

                    <div className="bg-slate-50 p-6 flex-1 flex flex-col justify-center items-center text-center relative">
                        <div className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">{cleanDateDisplay(currentTx.date)}</div>
                        <h3 className="text-2xl font-black text-slate-800 mb-4 px-8 leading-tight">{currentTx.description}</h3>

                        <div className="text-4xl font-mono font-black text-slate-800 flex items-center gap-2 group">
                            {currentTx.amount} <span className="text-lg text-slate-400 font-bold">{currentTx.currency}</span>
                        </div>
                        {currentTx.originalCategory && <div className="mt-4 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Orig: {currentTx.originalCategory}</div>}
                    </div>

                    {/* Navigation Controls Overlay */}
                    <div className="absolute bottom-4 left-4">
                        {currentIndex > 0 && (
                            <button onClick={handleUndo} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-full shadow-sm transition-all">
                                <RotateCcw className="w-3 h-3" /> Back
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
                            <span className="font-bold text-purple-900">Recurring Expense Detected</span>
                        </div>
                        <p className="text-sm text-purple-700 mb-3">
                            This matches: <strong>{matchingRecurring.name}</strong> ({matchingRecurring.frequency})
                        </p>
                        <Button
                            onClick={() => onCategorize(matchingRecurring.category, false, false, matchingRecurring.id)}
                            className="bg-purple-600 hover:bg-purple-700 w-full"
                        >
                            ✓ {matchingRecurring.category}
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
                                <span className={`text-[11px] font-bold leading-tight ${isSuggested ? 'text-emerald-700' : 'text-slate-600'}`}>{cat.name}</span>
                                {isPrevious && <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-200 px-1 rounded">WAS THIS</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-full md:w-64 flex flex-col gap-3">
                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest pl-1">Actions</span>

                    <button onClick={openEditModal} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors text-left border border-transparent hover:border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><Edit2 className="w-4 h-4" /></div> Edit Expense
                    </button>

                    <button onClick={() => setIsCreatingCat(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors text-left border border-transparent hover:border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center"><Plus className="w-4 h-4" /></div> Add Category
                    </button>

                    <div className="h-px bg-slate-100 my-2"></div>

                    <button onClick={() => setIsRefundModalOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 text-slate-600 font-bold text-sm transition-colors text-left border border-transparent hover:border-emerald-100 group">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Check className="w-4 h-4" /></div>
                        <span className="group-hover:text-emerald-700">Refunded (Income)</span>
                    </button>

                    <button onClick={onSkip} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-400 font-bold text-sm transition-colors text-left border border-transparent hover:border-slate-200 hover:text-slate-600">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Trash2 className="w-4 h-4" /></div> Skip
                    </button>

                    <div className="h-px bg-slate-100 my-2"></div>

                    <button onClick={() => setIsSuspectModalOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 font-bold text-sm transition-colors text-left border border-transparent hover:border-red-100 group">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center group-hover:animate-pulse"><Flag className="w-4 h-4" /></div>
                        <span className="group-hover:text-red-600">Mark as Suspect</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
