import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { groupsApi } from '../../../config/groupsApi';
import { formatMonth, formatPercent } from '../utils/expenseSplit';

const MAX_MONTHS = 6;

/**
 * Plain-language per-month view of the income split, e.g.
 * "Sep 2026: Me 75% / Lina 25%". Each expense uses the ratio of ITS OWN month
 * (computed from the income month right before it - see income_ratio_service).
 * A month without complete income data shows an equal-split fallback instead.
 */
export const IncomeMonthlyBreakdown = ({ group, expenseMonths = [] }) => {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState(null);

  const monthsKey = useMemo(() => {
    const current = new Date().toISOString().slice(0, 7);
    return [...new Set([current, ...expenseMonths])].sort().reverse().slice(0, MAX_MONTHS).join(',');
  }, [expenseMonths]);

  useEffect(() => {
    let cancelled = false;
    groupsApi.getIncomeRatioMonths(group.id, monthsKey.split(','))
      .then((res) => { if (!cancelled) setRows(res.months); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [group.id, monthsKey]);

  if (!rows || rows.length === 0) return null;
  const nameOf = (uid) => group.members?.[uid]?.displayName || uid;

  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.forMonth} className="text-sm">
          <span className="font-bold text-slate-700">{formatMonth(r.forMonth, i18n.language, true)}: </span>
          {r.ready ? (
            <span className="text-slate-600">
              {Object.entries(r.ratios).sort((a, b) => b[1] - a[1])
                .map(([uid, pct]) => `${nameOf(uid)} ${formatPercent(pct)}`).join(' / ')}
              <span className="text-xs text-slate-400"> ({t('groups.incomeSplit.basedOn', { month: formatMonth(r.month, i18n.language) })})</span>
            </span>
          ) : (
            <span className="text-amber-600">{t('groups.incomeSplit.monthFallback')}</span>
          )}
        </div>
      ))}
    </div>
  );
};
