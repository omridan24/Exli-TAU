import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '../../../components/UI';

export const MultiSelectModal = ({ options, onClose, onConfirm, selectedValues = [] }) => {
    const [selected, setSelected] = useState(selectedValues);
    const [searchTerm, setSearchTerm] = useState('');
    const [customJob, setCustomJob] = useState('');

    const toggle = (val) => {
        if (selected.includes(val)) setSelected(selected.filter(s => s !== val));
        else if (selected.length < 3) setSelected([...selected, val]);
        else alert("Max 3 occupations.");
    };

    const handleAddCustom = () => {
        if (customJob.trim() && !selected.includes(customJob)) {
            if (selected.length < 3) { toggle(customJob.trim()); setCustomJob(''); }
            else alert("Max 3 occupations.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center"><h3 className="text-xl font-bold">Occupations (Max 3)</h3><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6" /></button></div>
                <div className="p-4 bg-slate-50 border-b space-y-3">
                    <input type="text" placeholder="Search standard jobs..." className="w-full p-3 rounded-xl border outline-none focus:border-emerald-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <div className="flex gap-2">
                        <input type="text" placeholder="Add custom job title..." className="flex-1 p-3 rounded-xl border text-sm outline-none focus:border-emerald-500" value={customJob} onChange={e => setCustomJob(e.target.value)} />
                        <button onClick={handleAddCustom} className="bg-slate-900 text-white px-6 rounded-xl font-bold text-sm">Add</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selected.filter(s => !options.includes(s)).map(job => (
                        <button key={job} onClick={() => toggle(job)} className="p-3 rounded-xl text-left font-bold bg-emerald-50 border-2 border-emerald-500 text-emerald-700 flex justify-between items-center">{job} <Check className="w-4 h-4" /></button>
                    ))}
                    {options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase())).map(job => (
                        <button key={job} onClick={() => toggle(job)} className={`p-3 rounded-xl text-left font-bold border transition-all flex justify-between items-center ${selected.includes(job) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{job} {selected.includes(job) && <Check className="w-4 h-4" />}</button>
                    ))}
                </div>
                <div className="p-4 border-t"><Button onClick={() => onConfirm(selected)} className="w-full justify-center">Confirm Selection</Button></div>
            </div>
        </div>
    );
};
