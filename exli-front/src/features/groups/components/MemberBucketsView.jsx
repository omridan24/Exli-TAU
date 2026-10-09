import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMinorAmount } from '../utils/money';
import { getCurrencySettings } from '../utils/currencySettings';

// Tailwind's emerald-400 / emerald-800 hex values - needed as literal colors
// for the diagonal hatch pattern below, which a Tailwind class can't express.
const PAID_COLOR = '#34d399';
const OWED_COLOR = '#065f46';

const hatchStyle = (color) => ({
  backgroundImage: `repeating-linear-gradient(135deg, ${color}, ${color} 3px, transparent 3px, transparent 7px)`,
});

/** One value tag next to a bucket, vertically placed at the height that value reaches, with a tick to the bucket. */
const Tag = ({ pct, caption, amount, tone, side }) => (
  <div
    className={`absolute flex items-center gap-1.5 ${side === 'start' ? 'flex-row-reverse text-end' : 'text-start'} ${tone.text}`}
    // clamp keeps the tag inside the bucket's height even for a value at 0% or 100%
    style={{ bottom: `clamp(0px, calc(${pct}% - 15px), calc(100% - 30px))`, [side === 'start' ? 'insetInlineEnd' : 'insetInlineStart']: 0 }}
  >
    <span className={`h-px w-3 shrink-0 ${tone.line}`} />
    <span className="leading-tight">
      <span className="block text-[10px] font-bold uppercase tracking-wide opacity-70">{caption}</span>
      <span className="block text-sm font-extrabold whitespace-nowrap">{amount}</span>
    </span>
  </div>
);

/**
 * "Who Paid What": one big bucket per member - a single bar showing paid vs should-pay-by-splits as two tones
 * of the same bar: solid up to whichever of the two is SMALLER (in that metric's own color), then a hatched
 * region up to the BIGGER one (in the bigger metric's color) - the hatch is the gap itself: still owed, or
 * overpaid. "Should pay" sits on one side of the bucket and "Paid" on the other (start/end, so it mirrors in
 * Hebrew), each at the height it reaches; the verdict sits below. A legend above explains the colors.
 *
 * Paid/owed totals are derived client-side from the already-loaded `expenses` (each stores its computed
 * `shares: {uid: amountMinor}`), not from `group.balances`, which only carries the net.
 *
 * Every expense passed in here MUST already be in one common currency - a `keep_original` group
 * (docs/fx/01-fx-plan.md §6) renders one of these PER currency.
 */
const BucketsForCurrency = ({ group, expenses, currency, title }) => {
  const { t } = useTranslation();

  const rows = useMemo(() => {
    const activeMembers = Object.entries(group.members || {}).filter(([, m]) => m.status === 'active');
    const totals = Object.fromEntries(activeMembers.map(([uid]) => [uid, { paid: 0, owed: 0 }]));

    for (const expense of expenses) {
      if (totals[expense.paidBy]) totals[expense.paidBy].paid += expense.amountMinor;
      for (const [uid, share] of Object.entries(expense.shares || {})) {
        if (totals[uid]) totals[uid].owed += share;
      }
    }

    return activeMembers
      .map(([uid, member]) => ({ uid, displayName: member.displayName, ...totals[uid] }))
      .sort((a, b) => (a.paid - a.owed) - (b.paid - b.owed)); // furthest behind first
  }, [group.members, expenses]);

  const scaleMax = Math.max(1, ...rows.flatMap((r) => [r.paid, r.owed]));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h2 className="font-bold text-slate-800 mb-3">{title || t('groups.page.bucketsTab')}</h2>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-slate-50 rounded-xl px-4 py-3 mb-8 text-xs font-medium text-slate-500">
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-emerald-400" /> {t('groups.page.buckets.legendPaid')}
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-emerald-800" /> {t('groups.page.buckets.legendShouldPay')}
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded border border-slate-300" style={hatchStyle('#94a3b8')} /> {t('groups.page.buckets.legendGap')}
        </span>
      </div>

      <div className="flex flex-wrap justify-center gap-x-14 gap-y-12">
        {rows.map(({ uid, displayName, paid, owed }) => {
          const paidPct = (paid / scaleMax) * 100;
          const owedPct = (owed / scaleMax) * 100;
          const minPct = Math.min(paidPct, owedPct);
          const maxPct = Math.max(paidPct, owedPct);
          const isPaidBigger = paidPct >= owedPct;
          const delta = paid - owed;

          return (
            <div key={uid} className="flex flex-col items-center">
              <div className="flex items-stretch gap-2">
                {/* start side: what they should pay */}
                <div className="relative h-56 w-28 shrink-0">
                  <Tag
                    side="start" pct={owedPct} caption={t('groups.page.buckets.shouldPay')}
                    amount={formatMinorAmount(owed, currency)} tone={{ text: 'text-emerald-800', line: 'bg-emerald-800' }}
                  />
                </div>

                <div className="relative w-20 h-56 rounded-2xl border-2 border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                  {/* Solid: the smaller of the two, in its own color */}
                  <div
                    className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${isPaidBigger ? 'bg-emerald-800' : 'bg-emerald-400'}`}
                    style={{ height: `${minPct}%` }}
                  />
                  {/* Hatched: the gap between them, in the bigger one's color */}
                  <div
                    className="absolute left-0 right-0 transition-all duration-300"
                    style={{ bottom: `${minPct}%`, height: `${maxPct - minPct}%`, ...hatchStyle(isPaidBigger ? PAID_COLOR : OWED_COLOR) }}
                  />
                </div>

                {/* end side: what they paid */}
                <div className="relative h-56 w-28 shrink-0">
                  <Tag
                    side="end" pct={paidPct} caption={t('groups.page.buckets.paid')}
                    amount={formatMinorAmount(paid, currency)} tone={{ text: 'text-emerald-600', line: 'bg-emerald-400' }}
                  />
                </div>
              </div>

              <p className="font-bold text-slate-800 mt-3 text-center truncate max-w-[16rem]">{displayName}</p>
              <p
                className={`mt-1 text-xs font-bold px-3 py-1 rounded-full ${
                  delta === 0 ? 'bg-slate-100 text-slate-500' : delta > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                }`}
              >
                {delta === 0
                  ? t('groups.page.buckets.settled')
                  : delta > 0
                  ? t('groups.page.buckets.ahead', { amount: formatMinorAmount(delta, currency) })
                  : t('groups.page.buckets.behind', { amount: formatMinorAmount(-delta, currency) })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const MemberBucketsView = ({ group, expenses }) => {
  const settings = getCurrencySettings(group);

  if (settings.mode !== 'keep_original') {
    return <BucketsForCurrency group={group} expenses={expenses} currency={settings.mergeCurrency} />;
  }

  const byCurrency = {};
  for (const expense of expenses) {
    (byCurrency[expense.currency] ||= []).push(expense);
  }
  const currencies = Object.keys(byCurrency);

  if (currencies.length === 0) {
    return <BucketsForCurrency group={group} expenses={[]} currency={group.currency || 'ILS'} />;
  }

  return (
    <div className="space-y-4">
      {currencies.map((currency) => (
        <BucketsForCurrency
          key={currency}
          group={group}
          expenses={byCurrency[currency]}
          currency={currency}
          title={currency}
        />
      ))}
    </div>
  );
};
