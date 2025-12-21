import React, { useState, useEffect } from 'react';
import { Search, Plus, Briefcase } from 'lucide-react';
import { LogoImage } from './LogoImage';

export const WorkplacePickerModal = ({ isOpen, occupationName, onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (searchTerm.length < 2) { setSuggestions([]); return; }
            setLoading(true);
            try {
                const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${searchTerm}`);
                const data = await res.json();
                setSuggestions(data);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        }, 300);
        return () => clearTimeout(delayDebounce);
    }, [searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-emerald-50/30">
                    <h3 className="text-xl font-black text-slate-800 uppercase">Workplace</h3>
                    <p className="text-xs text-emerald-600 font-bold">Where are you a {occupationName}?</p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                            placeholder="Search company..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                        {loading && <div className="text-center py-4 animate-pulse text-slate-400 text-xs">Searching...</div>}
                        {suggestions.map(s => (
                            <button key={s.domain} onClick={() => onSelect(s)} className="w-full p-3 flex items-center justify-between hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100 group">
                                <div className="flex items-center gap-3">
                                    <LogoImage logo={s.logo} domain={s.domain} />
                                    <div className="text-left">
                                        <div className="font-bold text-slate-700 text-sm">{s.name}</div>
                                        <div className="text-[10px] text-slate-400">{s.domain}</div>
                                    </div>
                                </div>
                                <Plus className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                            </button>
                        ))}
                        <button onClick={() => onSelect({ name: 'Independent', domain: 'independent', logo: '' })} className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold text-sm hover:bg-emerald-50 hover:border-emerald-200 flex items-center justify-center gap-2 transition-all">
                            <Briefcase className="w-4 h-4" /> I am Independent
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
