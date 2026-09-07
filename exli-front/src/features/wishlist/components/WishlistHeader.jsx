import React from 'react';
import { Gift, Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const WishlistHeader = ({ onAddClick }) => {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-pink-500/10 via-rose-50 to-slate-50 border border-pink-100 rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-pink-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
            <Gift className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                {t('wishlist.title')}
              </h1>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 bg-pink-100 text-pink-700 rounded-full border border-pink-200">
                <Sparkles className="w-3 h-3" />
                {t('wishlist.badge')}
              </span>
            </div>
            <p className="text-slate-600 max-w-2xl text-sm md:text-base leading-relaxed">
              {t('wishlist.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={onAddClick}
          className="self-start md:self-auto px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-md shadow-pink-600/20 transition-all transform active:scale-95 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>{t('wishlist.addWish')}</span>
        </button>
      </div>

      {/* Decorative accent background shapes */}
      <div className="absolute -bottom-10 -end-10 w-48 h-48 bg-pink-200/30 rounded-full blur-2xl pointer-events-none" />
    </div>
  );
};
