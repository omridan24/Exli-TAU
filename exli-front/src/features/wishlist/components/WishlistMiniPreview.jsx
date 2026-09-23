import React from 'react';
import { CategoryIcon } from '../../../components/UI';
import { DEFAULT_CATEGORIES } from '../../../config/constants';
import { getCurrencySymbol } from './WishlistCard';
import { StoreLink } from './StoreLink';

export const WishlistMiniPreview = ({
  item,
  categories = DEFAULT_CATEGORIES,
  className = ''
}) => {
  if (!item) return null;

  const catDetails =
    categories.find((c) => c.id === item.category) ||
    DEFAULT_CATEGORIES.find((c) => c.id === item.category) || {
      id: 'other',
      name: item.category || 'Other',
      color: '#ec4899',
      icon: 'Gift'
    };

  return (
    <div className={`flex items-center justify-between p-3.5 bg-slate-50/90 rounded-2xl border border-slate-100 gap-3 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200/60"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${catDetails.color}15`, color: catDetails.color }}
          >
            <CategoryIcon iconName={catDetails.icon} className="w-6 h-6" color={catDetails.color} />
          </div>
        )}
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-800 truncate">
            {item.name}
          </h4>
          <span className="text-[11px] text-slate-500 block truncate">
            {catDetails.name || item.category}
          </span>
          <StoreLink
            url={item.storeUrl}
            textSize="text-[11px]"
            iconSize="w-3 h-3"
            className="mt-0.5"
          />
        </div>
      </div>

      <div className="text-end shrink-0 ps-2">
        <div className="text-base font-extrabold text-slate-900 font-mono">
          <span className="text-pink-600 me-0.5">{getCurrencySymbol(item.currency)}</span>
          {Number(item.price || 0).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
          })}
        </div>
        <span className="text-[10px] text-slate-400 uppercase font-semibold">
          {item.currency || 'ILS'}
        </span>
      </div>
    </div>
  );
};
