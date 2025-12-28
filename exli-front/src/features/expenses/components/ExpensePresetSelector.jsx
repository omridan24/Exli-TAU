import React from 'react';

const EXPENSE_PRESETS = [
    { name: 'Rent', emoji: '🏠', category: 'Housing' },
    { name: 'Electricity', emoji: '⚡', category: 'Utilities' },
    { name: 'Water', emoji: '💧', category: 'Utilities' }, { name: 'Internet', emoji: '🌐', category: 'Utilities' },
    { name: 'Netflix', emoji: '📺', category: 'Entertainment' },
    { name: 'Phone Bill', emoji: '📱', category: 'Utilities' },
    { name: 'Car Insurance', emoji: '🚗', category: 'Insurance' },
    { name: 'Gym Membership', emoji: '🏋️', category: 'Health' },
    { name: 'Healthcare', emoji: '💊', category: 'Health' },
    { name: 'Spotify', emoji: '🎵', category: 'Entertainment' },
    { name: 'iCloud Storage', emoji: '☁️', category: 'Technology' },
];

export const ExpensePresetSelector = ({ selectedName, onSelect }) => {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Expense Name *</label>
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
                        <div className="text-xs font-bold text-slate-700 text-center leading-tight">{preset.name}</div>
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
                    <div className="text-xs font-bold text-slate-700">Custom</div>
                </button>
            </div>
        </div>
    );
};
