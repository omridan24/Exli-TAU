import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, HandCoins, Undo2, Loader2 } from 'lucide-react';
import { Card } from '../../../components/UI';
import { groupsApi } from '../../../config/groupsApi';
import { formatMinorAmount } from '../utils/money';
import { useLanguage } from '../../../hooks/useLanguage';

const dateOf = (s, locale) => {
  const ms = s.createdAt?.toMillis?.();
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

/** Stats tab: every recorded payment between members, totals per person, and undo (whoever recorded it, or an admin). */
export const SettlementsCard = ({ group, settlements, userId, isAdmin, currency }) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [undoing, setUndoing] = useState(null);
  const [error, setError] = useState('');
  const name = (uid) => group.members?.[uid]?.displayName || uid;

  const shown = currency ? settlements.filter((s) => s.currency === currency) : settlements;
  if (shown.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="font-bold text-slate-800 mb-1">{t('groups.stats.payments')}</h2>
        <p className="text-sm text-slate-400">{t('groups.stats.noPayments')}</p>
      </Card>
    );
  }

  // totals per currency, and per person (sent / received) within the shown payments
  const totals = {};
  const people = {};
  for (const s of shown) {
    totals[s.currency] = (totals[s.currency] || 0) + s.amountMinor;
    const key = `${s.currency}`;
    for (const [uid, field] of [[s.from, 'sent'], [s.to, 'received']]) {
      people[uid] ||= {};
      people[uid][key] ||= { sent: 0, received: 0 };
      people[uid][key][field] += s.amountMinor;
    }
  }

  const undo = async (id) => {
    setUndoing(id);
    setError('');
    try {
      await groupsApi.deleteSettlement(group.id, id);
    } catch (err) {
      setError(err.message);
    } finally {
      setUndoing(null);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-emerald-500" /> {t('groups.stats.payments')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('groups.stats.paymentsHint')}</p>
        </div>
        <div className="text-end">
          <p className="text-xs text-slate-400 font-medium">{t('groups.stats.settledTotal')}</p>
          {Object.entries(totals).map(([c, v]) => (
            <p key={c} className="font-extrabold text-emerald-600">{formatMinorAmount(v, c)}</p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {Object.entries(people).map(([uid, byCur]) => (
          <div key={uid} className="bg-slate-50 rounded-xl px-3 py-2 text-xs">
            <p className="font-bold text-slate-700 mb-0.5">{name(uid)}</p>
            {Object.entries(byCur).map(([c, v]) => (
              <p key={c} className="text-slate-500">
                {v.sent > 0 && <span>{t('groups.stats.sent', { amount: formatMinorAmount(v.sent, c) })}</span>}
                {v.sent > 0 && v.received > 0 && ' · '}
                {v.received > 0 && <span>{t('groups.stats.received', { amount: formatMinorAmount(v.received, c) })}</span>}
              </p>
            ))}
          </div>
        ))}
      </div>

      <div className="divide-y divide-slate-50">
        {shown.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                <span className="truncate">{name(s.from)}</span>
                <ArrowRight className={`w-3.5 h-3.5 text-slate-300 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                <span className="truncate">{name(s.to)}</span>
              </p>
              <p className="text-xs text-slate-400">
                {dateOf(s, i18n.language)}{dateOf(s, i18n.language) ? ' · ' : ''}{t(`groups.pay.methods.${s.method || 'other'}`)}
              </p>
            </div>
            <span className="font-bold text-slate-800 text-sm">{formatMinorAmount(s.amountMinor, s.currency)}</span>
            {(isAdmin || s.createdBy === userId) && (
              <button
                type="button" onClick={() => undo(s.id)} disabled={undoing === s.id}
                title={t('groups.stats.undoPayment')} aria-label={t('groups.stats.undoPayment')}
                className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-40"
              >
                {undoing === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-rose-500 font-medium mt-2">{error}</p>}
    </Card>
  );
};

export default SettlementsCard;
