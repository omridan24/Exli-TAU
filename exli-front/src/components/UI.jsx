import React, { useState, useEffect } from 'react';
import { Search, Plus, Check, X } from 'lucide-react';

export const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
        {children}
    </div>
);

export const Button = ({ children, onClick, variant = "primary", className = "", disabled = false }) => {
    const variants = {
        primary: "bg-emerald-600 text-white hover:bg-emerald-700",
        secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
        danger: "bg-red-50 text-red-600 hover:bg-red-100",
        ghost: "bg-transparent text-slate-500 hover:bg-slate-100"
    };
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
        >
            {children}
        </button>
    );
};

export const ExliLogo = () => (
    <img src="/logo.svg" alt="Exli" className="w-8 h-8 object-contain" />
);

export const SelectionModal = ({ isOpen, onClose, title, data, onSelect, multiSelect = false, selectedItems = [], allowCustom = false }) => {
    const [search, setSearch] = useState('');
    if (!isOpen) return null;

    const allItems = [...data];
    if (multiSelect) {
        selectedItems.forEach(item => {
            const exists = allItems.some(d => (d.name || d) === item);
            if (!exists) allItems.unshift(item);
        });
    }

    const filteredData = allItems.filter(item =>
        (item.name || item).toString().toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (item) => {
        const val = item.name || item;
        if (multiSelect) {
            if (selectedItems.includes(val)) {
                onSelect(selectedItems.filter(i => i !== val));
            } else if (selectedItems.length < 3) {
                onSelect([...selectedItems, val]);
            }
        } else {
            onSelect(item);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-2xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div><h3 className="text-xl font-bold text-slate-800">{title}</h3>{multiSelect && <p className="text-xs text-slate-500">Select up to 3</p>}</div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                </div>
                <div className="p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input type="text" placeholder={`Search ${title}...`} className="w-full pl-10 p-3 bg-slate-50 border-none rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {allowCustom && search && !filteredData.find(i => (i.name || i).toString().toLowerCase() === search.toLowerCase()) && (
                            <div className="col-span-full mb-2">
                                <button onClick={() => handleSelect(search)} className="w-full p-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add "{search}"</button>
                            </div>
                        )}
                        {filteredData.length === 0 && !search && <div className="col-span-full text-center py-10 text-slate-400">Loading or No items found...</div>}
                        {filteredData.map((item, idx) => {
                            const val = item.name || item;
                            const isSelected = multiSelect ? selectedItems.includes(val) : selectedItems === val;
                            return (
                                <button key={idx} onClick={() => handleSelect(item)} className={`p-4 rounded-xl text-left border-2 transition-all group relative flex flex-col justify-between min-h-[100px] ${isSelected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-white bg-white hover:border-emerald-200 hover:shadow-md'}`}>
                                    <div className="font-bold text-slate-700 break-words pr-2">{val}</div>
                                    {item.flag && <div className="text-3xl mt-2">{item.flag}</div>}
                                    {item.icon && <div className="text-emerald-100 group-hover:text-emerald-200 transition-colors mt-auto self-end">{item.icon}</div>}
                                    {isSelected && <div className="absolute top-2 right-2 text-emerald-600 bg-white rounded-full p-0.5"><Check className="w-4 h-4" /></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {multiSelect && <div className="p-4 border-t border-slate-100 bg-white flex justify-end"><Button onClick={onClose}>Done ({selectedItems.length})</Button></div>}
            </div>
        </div>
    );
};

export const InputModal = ({ isOpen, onClose, title, value, onSave, type = "text" }) => {
    const [val, setVal] = useState(value);
    useEffect(() => setVal(value), [value, isOpen]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-6 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>
                <input type={type} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-emerald-500 text-lg mb-6" value={val} onChange={e => setVal(e.target.value)} autoFocus />
                <div className="flex gap-2"><Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button><Button onClick={() => { onSave(val); onClose(); }} className="flex-1 justify-center">Save</Button></div>
            </div>
        </div>
    );
};