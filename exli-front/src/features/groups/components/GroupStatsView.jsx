import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Receipt, TrendingUp, Crown, Info } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { Card } from '../../../components/UI';
import { formatMinorAmount } from '../utils/money';
import { getMinorUnits, CURRENCY_META } from '../../../lib/fx/currencyMeta';
import { useFx } from '../../../lib/fx/useFx';
import { SettlementsCard } from './SettlementsCard';
import { computeGroupStats, currenciesIn, convertExpensesTo } from '../utils/groupStats';

const ALL = '__all__';
// Same hues the rest of the app uses for people/categories, readable in light mode.
const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16'];

const shortMonth = (month, locale) => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  try {
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  } catch {
    return month;
  }
};

const Avatar = ({ member, color, size = 'w-9 h-9' }) =>
  member?.photoURL ? (
    <img src={member.photoURL} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div
      className={`${size} rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}
    >
      {member?.displayName?.[0]?.toUpperCase() || '?'}
    </div>
  );

const Kpi = ({ icon: Icon, label, value, sub, accent }) => (
  <Card className={`p-5 border-l-4 ${accent.border} flex flex-col justify-between`}>
    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
      <Icon className={`w-4 h-4 ${accent.icon}`} /> {label}
    </div>
    <div className="text-2xl font-extrabold text-slate-800 truncate">{value}</div>
    {sub && <div className="text-xs text-slate-400 font-medium mt-1 truncate">{sub}</div>}
  </Card>
);

const SectionTitle = ({ children, hint }) => (
  <div className="mb-4">
    <h2 className="font-bold text-slate-800">{children}</h2>
    {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
  </div>
);

/**
 * "Other stats" tab - KPI cards, spending per month stacked by who paid, where the money goes,
 * and each member's paid-vs-share. Laid out like the Analytics page. A group that holds several
 * currencies (keep_original) gets a currency switcher; stats are never summed across currencies
 * unless the "all, converted" view is chosen (approximate, each expense at its own date's rate).
 */
export const GroupStatsView = ({ group, expenses, settlements = [], userId, isAdmin = false }) => {
  const { t, i18n } = useTranslation();
  const { convertTo, defaultCurrency, dataVersion } = useFx();
  const [selected, setSelected] = useState(null); // currency code | ALL | null (= the biggest currency)

  const memberEntries = useMemo(
    () => Object.entries(group.members || {}).filter(([, m]) => m.status === 'active'),
    [group.members]
  );
  const memberUids = useMemo(() => memberEntries.map(([uid]) => uid), [memberEntries]);
  const colorOf = useMemo(
    () => Object.fromEntries(memberUids.map((uid, i) => [uid, PALETTE[i % PALETTE.length]])),
    [memberUids]
  );
  const nameOf = (uid) => group.members?.[uid]?.displayName || uid;

  const currencies = useMemo(() => currenciesIn(expenses, group), [expenses, group]);
  const multi = currencies.length > 1;
  const view = !multi ? currencies[0] : (selected && (selected === ALL || currencies.includes(selected)) ? selected : currencies[0]);
  const viewCurrency = view === ALL ? defaultCurrency : view;

  const { scoped, excluded } = useMemo(() => {
    if (!expenses.length) return { scoped: [], excluded: 0 };
    if (view === ALL) {
      const r = convertExpensesTo(expenses, group, defaultCurrency, convertTo);
      return { scoped: r.expenses, excluded: r.excluded };
    }
    return { scoped: expenses.filter((e) => (e.currency || group.currency || 'ILS') === view), excluded: 0 };
    // dataVersion: rates may arrive after first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, group, view, defaultCurrency, convertTo, dataVersion]);

  const stats = useMemo(() => computeGroupStats(scoped, memberUids), [scoped, memberUids]);
  const fmt = (v) => formatMinorAmount(v, viewCurrency);
  const compact = (v) => {
    const major = v / 10 ** getMinorUnits(viewCurrency);
    return new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 }).format(major);
  };

  const monthData = useMemo(
    () => [...stats.months].reverse().map((m) => ({
      label: shortMonth(m.month, i18n.language),
      total: m.total,
      ...Object.fromEntries(memberUids.map((uid) => [uid, m.paidBy[uid] || 0])),
    })),
    [stats.months, memberUids, i18n.language]
  );
  const payingMembers = memberUids.filter((uid) => (stats.byMember[uid]?.paid || 0) > 0);

  const categories = stats.categories.map((c, i) => ({
    ...c,
    name: c.category || t('groups.stats.uncategorized'),
    color: PALETTE[i % PALETTE.length],
    pct: stats.total > 0 ? Math.round((c.amount / stats.total) * 100) : 0,
  }));

  if (expenses.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">{t('groups.page.noExpenses')}</p>;
  }

  const maxBar = Math.max(1, ...memberUids.map((uid) => Math.max(stats.byMember[uid]?.paid || 0, stats.byMember[uid]?.owed || 0)));

  return (
    <div className="space-y-6 animate-fade-in">
      {multi && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider me-1">{t('groups.stats.viewIn')}</span>
          {[...currencies, ALL].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelected(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${
                view === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {c === ALL ? t('groups.stats.allConverted', { currency: defaultCurrency }) : `${CURRENCY_META[c]?.flag || ''} ${c}`}
            </button>
          ))}
        </div>
      )}
      {view === ALL && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {t('groups.stats.approxNote', { currency: defaultCurrency })}
            {excluded > 0 && ` ${t('groups.stats.excluded', { count: excluded })}`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Wallet} label={t('groups.stats.total')} value={fmt(stats.total)}
          accent={{ border: 'border-emerald-500', icon: 'text-emerald-500' }} />
        <Kpi icon={Receipt} label={t('groups.stats.count')} value={stats.count}
          accent={{ border: 'border-blue-500', icon: 'text-blue-500' }} />
        <Kpi icon={TrendingUp} label={t('groups.stats.average')} value={fmt(stats.average)}
          accent={{ border: 'border-purple-500', icon: 'text-purple-500' }} />
        <Kpi icon={Crown} label={t('groups.stats.topPayer')}
          value={stats.topPayer ? nameOf(stats.topPayer.uid) : '-'}
          sub={stats.topPayer ? t('groups.stats.paidAmount', { amount: fmt(stats.topPayer.paid) }) : null}
          accent={{ border: 'border-amber-400', icon: 'text-amber-500' }} />
      </div>

      <Card className="p-6">
        <SectionTitle hint={t('groups.stats.monthlyHint')}>{t('groups.stats.monthlySpending')}</SectionTitle>
        <div className="h-64 w-full" style={{ minHeight: '256px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={monthData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={compact} />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                formatter={(value, uid) => [fmt(value), nameOf(uid)]}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              {payingMembers.map((uid, i) => (
                <Bar
                  key={uid} dataKey={uid} stackId="paid" fill={colorOf[uid]}
                  radius={i === payingMembers.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {payingMembers.map((uid) => (
            <span key={uid} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorOf[uid] }} /> {nameOf(uid)}
            </span>
          ))}
        </div>
      </Card>

      {categories.some((c) => c.category) && (
        <Card className="p-6">
          <SectionTitle>{t('groups.stats.whereMoneyGoes')}</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
            <div className="md:col-span-2 h-52" style={{ minHeight: '208px' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={categories} dataKey="amount" nameKey="name" innerRadius="60%" outerRadius="90%" paddingAngle={2} stroke="none">
                    {categories.map((c) => <Cell key={c.name} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [fmt(value), name]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="md:col-span-3 space-y-3">
              {categories.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} /> {c.name}
                    </span>
                    <span className="text-slate-500">
                      <span className="font-bold text-slate-800">{fmt(c.amount)}</span> · {c.pct}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <SectionTitle hint={t('groups.stats.paidVsShareHint')}>{t('groups.stats.paidVsShare')}</SectionTitle>
        <div className="space-y-5">
          {memberEntries.map(([uid, member]) => {
            const { paid, owed } = stats.byMember[uid];
            const net = paid - owed;
            return (
              <div key={uid}>
                <div className="flex items-center gap-3 mb-2">
                  <Avatar member={member} color={colorOf[uid]} />
                  <span className="font-bold text-slate-800 flex-1 truncate">{nameOf(uid)}</span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      net === 0 ? 'bg-slate-100 text-slate-500' : net > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {net === 0
                      ? t('groups.stats.even')
                      : t(net > 0 ? 'groups.stats.paidMore' : 'groups.stats.paidLess', { amount: fmt(Math.abs(net)) })}
                  </span>
                </div>
                {[
                  ['groups.stats.paid', paid, 'bg-emerald-500'],
                  ['groups.stats.share', owed, 'bg-slate-300'],
                ].map(([labelKey, value, bar]) => (
                  <div key={labelKey} className="flex items-center gap-3 text-xs mt-1.5">
                    <span className="w-14 text-slate-400 font-medium shrink-0">{t(labelKey)}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${bar} transition-all duration-500`} style={{ width: `${(value / maxBar) * 100}%` }} />
                    </div>
                    <span className="w-24 text-end font-bold text-slate-700 shrink-0">{fmt(value)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

      <SettlementsCard
        group={group} settlements={settlements} userId={userId} isAdmin={isAdmin}
        currency={view === ALL ? null : view}
      />

      <Card className="p-6">
        <SectionTitle>{t('groups.stats.biggest')}</SectionTitle>
        <div className="divide-y divide-slate-50">
          {stats.biggest.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 py-3">
              <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 text-sm truncate">{e.description}</p>
                <p className="text-xs text-slate-400">{e.date} · {nameOf(e.paidBy)}</p>
              </div>
              <span className="font-bold text-slate-800 text-sm">{fmt(e.amountMinor)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
