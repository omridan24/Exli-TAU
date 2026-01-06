import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Card, CategoryIcon } from '../../../components/UI';
import { DEFAULT_CATEGORIES } from '../../../config/constants';

// Mapping from category IDs to translation keys
const categoryKeyMap = {
    'food': 'food',
    'groceries': 'groceries',
    'transport': 'transport',
    'shopping': 'shopping',
    'housing': 'housing',
    'bills': 'bills',
    'travel': 'travel',
    'health': 'health',
    'education': 'education',
    'pets': 'pets',
    'gifts': 'gifts',
    'entertainment': 'entertainment',
    'other': 'other'
};

export const CategoriesTab = ({ customCategories, onOpenCategoryModal, onDeleteCategory }) => {
    const { t } = useTranslation();

    // Get translated name for a category
    const getCategoryName = (cat) => {
        const key = categoryKeyMap[cat.id];
        if (key) {
            return t(`categories.${key}`);
        }
        return cat.name; // Return original name for custom categories
    };

    return (
        <Card className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('settings.categories.title')}</h2>
                <Button onClick={() => onOpenCategoryModal({ name: '', color: '#10b981', icon: 'Star', id: null })}>
                    <Plus className="w-4 h-4 me-2" /> {t('settings.categories.new')}
                </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[...DEFAULT_CATEGORIES, ...customCategories].map(cat => (
                    <div key={cat.id} className="p-4 rounded-2xl border flex items-center justify-between bg-white shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}>
                                <CategoryIcon iconName={cat.icon} className="w-5 h-5" color="white" />
                            </div>
                            <span className="font-bold">{getCategoryName(cat)}</span>
                        </div>
                        {customCategories.some(c => c.id === cat.id) && (
                            <button onClick={() => onDeleteCategory(cat.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
};
