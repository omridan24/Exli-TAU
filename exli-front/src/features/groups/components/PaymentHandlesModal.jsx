import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { groupsApi } from '../../../config/groupsApi';

const FIELDS = [
  { key: 'phone', inputMode: 'tel', dir: 'ltr' },
  { key: 'venmo', inputMode: 'text', dir: 'ltr' },
  { key: 'paypal', inputMode: 'text', dir: 'ltr' },
];

/** A member's own payment details, shown to the others in the group when they pay this member back. */
export const PaymentHandlesModal = ({ group, userId, onClose }) => {
  const { t } = useTranslation();
  const current = group.members?.[userId]?.paymentHandles || {};
  const [values, setValues] = useState({ phone: current.phone || '', venmo: current.venmo || '', paypal: current.paypal || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await groupsApi.setPaymentHandles(group.id, values);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">{t('groups.pay.handlesTitle')}</h3>
          <button onClick={onClose} disabled={saving} aria-label={t('common.close')} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <p className="text-sm text-slate-500">{t('groups.pay.handlesHint')}</p>
        {FIELDS.map(({ key, inputMode, dir }) => (
          <div key={key}>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t(`groups.pay.handles.${key}`)}</label>
            <input
              type="text" inputMode={inputMode} dir={dir} value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              placeholder={t(`groups.pay.handles.${key}Placeholder`)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none focus:border-indigo-500"
            />
          </div>
        ))}
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        <button
          type="button" onClick={save} disabled={saving}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('common.save')}
        </button>
      </div>
    </div>,
    document.body
  );
};

export default PaymentHandlesModal;
