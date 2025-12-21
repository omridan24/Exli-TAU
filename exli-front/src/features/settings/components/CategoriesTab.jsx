import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CategoryIcon } from '../../../components/UI';
import { DEFAULT_CATEGORIES } from '../../../config/constants';

export const CategoriesTab = ({ customCategories, onOpenCategoryModal, onDeleteCategory }) => {
    return (
        <Card className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Categories</h2>
                <Button onClick={() => onOpenCategoryModal({ name: '', color: '#10b981', icon: 'Star', id: null })}><Plus className="w-4 h-4 mr-2" /> New</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[...DEFAULT_CATEGORIES, ...customCategories].map(cat => (
                    <div key={cat.id} className="p-4 rounded-2xl border flex items-center justify-between bg-white shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}><CategoryIcon iconName={cat.icon} className="w-5 h-5" color="white" /></div>
                            <span className="font-bold">{cat.name}</span>
                        </div>
                        {customCategories.some(c => c.id === cat.id) && (
                            <button onClick={() => onDeleteCategory(cat.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
};
