import React from 'react';
import {
    Utensils, ShoppingCart, Car, ShoppingBag, Home, HeartPulse, Ticket, MoreHorizontal,
    HelpCircle, Star, Briefcase, Gift, Plane, Coffee, Zap, Wifi, GraduationCap, PawPrint
} from 'lucide-react';

export const Button = ({ children, onClick, type, variant = 'primary', className = '', disabled = false }) => {
    const baseStyle = "px-6 py-3 rounded-xl font-bold transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2";
    const variants = {
        primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl",
        secondary: "bg-white text-slate-700 border-2 border-slate-100 hover:border-slate-300 hover:bg-slate-50",
        danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
        ghost: "bg-transparent text-slate-500 hover:text-slate-800"
    };

    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
            {children}
        </button>
    );
};

export const Card = ({ children, className = '', onClick }) => (
    <div onClick={onClick} className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}>
        {children}
    </div>
);

export const CategoryIcon = ({ iconName, className = "w-6 h-6", color }) => {
    const icons = {
        Utensils, ShoppingCart, Car, ShoppingBag, Home, HeartPulse, Ticket, MoreHorizontal,
        HelpCircle, Star, Briefcase, Gift, Plane, Coffee, Zap, Wifi, GraduationCap, PawPrint
    };

    const IconComponent = icons[iconName] || MoreHorizontal;

    return <IconComponent className={className} style={{ color }} />;
};

export const DateSpinner = ({ value, onChange }) => {
    const date = value ? new Date(value) : new Date(2000, 0, 1);
    const currentYear = new Date().getFullYear();

    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    const handleChange = (type, val) => {
        const newDate = new Date(date);
        if (type === 'year') newDate.setFullYear(parseInt(val));
        if (type === 'month') newDate.setMonth(parseInt(val));
        if (type === 'day') newDate.setDate(parseInt(val));
        if (isNaN(newDate.getTime())) return;
        onChange(newDate.toISOString().split('T')[0]);
    };

    return (
        <div className="flex gap-2">
            <div className="relative flex-1">
                <select value={date.getDate()} onChange={(e) => handleChange('day', e.target.value)} className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-emerald-500 text-center">{days.map(d => <option key={d} value={d}>{d}</option>)}</select>
            </div>
            <div className="relative flex-[1.5]">
                <select value={date.getMonth()} onChange={(e) => handleChange('month', e.target.value)} className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-emerald-500 text-center">{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
            </div>
            <div className="relative flex-[1.2]">
                <select value={date.getFullYear()} onChange={(e) => handleChange('year', e.target.value)} className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-emerald-500 text-center">{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
            </div>
        </div>
    );
};

// --- RESTORED LOGO ---
export const ExliLogo = ({ className = "h-8" }) => (
    <img src="/logo.svg" alt="Exli" className={className} />
);

export default ExliLogo;