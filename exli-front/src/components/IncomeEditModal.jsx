import React, { useState } from 'react';
import { X, Briefcase } from 'lucide-react';

export const IncomeEditModal = ({ isOpen, onClose, onSave, income }) => {
    const [formData, setFormData] = useState({
        source_name: income?.source_name || '',
        bruto: income?.bruto || '',
        neto: income?.neto || '',
        taxes: income?.taxes || '',
        pension: income?.pension || 0
    });

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(income.id, formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-emerald-500" />
                        <h3 className="font-bold text-slate-800">Edit Income</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Source Name</label>
                        <input
                            type="text"
                            value={formData.source_name}
                            onChange={(e) => setFormData({ ...formData, source_name: e.target.value })}
                            className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-emerald-400 transition-colors font-bold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gross (Bruto)</label>
                            <input
                                type="number"
                                value={formData.bruto}
                                onChange={(e) => setFormData({ ...formData, bruto: e.target.value })}
                                className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-emerald-400 transition-colors font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Net (Neto)</label>
                            <input
                                type="number"
                                value={formData.neto}
                                onChange={(e) => setFormData({ ...formData, neto: e.target.value })}
                                className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-emerald-400 transition-colors font-mono font-bold text-emerald-600"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Taxes</label>
                            <input
                                type="number"
                                value={formData.taxes}
                                onChange={(e) => setFormData({ ...formData, taxes: e.target.value })}
                                className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-red-400 transition-colors font-mono text-red-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pension</label>
                            <input
                                type="number"
                                value={formData.pension}
                                onChange={(e) => setFormData({ ...formData, pension: e.target.value })}
                                className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-emerald-400 transition-colors font-mono"
                            />
                        </div>
                    </div>
                </div>
                <div className="p-6 pt-0 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-xl font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
