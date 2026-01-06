import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, CategoryIcon } from '../../../components/UI';

const ICON_OPTIONS = [
    "Star", "Zap", "HeartPulse", "Car", "ShoppingCart", "Utensils", "ShoppingBag",
    "Home", "Ticket", "Briefcase", "Gift", "Plane", "Coffee", "Wifi", "GraduationCap", "PawPrint", "HelpCircle"
];

const COLORS = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];

export const CategoryEditorModal = ({ category, onClose, onSave }) => {
    const { t } = useTranslation();
    const [data, setData] = useState(category);

    useEffect(() => {
        setData(category);
    }, [category]);

    if (!category) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[140] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800">
                        {data.id ? t('categoryEditor.editCategory') : t('categoryEditor.newCategory')}
                    </h3>
                    <button onClick={onClose}><X className="text-slate-400" /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                            {t('categoryEditor.name')}
                        </label>
                        <input
                            type="text"
                            value={data.name}
                            onChange={e => setData({ ...data, name: e.target.value })}
                            className="w-full p-3 border rounded-xl font-bold outline-none focus:border-emerald-500"
                            placeholder={t('categoryEditor.namePlaceholder')}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                            {t('categoryEditor.color')}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setData({ ...data, color: c })}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${data.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                            {t('categoryEditor.icon')}
                        </label>
                        <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
                            {ICON_OPTIONS.map(icon => (
                                <button
                                    key={icon}
                                    onClick={() => setData({ ...data, icon })}
                                    className={`p-2 rounded-lg flex items-center justify-center border transition-all ${data.icon === icon ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'border-slate-100 hover:bg-slate-50'}`}
                                >
                                    <CategoryIcon iconName={icon} className="w-5 h-5" />
                                </button>
                            ))}
                        </div>
                    </div>
                    <Button onClick={() => onSave(data)} disabled={!data.name} className="w-full justify-center">
                        <Check className="w-4 h-4 me-2" /> {t('categoryEditor.saveCategory')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
