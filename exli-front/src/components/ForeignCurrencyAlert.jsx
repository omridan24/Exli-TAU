/**
 * The one "this record isn't in your default currency" marker used across the app
 * (expenses, income, wishlist, group expenses) - docs/fx/01-fx-plan.md §11.
 *
 * A small amber badge sits next to the amount. Clicking it opens a popup that explains the
 * mismatch, already shows what the amount is worth in the default currency, and offers to
 * convert. Records are never changed without that click.
 *
 * Callers own what "convert" means (which document, which fields) via `onConvert`; without it
 * the popup is informational only. Amounts are in MAJOR units (e.g. 12.5), callers with minor
 * units divide first.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe2, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFx } from '../lib/fx/useFx';

/**
 * @param {{
 *   amount: number,
 *   currency: string,
 *   date?: string,
 *   month?: string,
 *   target?: string,
 *   onConvert?: () => Promise<void>,
 * }} props
 * `target` is the currency the record should be in; it defaults to the user's own default
 * currency. Group expenses pass the group's main currency instead.
 */
export function ForeignCurrencyAlert({ amount, currency, date, month, target, onConvert }) {
  const { t } = useTranslation();
  const { convertTo, format, defaultCurrency: userDefault } = useFx();
  const defaultCurrency = target || userDefault;
  const [open, setOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState(null);

  const stop = (e) => e.stopPropagation();

  const handleConvert = async () => {
    setConverting(true);
    setError(null);
    try {
      await onConvert();
      setOpen(false);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setConverting(false);
    }
  };

  const result = open ? convertTo({ amount, currency, date, month }, defaultCurrency) : null;
  const note = result?.basis === 'monthlyAvg'
    ? t('money.monthlyAvgNote', { month: result.rateDate })
    : result?.approximate
      ? t('money.approximateNote', { date: result.rateDate })
      : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { stop(e); setOpen(true); }}
        title={t('foreignAlert.tooltip', { currency, defaultCurrency })}
        aria-label={t('foreignAlert.tooltip', { currency, defaultCurrency })}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 text-[10px] font-bold align-middle"
      >
        <Globe2 className="w-3 h-3" /> {currency}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          onClick={(e) => { stop(e); if (!converting) setOpen(false); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 text-start font-sans" onClick={stop}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{t('foreignAlert.title', { currency })}</h3>
              <button onClick={() => setOpen(false)} disabled={converting} aria-label={t('common.close')} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <p className="text-sm text-slate-600">{t('foreignAlert.explain', { currency, defaultCurrency })}</p>

            {result && result.value != null ? (
              <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                <p className="text-lg font-bold text-slate-800 font-mono">
                  {format(amount, currency)} {'->'} {format(result.value, defaultCurrency)}
                </p>
                <p className="text-xs text-slate-500">
                  {t('foreignAlert.rate', { from: currency, to: defaultCurrency, rate: result.rate?.toFixed(4) })}
                  {note ? ` (${note})` : ''}
                </p>
              </div>
            ) : (
              <p className="text-sm text-amber-700 font-medium">{t('money.unsupported')}</p>
            )}

            {onConvert && <p className="text-xs text-slate-400">{t('foreignAlert.hint', { currency })}</p>}
            {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button" onClick={() => setOpen(false)} disabled={converting}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold"
              >
                {onConvert ? t('foreignAlert.keep', { currency }) : t('common.close')}
              </button>
              {onConvert && (
                <button
                  type="button" onClick={handleConvert} disabled={converting || result?.value == null}
                  className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {converting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('foreignAlert.convert', { defaultCurrency })}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default ForeignCurrencyAlert;
