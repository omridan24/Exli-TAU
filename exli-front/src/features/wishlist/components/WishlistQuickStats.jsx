import React from 'react';
import { Target, DollarSign, PiggyBank, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const WishlistQuickStats = ({ stats }) => {
  const { t } = useTranslation();

  const statItems = [
    {
      id: 'totalItems',
      label: t('wishlist.stats.totalItems'),
      value: stats.totalItems,
      icon: Target,
      color: 'bg-pink-100 text-pink-600',
    },
    {
      id: 'totalValue',
      label: t('wishlist.stats.totalValue'),
      value: `₪${stats.totalValue.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      id: 'savedAmount',
      label: t('wishlist.stats.savedAmount'),
      value: `₪${stats.savedAmount.toLocaleString()}`,
      icon: PiggyBank,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      id: 'highPriority',
      label: t('wishlist.stats.highPriority'),
      value: stats.highPriority,
      icon: Flame,
      color: 'bg-amber-100 text-amber-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {item.label}
              </p>
              <h4 className="text-xl font-extrabold text-slate-800 mt-0.5">
                {item.value}
              </h4>
            </div>
          </div>
        );
      })}
    </div>
  );
};
