import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Scale, CheckCircle2 } from 'lucide-react';
import { useFx } from '../../../lib/fx/useFx';
import { getMinorUnits } from '../../../lib/fx/currencyMeta';
import { formatMinorAmount } from '../utils/money';
import { ledgersOf } from '../utils/ledgers';
import { expenseCurrency } from '../utils/groupStats';

/**
 * Top of the group page: how much people owe ME, how much I owe others, and the net of both.
 * Real totals per currency, plus one combined figure in the user's default currency (approximate, at
 * the latest rate - nothing is stored). A single-currency group in the default currency shows no
 * conversion at all.
 */
export const BalanceSummary = ({ group, userId, expenses }) => {
  const { t } = useTranslation();
  const { toDefault, defaultCurrency, dataVersion } = useFx();

  const summary = useMemo(() => {
    // my balance in each currency the group holds
    const mine = ledgersOf(group)
      .map(([currency, balances]) => ({ currency, amount: (balances || {})[userId] || 0 }))
      .filter((m) => m.amount !== 0);

    const toDefaultMinor = (currency, amountMinor) => {
      if (currency === defaultCurrency) return amountMinor;
      const r = toDefault({ amount: amountMinor / 10 ** getMinorUnits(currency), currency });
      return r.value == null ? null : Math.round(r.value * 10 ** getMinorUnits(defaultCurrency));
    };

    const side = (items) => {
      const sorted = [...items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      const needsConversion = sorted.some((i) => i.currency !== defaultCurrency);
      let total = 0;
      let missing = 0;
      for (const i of sorted) {
        const v = toDefaultMinor(i.currency, Math.abs(i.amount));
        if (v == null) missing += 1; else total += v;
      }
      return { items: sorted, total, missing, needsConversion };
    };

    const owed = side(mine.filter((m) => m.amount > 0));
    const owe = side(mine.filter((m) => m.amount < 0));
    const net = owed.total - owe.total;

    // total spent: per currency, plus one combined figure when the group holds several
    const spent = {};
    for (const e of expenses) {
      const c = expenseCurrency(e, group);
      spent[c] = (spent[c] || 0) + (e.amountMinor || 0);
    }
    const spentItems = Object.entries(spent).sort((a, b) => b[1] - a[1]).map(([currency, amount]) => ({ currency, amount }));
    const spentConverted = spentItems.length > 1 || (spentItems[0] && spentItems[0].currency !== defaultCurrency)
      ? spentItems.reduce((sum, i) => {
        const v = toDefaultMinor(i.currency, i.amount);
        return v == null || sum == null ? null : sum + v;
      }, 0)
      : null;
    return { spentItems, spentConverted, owed, owe, net, hasAny: mine.length > 0, multi: owed.items.length + owe.items.length > 0 && (owed.needsConversion || owe.needsConversion) };
    // dataVersion: rates may finish loading after the first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, userId, expenses, defaultCurrency, toDefault, dataVersion]);

  const Side = ({ icon: Icon, label, data, tone }) => (
    <div className="flex-1 min-w-[9rem] text-center sm:text-start">
      <div className={`flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold uppercase tracking-wider ${tone.label}`}>
        <Icon className="w-4 h-4" /> {label}
      </div>
      {data.items.length === 0 ? (
        <p className="text-2xl font-extrabold text-slate-300 mt-1">{formatMinorAmount(0, defaultCurrency)}</p>
      ) : (
        <>
          <p className={`text-2xl font-extrabold mt-1 ${tone.value}`}>
            {data.needsConversion && '≈ '}{formatMinorAmount(data.total, defaultCurrency)}
          </p>
          {data.needsConversion && (
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {data.items.map((i) => formatMinorAmount(Math.abs(i.amount), i.currency)).join(' · ')}
            </p>
          )}
          {data.missing > 0 && <p className="text-[11px] text-amber-600 font-medium mt-0.5">{t('groups.page.summaryMissingRate', { count: data.missing })}</p>}
        </>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      {summary.hasAny ? (
        <div className="flex flex-wrap items-start justify-center sm:justify-between gap-x-8 gap-y-5">
          <Side icon={ArrowDownLeft} label={t('groups.page.summaryOwedToYou')} data={summary.owed}
            tone={{ label: 'text-emerald-600', value: 'text-emerald-600' }} />
          <Side icon={ArrowUpRight} label={t('groups.page.summaryYouOwe')} data={summary.owe}
            tone={{ label: 'text-rose-500', value: 'text-rose-500' }} />
          {summary.owed.items.length > 0 && summary.owe.items.length > 0 && (
            <div className="flex-1 min-w-[9rem] text-center sm:text-start">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Scale className="w-4 h-4" /> {t('groups.page.summaryNet')}
              </div>
              <p className={`text-2xl font-extrabold mt-1 ${summary.net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {'≈ '}{summary.net < 0 ? '-' : ''}{formatMinorAmount(Math.abs(summary.net), defaultCurrency)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 text-lg font-bold text-slate-400">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" /> {t('groups.page.allSettled')}
        </p>
      )}
      {summary.spentItems.length > 0 && (
        <p className="text-center sm:text-start text-sm font-medium text-slate-500 mt-5 pt-4 border-t border-slate-50">
          {t('groups.page.totalExpenses', { amount: summary.spentItems.map((i) => formatMinorAmount(i.amount, i.currency)).join(' · ') })}
          {summary.spentConverted != null && summary.spentItems.length > 1 && (
            <span className="text-slate-400"> {'≈ '}{formatMinorAmount(summary.spentConverted, defaultCurrency)}</span>
          )}
        </p>
      )}
    </div>
  );
};

export default BalanceSummary;
