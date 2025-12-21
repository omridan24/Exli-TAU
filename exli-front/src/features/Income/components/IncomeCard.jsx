import React from 'react';

export const IncomeCard = ({ label, field, color, icon: Icon, value, onChange, currency }) => (
    <div className={`p-4 rounded-xl border ${color} bg-white flex flex-col gap-2 transition-all focus-within:ring-2 ring-offset-1`}>
        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <Icon className="w-4 h-4" /> {label}
        </div>
        <div className="relative">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{currency}</span>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(field, e.target.value)}
                className="w-full pl-10 py-1 text-2xl font-bold text-slate-800 outline-none placeholder:text-slate-200"
                placeholder="0"
            />
        </div>
    </div>
);
