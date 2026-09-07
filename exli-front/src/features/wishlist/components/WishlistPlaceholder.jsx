import React from 'react';
import { Sparkles, Tag, PiggyBank, Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/UI';

export const WishlistPlaceholder = () => {
  const { t } = useTranslation();

  const teasers = [
    {
      icon: Tag,
      color: 'bg-pink-50 text-pink-600 border-pink-100',
      title: t('dashboard.wishlist.placeholder.featureTeasers.tracking'),
      desc: t('dashboard.wishlist.placeholder.featureTeasers.trackingDesc')
    },
    {
      icon: PiggyBank,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      title: t('dashboard.wishlist.placeholder.featureTeasers.savings'),
      desc: t('dashboard.wishlist.placeholder.featureTeasers.savingsDesc')
    },
    {
      icon: Calculator,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      title: t('dashboard.wishlist.placeholder.featureTeasers.smartBudget'),
      desc: t('dashboard.wishlist.placeholder.featureTeasers.smartBudgetDesc')
    }
  ];

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 animate-fade-in text-start">
      {/* Hero Teaser Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-pink-50 via-purple-50 to-slate-50 border border-pink-100/60 rounded-3xl p-8 text-center sm:text-start flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-pink-100/80 text-pink-700 rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('dashboard.wishlist.placeholder.badge')}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            {t('dashboard.wishlist.placeholder.title')}
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            {t('dashboard.wishlist.placeholder.description')}
          </p>
        </div>
      </div>

      {/* Feature Teasers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {teasers.map((teaser, idx) => {
          const Icon = teaser.icon;
          return (
            <Card key={idx} className="p-6 flex flex-col justify-between border-slate-100 hover:border-slate-200 transition-all">
              <div>
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${teaser.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-800 text-base mb-1.5">{teaser.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{teaser.desc}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
