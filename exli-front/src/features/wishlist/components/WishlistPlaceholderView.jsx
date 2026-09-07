import React from 'react';
import { Calendar, TrendingDown, Sliders, Info, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const WishlistPlaceholderView = () => {
  const { t } = useTranslation();

  const upcomingFeatures = [
    {
      id: 'targetDate',
      title: t('wishlist.upcomingFeatures.targetDate'),
      description: t('wishlist.upcomingFeatures.targetDateDesc'),
      icon: Calendar,
      accent: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    {
      id: 'priceTracker',
      title: t('wishlist.upcomingFeatures.priceTracker'),
      description: t('wishlist.upcomingFeatures.priceTrackerDesc'),
      icon: TrendingDown,
      accent: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      id: 'smartPriority',
      title: t('wishlist.upcomingFeatures.smartPriority'),
      description: t('wishlist.upcomingFeatures.smartPriorityDesc'),
      icon: Sliders,
      accent: 'bg-purple-50 text-purple-600 border-purple-100',
    },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 md:p-8 mt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {t('wishlist.upcomingFeatures.title')}
          </h2>
          <p className="text-slate-500 text-sm">
            {t('wishlist.placeholderNotice')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {upcomingFeatures.map((feat) => {
          const IconComponent = feat.icon;
          return (
            <div
              key={feat.id}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${feat.accent}`}
                >
                  <IconComponent className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-base mb-2">
                  {feat.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {feat.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full">
                  Planned Module
                </span>
                <Info className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
