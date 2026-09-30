import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bucket } from '../../../../components/buckets/Bucket';
import { useBucketAllocation } from '../../../../hooks/useBucketAllocation';
import { formatMinorAmount, toMinorUnits } from '../../utils/money';

/** The always-available custom uneven split — never a stored rule (plan §3.1/§4.3). */
export const PourItYourself = ({ participants, amountMinor, currency, onChange, initialAmounts }) => {
  const { t } = useTranslation();
  const ids = useMemo(() => participants.map((p) => p.uid), [participants]);
  const idsKey = ids.join(',');

  const initial = useMemo(() => {
    if (initialAmounts && ids.every((id) => id in initialAmounts)) {
      return Object.fromEntries(ids.map((id) => [id, initialAmounts[id]]));
    }
    const base = Math.floor(amountMinor / ids.length);
    const remainder = amountMinor - base * ids.length;
    return Object.fromEntries(ids.map((id, i) => [id, base + (i === 0 ? remainder : 0)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, amountMinor]);

  const { values, locks, setValue, toggleLock, sum } = useBucketAllocation(ids, initial, amountMinor);

  useEffect(() => { onChange(values); }, [values]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-3 flex-wrap p-2">
        {participants.map((p) => (
          <Bucket
            key={p.uid}
            label={p.displayName}
            value={values[p.uid] || 0}
            total={amountMinor}
            isLocked={locks[p.uid]}
            onChange={(v) => setValue(p.uid, v)}
            onToggleLock={() => toggleLock(p.uid)}
            formatValue={(v) => formatMinorAmount(v, currency)}
          />
        ))}
      </div>
      <p className={`text-center text-xs font-bold ${sum === amountMinor ? 'text-emerald-600' : 'text-rose-500'}`}>
        {formatMinorAmount(sum, currency)} / {formatMinorAmount(amountMinor, currency)}
      </p>

      <div className="space-y-1.5 pt-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('groups.splitPicker.orTypeAmounts')}</p>
        {participants.map((p) => (
          <div key={p.uid} className="flex items-center gap-2">
            <span className="flex-1 text-sm font-medium text-slate-600 truncate">{p.displayName}</span>
            <input
              type="number" min="0" step="0.01" inputMode="decimal"
              disabled={locks[p.uid]}
              value={(values[p.uid] || 0) / 100}
              onChange={(e) => setValue(p.uid, toMinorUnits(e.target.value || 0))}
              className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
