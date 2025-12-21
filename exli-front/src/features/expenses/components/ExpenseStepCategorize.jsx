import React from 'react';
import { CreditCard, RotateCcw, ArrowUp, ArrowDown, Edit2, Check, Plus, XCircle, Trash2, X } from 'lucide-react';
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
    isEditingAmount,
    editAmountValue,
    setEditAmountValue,
    onSaveAmountEdit,
    onShiftAmount,
    onStartEditAmount,
    categories,
    suggestedCategoryId,
    onCategorize,
    onSkip,
    cleanDateDisplay
}) => {
    if (isCreatingCat) {
        return (
            <div className="mb-6 p-6 bg-white rounded-3xl shadow-xl border border-slate-100">
                <h4 className="font-bold text-slate-800 mb-4 text-lg">Create New Category</h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                        placeholder="e.g. Pet Supplies"
                        autoFocus
                    />
                    <Button onClick={onQuickAddCategory} disabled={!newCatName}>Create</Button>
                    <Button variant="secondary" onClick={() => setIsCreatingCat(false)}><X className="w-4 h-4" /></Button>
                </div>
            </div>
        );
    }

    if (!currentTx) return null;

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8 relative">
            <div className="absolute top-4 right-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm opacity-80"><CreditCard className="w-3 h-3" /> {currentTx.sourceCard}</div>
            <div className="absolute top-4 left-4">
                {currentIndex > 0 && (
                    <button onClick={handleUndo} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors">
                        <RotateCcw className="w-3 h-3" /> Previous
                    </button>
                )}
            </div>
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start pt-12">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">{currentTx.description}</h3>
                    <div className="text-sm text-slate-500 mt-1">{cleanDateDisplay(currentTx.date)}</div>
                </div>
                <div className="text-right flex flex-col items-end">
                    {isEditingAmount ? (
                        <div className="flex items-center gap-2">
                            <input type="number" autoFocus value={editAmountValue} onChange={(e) => setEditAmountValue(e.target.value)} className="w-32 p-2 text-2xl font-mono font-bold text-slate-800 border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-200" />
                            <button onClick={onSaveAmountEdit} className="p-2 bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-200"><Check className="w-5 h-5" /></button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-end gap-2 group">
                            <div className="flex flex-col gap-1 mr-2 opacity-50 hover:opacity-100 transition-opacity">
                                <button onClick={() => onShiftAmount(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500" title="Move amount to PREVIOUS transaction"><ArrowUp className="w-4 h-4" /></button>
                                <button onClick={() => onShiftAmount(1)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500" title="Move amount to NEXT transaction"><ArrowDown className="w-4 h-4" /></button>
                            </div>
                            <div className="text-3xl font-mono font-bold text-slate-800">
                                {currentTx.amount} <span className="text-lg text-slate-400">{currentTx.currency}</span>
                            </div>
                            <button onClick={onStartEditAmount} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition-colors opacity-0 group-hover:opacity-100" title="Edit Amount">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {currentTx.originalCategory && (<div className="inline-block mt-2 px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded">File: {currentTx.originalCategory}</div>)}
                </div>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {categories.map(cat => {
                        const isSuggested = suggestedCategoryId === cat.id; return (
                            <button key={cat.id} onClick={() => onCategorize(cat.name)} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 ${isSuggested ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}>
                                <CategoryIcon iconName={cat.icon} color={cat.color} className={`w-6 h-6 ${isSuggested ? 'text-emerald-600' : ''}`} />
                                <span className={`text-xs font-bold ${isSuggested ? 'text-emerald-700' : 'text-slate-600'}`}>{cat.name}</span>
                            </button>);
                    })}
                    <button onClick={() => setIsCreatingCat(true)} className="p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 text-slate-400 hover:text-emerald-600"><Plus className="w-6 h-6" /><span className="text-xs font-bold">New Cat</span></button>
                    <button onClick={() => onCategorize('Refunded', true)} className="p-3 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-all flex flex-col items-center justify-center gap-2 text-center h-24 text-amber-700"><XCircle className="w-6 h-6" /><span className="text-xs font-bold">Refunded</span></button>
                </div>
                <div className="border-t border-slate-100 pt-6">
                    <button onClick={onSkip} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors px-4 py-3 rounded-xl font-bold border border-transparent hover:border-slate-200">
                        <Trash2 className="w-5 h-5" /> Skip Transaction
                    </button>
                </div>
            </div>
        </div>
    );
};
