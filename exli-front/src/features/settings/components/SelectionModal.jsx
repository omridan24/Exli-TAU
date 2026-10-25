import React, { useState } from 'react';
import { X, Check, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/UI';

// Mapping for status values to translation keys
const statusKeyMap = {
    'Single': 'single',
    'Married': 'married',
    'Divorced': 'divorced',
    'Widowed': 'widowed',
    'Partnership': 'partnership'
};

export const SelectionModal = ({ isOpen, title, data = [], onClose, onSelect, selectedValue, isLoading, allowCustom = false }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [customValue, setCustomValue] = useState('');
    const [isAddingCustom, setIsAddingCustom] = useState(false);

    if (!isOpen) return null;

    // Translate status values if applicable
    const getDisplayName = (item) => {
        const name = item.name || item;
        const statusKey = statusKeyMap[name];
        if (statusKey) {
            return t(`status.${statusKey}`);
        }
        return name;
    };

    const filtered = data.filter(o => {
        const name = o.name || o;
        const displayName = getDisplayName(o);
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        const originalMatch = String(name).toLowerCase().includes(term);
        const displayMatch = String(displayName).toLowerCase().includes(term);
        const hebrewMatch = o.nameHe ? String(o.nameHe).toLowerCase().includes(term) : false;
        const codeMatch = o.code ? String(o.code).toLowerCase() === term : false;
        return originalMatch || displayMatch || hebrewMatch || codeMatch;
    });

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {!isAddingCustom ? (
                    <>
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                            <input
                                type="text"
                                placeholder={t('common.search')}
                                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 bg-white"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoading ? (
                                <div className="text-center py-10 animate-pulse text-slate-400 font-bold">
                                    {t('common.loadingOptions')}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {filtered.map((opt, i) => {
                                        const name = opt.name || opt;
                                        const displayName = getDisplayName(opt);
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => onSelect(opt)}
                                                className={`p-4 rounded-xl text-start font-bold border transition-all flex items-center justify-between group ${selectedValue === name ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {opt.flag && (
                                                        typeof opt.flag === 'string' && (opt.flag.startsWith('http') || opt.flag.startsWith('/')) ? (
                                                            <img src={opt.flag} alt="" className="w-6 h-4 object-cover rounded-sm shadow-xs" loading="lazy" />
                                                        ) : (
                                                            opt.flag
                                                        )
                                                    )}
                                                    <span className="truncate">{displayName}</span>
                                                </div>
                                                {selectedValue === name && <Check className="w-5 h-5" />}
                                            </button>
                                        );
                                    })}
                                    {allowCustom && (
                                        <button
                                            onClick={() => setIsAddingCustom(true)}
                                            className="p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-5 h-5" /> {t('common.addOther')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 p-10 flex flex-col justify-center">
                        <h4 className="text-lg font-bold text-slate-700 mb-4 text-center">
                            {t('common.customValue')}
                        </h4>
                        <input
                            type="text"
                            className="w-full p-4 text-2xl font-bold border-2 border-slate-200 rounded-2xl outline-none focus:border-emerald-500 text-center mb-8"
                            value={customValue}
                            onChange={e => setCustomValue(e.target.value)}
                            placeholder={t('common.typeHere')}
                        />
                        <div className="flex gap-4">
                            <Button variant="secondary" onClick={() => setIsAddingCustom(false)} className="flex-1 justify-center">
                                {t('common.back')}
                            </Button>
                            <Button onClick={() => onSelect(customValue)} className="flex-1 justify-center">
                                {t('common.confirm')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
