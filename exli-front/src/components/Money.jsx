/**
 * The single component that renders any money amount anywhere in Exli —
 * docs/fx/01-fx-plan.md §4.3/§5. Replaces the scattered
 * `{currency} {x.toLocaleString()}` throughout the app.
 *
 * Behavior:
 *  - Same currency as the default: shown plainly, no conversion UI at all.
 *  - Foreign, unconverted record: shown in its own currency with an alert badge that
 *    opens the explain-and-convert popup.
 *  - Converted record (has `original`/`fx`): shown in the default currency
 *    with a small ↔ marker, explaining what it was converted from.
 *  - Unsupported (no rate at all): the original amount with a ⚠️, never
 *    silently included in a sum.
 *
 * A foreign, unconverted record shows the shared <ForeignCurrencyAlert> badge. `onConvert`
 * (optional) is what its popup's Convert button runs - the caller owns what conversion means
 * (which Firestore doc, which field). `noAlert` hides the badge, for secondary cells of a row
 * that already has one.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFx } from '../lib/fx/useFx';
import { useCurrencyContext } from '../lib/fx/useCurrencyContext';
import { ForeignCurrencyAlert } from './ForeignCurrencyAlert';

/**
 * @param {{
 *   amount: number,
 *   currency: string,
 *   date?: string,
 *   month?: string,
 *   original?: {amount:number, currency:string},
 *   fx?: {rate:number, rateDate:string, basis:string},
 *   className?: string,
 *   onConvert?: () => Promise<void>,
 * }} props
 */
export function Money({ amount, currency, date, month, original, fx, className = '', onConvert, noAlert = false }) {
  const { t } = useTranslation();
  const { defaultCurrency } = useCurrencyContext();
  const { format } = useFx();
  const [expanded, setExpanded] = useState(false);

  const isConverted = !!(original && fx);
  const isForeignUnconverted = !isConverted && currency !== defaultCurrency;

  if (!isForeignUnconverted && !isConverted) {
    // The plain, common case: already in the default currency.
    return <span className={className}>{format(amount, currency)}</span>;
  }

  if (isConverted) {
    const explain = t('money.convertedFrom', {
      originalAmount: format(original.amount, original.currency),
      rate: fx.rate?.toFixed(4),
      currency,
    });
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <span>{format(amount, currency)}</span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-400 hover:text-slate-600 text-xs"
          title={explain}
          aria-label={explain}
        >
          ↔
        </button>
        {expanded && <span className="text-xs text-slate-400 block w-full">{explain}</span>}
      </span>
    );
  }

  // Foreign, unconverted: the amount in its own currency plus the shared alert badge, which
  // explains the mismatch and offers the conversion (components/ForeignCurrencyAlert).
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{format(amount, currency)}</span>
      {!noAlert && <ForeignCurrencyAlert amount={amount} currency={currency} date={date} month={month} onConvert={onConvert} />}
    </span>
  );
}

export default Money;
