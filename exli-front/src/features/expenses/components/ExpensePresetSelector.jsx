import React from 'react';
import { useTranslation } from 'react-i18next';

const EXPENSE_PRESETS = [
    { name: 'Rent', key: 'rent', emoji: '🏠', category: 'Housing' },
    { name: 'Electricity', key: 'electricity', emoji: '⚡', category: 'Utilities' },
    { name: 'Water', key: 'water', emoji: '💧', category: 'Utilities' },
    { name: 'Internet', key: 'internet', emoji: '🌐', category: 'Utilities' },
    { name: 'Netflix', key: 'netflix', emoji: '📺', category: 'Entertainment' },
    { name: 'Phone Bill', key: 'phoneBill', emoji: '📱', category: 'Utilities' },
    { name: 'Car Insurance', key: 'carInsurance', emoji: '🚗', category: 'Insurance' },
    { name: 'Gym Membership', key: 'gymMembership', emoji: '🏋️', category: 'Health' },
    { name: 'Healthcare', key: 'healthcare', emoji: '💊', category: 'Health' },
    { name: 'Spotify', key: 'spotify', emoji: '🎵', category: 'Entertainment' },
    { name: 'iCloud Storage', key: 'icloud', emoji: '☁️', category: 'Technology' },
];

export const ExpensePresetSelector = ({ selectedName, onSelect }) => {
    const { t } = useTranslation();

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">{t('expenses.presets.expenseName')}</label>
            <div className="grid grid-cols-4 gap-3">
                {EXPENSE_PRESETS.map(preset => (
                    <button
                        key={preset.name}
                        type="button"
                        onClick={() => onSelect(preset.name, preset.category)}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${selectedName === preset.name
                            ? 'border-purple-500 bg-purple-50 shadow-md'
                            : 'border-slate-200 hover:border-purple-400 hover:bg-purple-50'
                            }`}
                    >
                        <div className="text-3xl">{preset.emoji}</div>
                        <div className="text-xs font-bold text-slate-700 text-center leading-tight">{t(`expenses.presets.${preset.key}`)}</div>
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => onSelect('custom', '')}
                    className={`p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center gap-2 ${selectedName === 'custom'
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                >
                    <div className="text-3xl">✏️</div>
                    <div className="text-xs font-bold text-slate-700">{t('expenses.presets.custom')}</div>
                </button>
            </div>
        </div>
    );
};
