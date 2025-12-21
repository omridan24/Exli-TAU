import React, { useState } from 'react';
import { X, Check, Plus } from 'lucide-react';
import { Button } from '../../../components/UI';

export const SelectionModal = ({ isOpen, title, data = [], onClose, onSelect, selectedValue, isLoading, allowCustom = false }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [customValue, setCustomValue] = useState('');
    const [isAddingCustom, setIsAddingCustom] = useState(false);

    if (!isOpen) return null;

    const filtered = data.filter(o => {
        const name = o.name || o;
        return String(name).toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
                </div>

                {!isAddingCustom ? (
                    <>
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoading ? (
                                <div className="text-center py-10 animate-pulse text-slate-400 font-bold">Loading options...</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {filtered.map((opt, i) => {
                                        const name = opt.name || opt;
                                        const val = opt.code || name;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => onSelect(opt)}
                                                className={`p-4 rounded-xl text-left font-bold border transition-all flex items-center justify-between group ${selectedValue === name ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {opt.flag && opt.flag}
                                                    <span className="truncate">{name}</span>
                                                </div>
                                                {selectedValue === name && <Check className="w-5 h-5" />}
                                            </button>
                                        );
                                    })}
                                    {allowCustom && (
                                        <button onClick={() => setIsAddingCustom(true)} className="p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center justify-center gap-2">
                                            <Plus className="w-5 h-5" /> Add Other
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 p-10 flex flex-col justify-center">
                        <h4 className="text-lg font-bold text-slate-700 mb-4 text-center">Custom Value</h4>
                        <input
                            type="text"
                            className="w-full p-4 text-2xl font-bold border-2 border-slate-200 rounded-2xl outline-none focus:border-emerald-500 text-center mb-8"
                            value={customValue}
                            onChange={e => setCustomValue(e.target.value)}
                            placeholder="Type here..."
                        />
                        <div className="flex gap-4">
                            <Button variant="secondary" onClick={() => setIsAddingCustom(false)} className="flex-1 justify-center">Back</Button>
                            <Button onClick={() => onSelect(customValue)} className="flex-1 justify-center">Confirm</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
