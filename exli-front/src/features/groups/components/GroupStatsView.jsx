import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMinorAmount } from '../utils/money';
import { computeGroupStats } from '../utils/groupStats';

const monthLabel = (month, locale) => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  try {
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  } catch {
    return month;
  }
};

const Card = ({ title, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
    <h2 className="font-bold text-slate-800 mb-3">{title}</h2>
    {children}
  </div>
);

/** "Other stats" tab: per-month who-paid-what, member share vs paid, biggest/average, categories. */
export const GroupStatsView = ({ group, expenses }) => {
  const { t, i18n } = useTranslation();
  const memberEntries = useMemo(
    () => Object.entries(group.members || {}).filter(([, m]) => m.status === 'active'),
    [group.members]
  );
  const stats = useMemo(() => computeGroupStats(expenses, memberEntries.map(([uid]) => uid)), [expenses, memberEntries]);
  const nameOf = (uid) => group.members?.[uid]?.displayName || uid;
  const fmt = (v) => formatMinorAmount(v, group.currency);

  if (expenses.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">{t('groups.page.noExpenses')}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          [t('groups.stats.total'), fmt(stats.total)],
          [t('groups.stats.count'), stats.count],
          [t('groups.stats.average'), fmt(stats.average)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 text-center">
            <p className="text-xs text-slate-400 font-medium">{label}</p>
            <p className="font-bold text-slate-800 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <Card title={t('groups.stats.byMonth')}>
        <div className="space-y-4">
          {stats.months.map((m) => (
            <div key={m.month}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-700">{monthLabel(m.month, i18n.language)}</span>
                <span className="font-bold text-slate-800">{fmt(m.total)} <span className="text-xs text-slate-400 font-medium">({m.count})</span></span>
              </div>
              <div className="mt-1 space-y-0.5">
                {Object.entries(m.paidBy).sort((a, b) => b[1] - a[1]).map(([uid, amount]) => (
                  <div key={uid} className="flex items-center justify-between text-xs text-slate-500">
                    <span>{t('groups.stats.paidBy', { name: nameOf(uid) })}</span>
                    <span className="font-medium">{fmt(amount)} · {m.total > 0 ? Math.round((amount / m.total) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t('groups.stats.shareVsPaid')}>
        <div className="space-y-2">
          {memberEntries.map(([uid]) => {
            const { paid, owed } = stats.byMember[uid];
            const sharePct = stats.total > 0 ? Math.round((owed / stats.total) * 100) : 0;
            return (
              <div key={uid} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{nameOf(uid)}</span>
                <span className="text-xs text-slate-500">
                  {t('groups.stats.paidShare', { paid: fmt(paid), share: fmt(owed), pct: sharePct })}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {stats.categories.some((c) => c.category) && (
        <Card title={t('groups.stats.byCategory')}>
          <div className="space-y-2">
            {stats.categories.map((c) => (
              <div key={c.category || '_none'} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{c.category || t('groups.stats.uncategorized')}</span>
                <span className="text-xs text-slate-500">
                  {fmt(c.amount)} · {stats.total > 0 ? Math.round((c.amount / stats.total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={t('groups.stats.biggest')}>
        <div className="space-y-2">
          {stats.biggest.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-700">{e.description}</p>
                <p className="text-xs text-slate-400">{e.date} · {nameOf(e.paidBy)}</p>
              </div>
              <span className="font-bold text-slate-800">{fmt(e.amountMinor)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
