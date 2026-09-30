import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMinorAmount } from '../utils/money';

// Tailwind's emerald-400 / emerald-800 hex values — needed as literal colors
// for the diagonal hatch pattern below, which a Tailwind class can't express.
const PAID_COLOR = '#34d399';
const OWED_COLOR = '#065f46';

const hatchStyle = (color) => ({
  backgroundImage: `repeating-linear-gradient(135deg, ${color}, ${color} 3px, transparent 3px, transparent 7px)`,
});

/**
 * "Who Paid What": one big bucket per member — a single bar (not two bars of
 * different widths) showing paid vs should-pay-by-splits as two tones of the
 * same bar: solid up to whichever of the two is SMALLER (in that metric's own
 * color), then a hatched region on top up to the BIGGER one (in the bigger
 * metric's color) — the hatch is the gap itself: still owed, or overpaid,
 * depending on which metric is ahead. Paid/should-pay amounts are labeled
 * beside the bar at the height they actually reach; only the ahead/behind/
 * settled delta sits below, colored green/red.
 *
 * Paid/owed totals are derived client-side from the already-loaded `expenses`
 * (each stores its computed `shares: {uid: amountMinor}` — see
 * group_expenses_service.py) rather than from `group.balances`, which only
 * carries the net (paid minus owed), not the two components separately.
 */
export const MemberBucketsView = ({ group, expenses }) => {
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
      <h2 className="font-bold text-slate-800 mb-1">{t('groups.page.bucketsTab')}</h2>
      <div className="flex items-center gap-4 text-xs text-slate-400 font-medium mb-5">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> {t('groups.page.buckets.paid')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-800" /> {t('groups.page.buckets.shouldPay')}</span>
      </div>

      <div className="flex flex-wrap justify-center gap-8">
        {rows.map(({ uid, displayName, paid, owed }) => {
          const paidPct = (paid / scaleMax) * 100;
          const owedPct = (owed / scaleMax) * 100;
          const minPct = Math.min(paidPct, owedPct);
          const maxPct = Math.max(paidPct, owedPct);
          const isPaidBigger = paidPct >= owedPct;
          const delta = paid - owed;

          return (
            <div key={uid} className="flex flex-col items-center">
              <div className="flex items-end gap-1">
                <div className="relative w-16 h-56 rounded-2xl border-2 border-slate-200 bg-slate-50 overflow-hidden shrink-0">
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

                {/* Paid / should-pay labels, positioned at the height each one reaches */}
                <div className="relative h-56 w-24 shrink-0">
                  <span
                    className="absolute text-[11px] font-bold text-emerald-600 whitespace-nowrap"
                    style={{ bottom: `calc(${paidPct}% - 7px)` }}
                  >
                    {t('groups.page.buckets.paid')} {formatMinorAmount(paid, group.currency)}
                  </span>
                  <span
                    className="absolute text-[11px] font-bold text-emerald-800 whitespace-nowrap"
                    style={{ bottom: `calc(${owedPct}% - 7px)` }}
                  >
                    {t('groups.page.buckets.shouldPay')} {formatMinorAmount(owed, group.currency)}
                  </span>
                </div>
              </div>

              <p className="font-bold text-sm text-slate-800 mt-2 text-center truncate w-full">{displayName}</p>
              <p className={`text-xs font-bold ${delta === 0 ? 'text-slate-400' : delta > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {delta === 0
                  ? t('groups.page.buckets.settled')
                  : delta > 0
                  ? t('groups.page.buckets.ahead', { amount: formatMinorAmount(delta, group.currency) })
                  : t('groups.page.buckets.behind', { amount: formatMinorAmount(-delta, group.currency) })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
