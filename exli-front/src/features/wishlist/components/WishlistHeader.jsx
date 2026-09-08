import React from 'react';
import { Gift, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/UI';

export const WishlistHeader = ({ onAddItem }) => {
  const { t } = useTranslation();

  return (
    <div className="p-6 md:p-8 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-600 shrink-0 shadow-xs">
          <Gift className="w-6 h-6" />
        </div>
        <div className="text-start">
          <h1 className="text-2xl font-bold text-slate-800">{t('dashboard.wishlist.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('dashboard.wishlist.subtitle')}</p>
        </div>
      </div>

      {onAddItem && (
        <Button
          onClick={onAddItem}
          className="bg-pink-600 hover:bg-pink-700 text-white shadow-pink-200/80 shrink-0"
        >
          <Plus className="w-4 h-4 me-1" />
          <span>{t('wishlist.addItem')}</span>
        </Button>
      )}
    </div>
  );
};
