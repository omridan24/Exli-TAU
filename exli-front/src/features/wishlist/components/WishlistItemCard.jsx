import React from 'react';
import { Tag, Calendar, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const WishlistItemCard = ({ item }) => {
  const { t } = useTranslation();

  const progressPercent = Math.min(
    100,
    Math.round((item.savedAmount / item.estimatedPrice) * 100)
  );

  const priorityColors = {
    high: 'bg-rose-100 text-rose-700 border-rose-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg mb-2">
              <Tag className="w-3 h-3" />
              {item.category}
            </span>
            <h3 className="font-bold text-lg text-slate-800 group-hover:text-pink-600 transition-colors">
              {item.title}
            </h3>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              priorityColors[item.priority] || priorityColors.medium
            }`}
          >
            {t(`wishlist.priority.${item.priority}`)}
          </span>
        </div>

        <div className="my-4">
          <div className="flex justify-between items-baseline text-sm mb-1.5">
            <span className="text-slate-500 font-medium">{t('wishlist.stats.savedAmount')}</span>
            <span className="font-bold text-slate-800">
              ₪{item.savedAmount.toLocaleString()} / ₪{item.estimatedPrice.toLocaleString()}
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400 mt-1 font-mono">
            <span>{progressPercent}% completed</span>
            {item.targetDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {item.targetDate}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">Sample Preview</span>
        <button
          onClick={() => alert(`This is a placeholder for editing '${item.title}'`)}
          className="text-xs font-bold text-slate-500 hover:text-pink-600 flex items-center gap-1 transition-colors"
        >
          <CheckCircle2 className="w-4 h-4 text-slate-400" />
          <span>Details</span>
        </button>
      </div>
    </div>
  );
};
