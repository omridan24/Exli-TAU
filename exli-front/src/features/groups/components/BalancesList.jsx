import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../../hooks/useLanguage';
import { simplifyDebts } from '../utils/simplifyDebts';
import { formatMinorAmount } from '../utils/money';

export const BalancesList = ({ group }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const transactions = simplifyDebts(group.balances);
  const name = (uid) => group.members?.[uid]?.displayName || uid;

  if (transactions.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-4">{t('groups.page.allSettledGroup')}</p>;
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx, i) => (
        <div key={i} className="flex items-center justify-between text-sm py-1.5">
          <span className="font-medium text-slate-700 flex items-center gap-1.5">
            {name(tx.from)} <ArrowRight className={`w-3.5 h-3.5 text-slate-300 ${isRTL ? 'rotate-180' : ''}`} /> {name(tx.to)}
          </span>
          <span className="font-bold text-slate-800">{formatMinorAmount(tx.amount, group.currency)}</span>
        </div>
      ))}
    </div>
  );
};
