import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../../hooks/useLanguage';
import { simplifyDebts } from '../utils/simplifyDebts';
import { formatMinorAmount } from '../utils/money';
import { getCurrencySettings } from '../utils/currencySettings';
import { ledgersOf } from '../utils/ledgers';

const DebtRow = ({ tx, currency, name, isRTL, userId, onSettle }) => {
  const { t } = useTranslation();
  const iPay = tx.from === userId;
  const iReceive = tx.to === userId;
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-2">
      <span className="font-medium text-slate-700 flex items-center gap-1.5 min-w-0">
        <span className="truncate">{iPay ? t('groups.page.you') : name(tx.from)}</span>
        <ArrowRight className={`w-3.5 h-3.5 text-slate-300 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
        <span className="truncate">{iReceive ? t('groups.page.you') : name(tx.to)}</span>
      </span>
      <span className="flex items-center gap-3 shrink-0">
        <span className="font-bold text-slate-800">{formatMinorAmount(tx.amount, currency)}</span>
        {(iPay || iReceive) && onSettle && (
          <button
            type="button"
            onClick={() => onSettle(tx, currency, iPay ? 'pay' : 'received')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> {iPay ? t('groups.page.markPaid') : t('groups.page.markReceived')}
          </button>
        )}
      </span>
    </div>
  );
};

/** "Who owes whom": each currency's balances reduced to the fewest transfers (see utils/simplifyDebts). */
export const BalancesList = ({ group, userId, onSettle }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const name = (uid) => group.members?.[uid]?.displayName || uid;

  const ledgers = ledgersOf(group)
    .map(([currency, balances]) => [currency, simplifyDebts(balances)])
    .filter(([, txs]) => txs.length > 0);

  if (ledgers.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-4">{t('groups.page.allSettledGroup')}</p>;
  }

  const showCurrencyLabel = ledgers.length > 1 || getCurrencySettings(group).mode === 'keep_original';
  return (
    <div className="space-y-4">
      {ledgers.map(([currency, txs]) => (
        <div key={currency}>
          {showCurrencyLabel && <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{currency}</div>}
          <div className="divide-y divide-slate-50">
            {txs.map((tx) => (
              <DebtRow
                key={`${tx.from}-${tx.to}`} tx={tx} currency={currency} name={name} isRTL={isRTL}
                userId={userId} onSettle={onSettle}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
