import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity, ArrowUpRight, ChevronRight, Gift, LineChart, PiggyBank, Receipt, TrendingDown, TrendingUp,
} from 'lucide-react';
import { DashboardArea } from './DashboardArea';
import { formatCurrencyAmount, getCategoryLabel, wishlistPriceInDefault } from '../utils/dashboardUtils';
import { computePortfolioInsight, computeSpendingInsights } from '../utils/statusInsights';
import { usePortfolioStatus } from '../hooks/usePortfolioStatus';
import { useFx } from '../../../lib/fx/useFx';

/** Wraps text in Unicode isolates so amounts keep their own direction inside a Hebrew sentence. */
const isolate = (text) => `⁨${text}⁩`;

const TONES = {
  good: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  bad: 'text-rose-700 bg-rose-50 border-rose-200/80',
  neutral: 'text-slate-600 bg-slate-50 border-slate-200/80',
};

/** A small up/down chip, e.g. "▲ 3.2%". `good` says whether going up is a good thing. */
const TrendChip = ({ pct, upIsGood = true }) => {
  if (pct == null || !Number.isFinite(pct)) return null;
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
  const isUp = rounded > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const tone = rounded === 0 ? TONES.neutral : isUp === upIsGood ? TONES.good : TONES.bad;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${tone}`} dir="ltr">
      {rounded !== 0 && <Icon className="w-2.5 h-2.5" />}
      {rounded > 0 ? '+' : ''}{rounded.toFixed(1)}%
    </span>
  );
};

/** One interesting fact: label, a headline value, a line of context and an optional trend chip. */
const StatusTile = ({ icon: Icon, iconColor, label, value, detail, chip, onClick, className = '' }) => {
  const isClickable = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      className={`min-w-0 p-2.5 rounded-xl border border-slate-100/90 bg-white flex flex-col gap-1 transition-all duration-200 group/tile ${
        isClickable ? 'cursor-pointer hover:border-slate-200 hover:shadow-2xs hover:bg-slate-50/60 active:scale-[0.99]' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${iconColor}`}>
            <Icon className="w-3 h-3" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate rtl:normal-case rtl:tracking-normal">{label}</span>
        </div>
        {isClickable && (
          <ChevronRight className="w-3 h-3 text-slate-300 group-hover/tile:text-slate-500 transition-colors shrink-0 rtl:rotate-180" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span dir="auto" className="text-sm sm:text-base font-extrabold text-slate-800 truncate leading-tight text-start">{value}</span>
        {chip}
      </div>
      {detail && <p dir="auto" className="text-[10px] sm:text-[11px] text-slate-500 font-medium line-clamp-2 text-start">{detail}</p>}
    </div>
  );
};

/**
 * DashboardStatusPanel
 * The dashboard's "Status": the amount saved up front, then a few live facts about the user's money -
 * where it goes (top category, month vs last month), what is left over (savings rate), how investments
 * are doing today (only when the user has holdings) and what the wishlist can afford.
 * Alerts and reminders live in the separate Notifications panel.
 */
export const DashboardStatusPanel = ({
  userId,
  expenses = [],
  income = [],
  wishlist = [],
  amount = 0,
  currency,
  subtitle,
  date = new Date(),
  onNavigateAnalytics,
  onNavigateWishlist,
  onNavigateInvestments,
  className = '',
  ...rest
}) => {
  const { t, i18n } = useTranslation();
  const { toDefault, defaultCurrency, dataVersion } = useFx();
  const money = currency || defaultCurrency;
  const fmt = (value) => formatCurrencyAmount(value, money, 0, i18n.language);

  const { holdings, quotes } = usePortfolioStatus(userId);

  /* dataVersion: exchange rates can finish loading after the first render */
  /* eslint-disable react-hooks/exhaustive-deps */
  const spending = useMemo(
    () => computeSpendingInsights({ expenses, income, toDefault }),
    [expenses, income, toDefault, dataVersion]
  );
  const portfolio = useMemo(
    () => computePortfolioInsight(holdings, quotes, toDefault, date),
    [holdings, quotes, toDefault, date, dataVersion]
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  // Each tile opens the analytics view that explains it
  const openAnalytics = (target) => (onNavigateAnalytics ? () => onNavigateAnalytics(target) : undefined);

  const tiles = [];

  // Where the money goes, over everything uploaded
  tiles.push(
    <StatusTile
      key="topCategory"
      icon={Receipt}
      iconColor="text-orange-600 bg-orange-50/90 border-orange-100"
      label={t('dashboard.mainDashboard.status.topCategory', 'Top category')}
      value={spending.topCategory ? getCategoryLabel(spending.topCategory.name, t) : '—'}
      detail={spending.topCategory
        ? t('dashboard.mainDashboard.status.topCategoryDetail', {
          amount: isolate(fmt(spending.topCategory.amount)),
          share: Math.round(spending.topCategory.share),
          defaultValue: '{{amount}} · {{share}}% of all spending',
        })
        : t('dashboard.mainDashboard.status.noExpenses', 'No expenses yet')}
      onClick={spending.topCategory ? openAnalytics({ view: 'trends', category: spending.topCategory.name }) : openAnalytics()}
    />
  );

  // Total spending
  tiles.push(
    <StatusTile
      key="totalSpent"
      icon={Activity}
      iconColor="text-blue-600 bg-blue-50/90 border-blue-100"
      label={t('dashboard.mainDashboard.status.totalSpent', 'Total spent')}
      value={spending.monthCount > 0 ? isolate(fmt(spending.spent)) : '—'}
      detail={spending.monthCount > 0
        ? t('dashboard.mainDashboard.status.perMonth', {
          amount: isolate(fmt(spending.spent / spending.monthCount)),
          defaultValue: 'About {{amount}} a month',
        })
        : t('dashboard.mainDashboard.status.noExpenses', 'No expenses yet')}
      onClick={openAnalytics({ view: 'reports' })}
    />
  );

  // What is left of everything earned
  tiles.push(
    <StatusTile
      key="savingsRate"
      icon={PiggyBank}
      iconColor="text-emerald-600 bg-emerald-50/90 border-emerald-100"
      label={t('dashboard.mainDashboard.status.savingsRate', 'Savings rate')}
      value={spending.savingsRate != null ? `${Math.round(spending.savingsRate)}%` : '—'}
      detail={spending.savingsRate != null
        ? t('dashboard.mainDashboard.status.savingsRateDetail', {
          saved: isolate(fmt(spending.income - spending.spent)),
          income: isolate(fmt(spending.income)),
          defaultValue: '{{saved}} kept of {{income}} earned',
        })
        : t('dashboard.mainDashboard.status.noIncome', 'No income uploaded yet')}
      onClick={openAnalytics({ view: 'reports' })}
    />
  );

  // Investments, only when the user has any
  if (portfolio.count > 0) {
    tiles.push(
      <StatusTile
        key="investments"
        icon={LineChart}
        iconColor="text-purple-600 bg-purple-50/90 border-purple-100"
        label={t('dashboard.mainDashboard.status.investments', 'Investments')}
        value={isolate(fmt(portfolio.value))}
        chip={<TrendChip pct={portfolio.monthChangePct} />}
        detail={portfolio.hasMonthData
          ? t('dashboard.mainDashboard.status.investmentsMonth', {
            amount: isolate(`${portfolio.monthChange >= 0 ? '+' : '−'}${fmt(Math.abs(portfolio.monthChange))}`),
            defaultValue: '{{amount}} this month',
          })
          : t('dashboard.mainDashboard.status.investmentsValue', 'Total portfolio value')}
        onClick={onNavigateInvestments}
      />
    );
  }

  // What the saved amount can buy
  const safeWishlist = Array.isArray(wishlist) ? wishlist : [];
  const affordable = safeWishlist.filter((item) => {
    const price = wishlistPriceInDefault(item, toDefault, defaultCurrency);
    return price != null && price > 0 && price <= amount;
  }).length;
  tiles.push(
    <StatusTile
      key="wishlist"
      icon={Gift}
      iconColor="text-pink-600 bg-pink-50/90 border-pink-100"
      label={t('dashboard.wishlist.title', 'Wish List')}
      value={safeWishlist.length === 0
        ? '—'
        : t('dashboard.mainDashboard.status.wishlistAffordable', { affordable, total: safeWishlist.length, defaultValue: '{{affordable}} of {{total}}' })}
      detail={safeWishlist.length === 0
        ? t('dashboard.mainDashboard.wishlistStatus.noItems', 'No wishlist items added yet')
        : t('dashboard.mainDashboard.status.wishlistDetail', 'items within budget')}
      onClick={onNavigateWishlist}
    />
  );

  const isNegative = Number(amount) < 0;

  return (
    <DashboardArea
      title={t('dashboard.mainDashboard.areas.status', 'Status')}
      subtitle={t('dashboard.mainDashboard.areas.statusSubtitle', 'Your money at a glance')}
      icon={Activity}
      iconColor="text-emerald-600 bg-emerald-50/90 border-emerald-100"
      className={className}
      {...rest}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] gap-3 h-full">
        {/* Amount saved: the headline number */}
        <div className="flex flex-col justify-between rounded-xl bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-100/80 p-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">
              <PiggyBank className="w-3 h-3" />
              {t('dashboard.mainDashboard.amountSaved', 'Amount Saved')}
            </div>
            <div className={`mt-1 text-3xl sm:text-4xl font-black tracking-tight ${isNegative ? 'text-red-600' : 'text-slate-900'}`}>
              <bdi>{fmt(amount)}</bdi>
            </div>
            {subtitle && <p className="text-xs text-slate-400 font-medium mt-1">{subtitle}</p>}
          </div>
          {onNavigateAnalytics && (
            <button
              type="button"
              onClick={() => onNavigateAnalytics()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline mt-3 self-start rounded-sm group/btn focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <span>{t('dashboard.mainDashboard.viewAnalytics', 'View analytics')}</span>
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 rtl:-scale-x-100" />
            </button>
          )}
        </div>

        {/* Live facts; an odd last tile takes the full row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          {tiles.map((tile, i) =>
            i === tiles.length - 1 && tiles.length % 2 === 1
              ? React.cloneElement(tile, { className: 'sm:col-span-2' })
              : tile
          )}
        </div>
      </div>
    </DashboardArea>
  );
};

export default DashboardStatusPanel;
