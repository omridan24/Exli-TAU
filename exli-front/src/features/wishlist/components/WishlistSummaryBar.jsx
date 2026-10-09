import React from 'react';
import { Search, Filter, Layers, Flame, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_CATEGORIES } from '../../../config/constants';
import { getCurrencySymbol } from './WishlistCard';
import { useFx } from '../../../lib/fx/useFx';
import { Money } from '../../../components/Money';

export const WishlistSummaryBar = ({
  items = [],
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedImportance,
  setSelectedImportance,
  categories = DEFAULT_CATEGORIES
}) => {
  const { t } = useTranslation();
  const { sum, defaultCurrency } = useFx();

  // Calculate totals grouped by currency (the honest per-currency view, kept
  // alongside the converted total below - docs/fx/01-fx-plan.md §7)
  const currencyTotals = items.reduce((acc, item) => {
    const curr = item.currency || 'ILS';
    const val = Number(item.price || 0);
    acc[curr] = (acc[curr] || 0) + val;
    return acc;
  }, {});

  const totalCurrenciesList = Object.entries(currencyTotals);

  // One combined total in the default currency, at the LATEST rate (these
  // are future purchases, not past transactions - same reasoning as the
  // per-item conversion in WishlistModal).
  const { value: combinedTotal, excluded } = sum(
    items.map((item) => ({ amount: Number(item.price || 0), currency: item.currency || 'ILS' }))
  );
  const showCombinedTotal = totalCurrenciesList.length > 1;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-5 shadow-xs mb-6 space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('wishlist.searchPlaceholder', 'Search items by name, store, or notes...')}
            className="w-full start-0 ps-10 pe-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-pink-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 md:pb-0">
          {/* Category Filter */}
          <div className="relative shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none ps-9 pe-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold outline-none focus:border-pink-500 transition-all cursor-pointer"
            >
              <option value="all">{t('wishlist.filterCategory', 'All Categories')}</option>
              {categories.map((cat) => {
                const translationKey = `categories.${cat.id}`;
                const translatedName = t(translationKey);
                const displayName = translatedName !== translationKey ? translatedName : cat.name;
                return (
                  <option key={cat.id} value={cat.id}>
                    {displayName}
                  </option>
                );
              })}
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Importance Filter */}
          <div className="relative shrink-0">
            <select
              value={selectedImportance}
              onChange={(e) => setSelectedImportance(e.target.value)}
              className="appearance-none ps-9 pe-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold outline-none focus:border-pink-500 transition-all cursor-pointer"
            >
              <option value="all">{t('wishlist.filterImportance', 'All Importance')}</option>
              <option value="high">🔥 {t('wishlist.importanceLevels.high', 'High')}</option>
              <option value="medium">⚡ {t('wishlist.importanceLevels.medium', 'Medium')}</option>
              <option value="low">💧 {t('wishlist.importanceLevels.low', 'Low')}</option>
            </select>
            <Flame className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stats / Total Summary */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <Layers className="w-4 h-4 text-pink-500" />
          <span>{t('wishlist.totalItems', { count: items.length, defaultValue: `${items.length} Items` })}</span>
        </div>

        {/* Total Value Summary per currency, plus one converted grand total
            when there's more than one currency to add together */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 font-medium">{t('wishlist.totalValue', 'Total Estimated Value')}:</span>
          {showCombinedTotal && (
            <span className="px-2.5 py-1 rounded-lg bg-pink-600 text-white font-bold font-mono text-xs">
              <Money amount={combinedTotal} currency={defaultCurrency} />
              {excluded.length > 0 && <span className="ms-1 opacity-75">({t('analytics.excludedFromTotals', { count: excluded.length })})</span>}
            </span>
          )}
          {totalCurrenciesList.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              {totalCurrenciesList.map(([curr, total]) => (
                <span
                  key={curr}
                  className="px-2.5 py-1 rounded-lg bg-pink-50 text-pink-700 font-bold font-mono border border-pink-100 text-xs"
                >
                  {getCurrencySymbol(curr)} {total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 font-bold font-mono">₪0</span>
          )}
        </div>
      </div>
    </div>
  );
};
