import React, { useState } from 'react';
import { Edit2, Trash2, Calendar, Tag, ImageOff, Flame, Zap, Droplet, Share2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CategoryIcon } from '../../../components/UI';
import { DEFAULT_CATEGORIES } from '../../../config/constants';

export const getCurrencySymbol = (currency) => {
  switch (currency) {
    case 'ILS': return '₪';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: return currency || '₪';
  }
};

export const formatStoreUrl = (url) => {
  if (!url) return '';
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
};

export const WishlistCard = ({ item, categories = DEFAULT_CATEGORIES, onEdit, onDelete, onShare }) => {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);

  // Find category details
  const catDetails = categories.find(c => c.id === item.category) || 
                     DEFAULT_CATEGORIES.find(c => c.id === item.category) || 
                     { id: 'other', name: item.category || 'Other', color: '#64748b', icon: 'MoreHorizontal' };

  // Translate category name if available
  const getCategoryLabel = () => {
    const translationKey = `categories.${catDetails.id}`;
    const translated = t(translationKey);
    return translated !== translationKey ? translated : (catDetails.name || item.category);
  };

  // Importance config
  const getImportanceBadge = (importance) => {
    switch (importance) {
      case 'high':
        return {
          label: t('wishlist.importanceLevels.high'),
          className: 'bg-rose-50 text-rose-700 border-rose-200/80',
          icon: Flame
        };
      case 'low':
        return {
          label: t('wishlist.importanceLevels.low'),
          className: 'bg-slate-100 text-slate-600 border-slate-200',
          icon: Droplet
        };
      case 'medium':
      default:
        return {
          label: t('wishlist.importanceLevels.medium'),
          className: 'bg-amber-50 text-amber-700 border-amber-200/80',
          icon: Zap
        };
    }
  };

  const importanceInfo = getImportanceBadge(item.importance);
  const ImportanceIcon = importanceInfo.icon;

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="group relative flex flex-col overflow-hidden bg-white border-slate-200/70 hover:border-pink-300 hover:shadow-lg transition-all duration-300">
      {/* Top Banner / Image */}
      <div className="relative w-full h-44 bg-slate-100 overflow-hidden flex items-center justify-center border-b border-slate-100">
        {item.imageUrl && !imgError ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-50 to-pink-50/40 flex flex-col items-center justify-center p-4 text-slate-300">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs mb-1"
              style={{ backgroundColor: `${catDetails.color}15`, color: catDetails.color }}
            >
              <CategoryIcon iconName={catDetails.icon} className="w-7 h-7" color={catDetails.color} />
            </div>
            {!item.imageUrl && (
              <span className="text-xs text-slate-400 font-medium mt-1">{getCategoryLabel()}</span>
            )}
            {item.imageUrl && imgError && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                <ImageOff className="w-3.5 h-3.5" />
                <span>{t('wishlist.imageUnavailable')}</span>
              </div>
            )}
          </div>
        )}

        {/* Importance Badge (Top Right) */}
        <div className="absolute top-3 end-3 z-10">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-sm shadow-xs ${importanceInfo.className}`}>
            <ImportanceIcon className="w-3 h-3" />
            {importanceInfo.label}
          </span>
        </div>

        {/* Category Logo Pill (Top Left) */}
        <div className="absolute top-3 start-3 z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 text-slate-700 shadow-sm border border-slate-200/60 backdrop-blur-xs">
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: catDetails.color }}>
              <CategoryIcon iconName={catDetails.icon} className="w-2.5 h-2.5" color="white" />
            </div>
            <span>{getCategoryLabel()}</span>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4 text-start">
        <div className="space-y-2">
          {/* Title & Price */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-slate-800 text-lg line-clamp-2 group-hover:text-pink-600 transition-colors">
              {item.name}
            </h3>
            <div className="text-end shrink-0">
              <div className="text-xl font-extrabold text-slate-900 font-mono">
                <span className="text-pink-600 me-0.5">{getCurrencySymbol(item.currency)}</span>
                {Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{item.currency || 'ILS'}</span>
            </div>
          </div>

          {/* Date Added */}
          {item.dateAdded && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{t('wishlist.addedOn', { date: formatDate(item.dateAdded) })}</span>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <p className="text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 line-clamp-3 leading-relaxed mt-2">
              {item.description}
            </p>
          )}

          {/* Online Store Link */}
          {item.storeUrl && (
            <div className="pt-0.5">
              <a
                href={formatStoreUrl(item.storeUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600 hover:text-pink-700 hover:underline transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t('wishlist.visitStore')}</span>
              </a>
            </div>
          )}
        </div>

        {/* Card Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Tag className="w-3.5 h-3.5" />
            <span className="truncate max-w-[120px]">{getCategoryLabel()}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onShare && onShare(item)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-pink-600 hover:bg-pink-50 transition-colors"
              title={t('wishlist.shareItem')}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-pink-600 hover:bg-pink-50 transition-colors"
              title={t('wishlist.editItem')}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title={t('wishlist.deleteItem')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
};
