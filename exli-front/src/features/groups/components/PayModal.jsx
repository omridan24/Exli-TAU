import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ExternalLink, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { groupsApi } from '../../../config/groupsApi';
import { formatMinorAmount, toMinorUnits } from '../utils/money';
import { getMinorUnits } from '../../../lib/fx/currencyMeta';

const METHODS = ['bit', 'paybox', 'venmo', 'paypal', 'cash'];

/** Deep links that really do prefill recipient + amount. Bit and PayBox publish no such link, so for
 * them the phone number and amount are copied instead. */
const venmoUrl = (handle, amount, note) =>
  `https://venmo.com/${encodeURIComponent(handle)}?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`;
const paypalUrl = (handle, amount, currency) =>
  `https://www.paypal.me/${encodeURIComponent(handle)}/${amount}${currency}`;

const CopyButton = ({ text, label }) => {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // clipboard blocked: the value is still shown on screen to copy by hand
    }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-300">
      {done ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? t('groups.pay.copied') : label}
    </button>
  );
};

/**
 * "Mark paid" popup for one suggested transfer. mode 'pay': I am paying `tx.to`; mode 'received': `tx.from`
 * paid me and I'm confirming it. The amount defaults to the full amount and can be lowered. The payment
 * is only recorded when the user confirms; the app links just help them make the actual transfer.
 */
export const PayModal = ({ group, tx, currency, mode, onClose }) => {
  const { t } = useTranslation();
  const paying = mode === 'pay';
  const other = group.members?.[paying ? tx.to : tx.from] || {};
  const otherName = other.displayName || (paying ? tx.to : tx.from);
  const handles = other.paymentHandles || {};
  const units = getMinorUnits(currency);
  const fullMajor = tx.amount / 10 ** units;

  const [amountText, setAmountText] = useState(String(fullMajor));
  const [method, setMethod] = useState(paying ? null : 'other');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = Number(amountText);
  const amountMinor = Number.isFinite(parsed) && parsed > 0 ? toMinorUnits(parsed, currency) : 0;
  const invalid = amountMinor <= 0 || amountMinor > tx.amount;
  const shownAmount = amountMinor > 0 ? (amountMinor / 10 ** units).toFixed(units) : '';
  const note = t('groups.pay.note', { group: group.name });

  const confirm = async () => {
    if (invalid) return;
    setSaving(true);
    setError('');
    try {
      await groupsApi.recordSettlement(group.id, {
        from: tx.from, to: tx.to, amountMinor, currency, method: method || 'other',
      });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const methodBody = () => {
    if (!paying || !method) return null;
    if (method === 'venmo') {
      if (!handles.venmo) return <p className="text-xs text-slate-500">{t('groups.pay.noHandle', { name: otherName, app: 'Venmo' })}</p>;
      if (currency !== 'USD') return <p className="text-xs text-slate-500">{t('groups.pay.venmoUsdOnly')}</p>;
      return (
        <a href={venmoUrl(handles.venmo, shownAmount, note)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 text-white text-sm font-bold">
          <ExternalLink className="w-4 h-4" /> {t('groups.pay.openApp', { app: 'Venmo' })}
        </a>
      );
    }
    if (method === 'paypal') {
      if (!handles.paypal) return <p className="text-xs text-slate-500">{t('groups.pay.noHandle', { name: otherName, app: 'PayPal' })}</p>;
      return (
        <a href={paypalUrl(handles.paypal, shownAmount, currency)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 text-white text-sm font-bold">
          <ExternalLink className="w-4 h-4" /> {t('groups.pay.openApp', { app: 'PayPal' })}
        </a>
      );
    }
    if (method === 'bit' || method === 'paybox') {
      const app = method === 'bit' ? 'Bit' : 'PayBox';
      if (!handles.phone) return <p className="text-xs text-slate-500">{t('groups.pay.noPhone', { name: otherName, app })}</p>;
      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{t('groups.pay.phoneHint', { app, name: otherName })}</p>
          <p className="font-mono font-bold text-slate-800" dir="ltr">{handles.phone}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={handles.phone} label={t('groups.pay.copyPhone')} />
            <CopyButton text={shownAmount} label={t('groups.pay.copyAmount')} />
          </div>
        </div>
      );
    }
    return <p className="text-xs text-slate-500">{t('groups.pay.cashHint')}</p>;
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            {paying ? t('groups.pay.titlePay', { name: otherName }) : t('groups.pay.titleReceived', { name: otherName })}
          </h3>
          <button onClick={onClose} disabled={saving} aria-label={t('common.close')} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('groups.pay.amount')}</label>
          <div className="flex items-center gap-2">
            <input
              type="number" inputMode="decimal" min="0" step={units === 0 ? '1' : '0.01'} value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-lg outline-none focus:border-indigo-500"
            />
            <span className="font-bold text-slate-500">{currency}</span>
          </div>
          <p className={`text-xs mt-1.5 ${invalid ? 'text-rose-500' : 'text-slate-400'}`}>
            {invalid
              ? t('groups.pay.amountInvalid', { max: formatMinorAmount(tx.amount, currency) })
              : amountMinor < tx.amount
                ? t('groups.pay.partial', { rest: formatMinorAmount(tx.amount - amountMinor, currency) })
                : t('groups.pay.fullAmount')}
          </p>
        </div>

        {paying && (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t('groups.pay.how')}</label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button
                  key={m} type="button" onClick={() => setMethod(m)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${
                    method === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {t(`groups.pay.methods.${m}`)}
                </button>
              ))}
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 min-h-[3rem]">{methodBody() || <p className="text-xs text-slate-400">{t('groups.pay.pickMethod')}</p>}</div>
          </div>
        )}

        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold">
            {t('groups.create.cancel')}
          </button>
          <button
            type="button" onClick={confirm} disabled={saving || invalid || (paying && !method)}
            className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {paying ? t('groups.pay.confirmPaid') : t('groups.pay.confirmReceived')}
          </button>
        </div>
        {paying && <p className="text-[11px] text-slate-400 text-center">{t('groups.pay.recordHint')}</p>}
      </div>
    </div>,
    document.body
  );
};

export default PayModal;
