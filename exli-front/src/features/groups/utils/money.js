/**
 * Group money is stored in minor units — see
 * docs/groups/02-phase2-ui-and-splits-plan.md §5. Originally always ×100
 * (agorot), now currency-aware (docs/fx/01-fx-plan.md §6: JPY has 0 minor
 * units, KWD has 3, ...) via the shared currencyMeta table.
 */
import { getMinorUnits } from '../../../lib/fx/currencyMeta';

export const toMinorUnits = (amount, currency = 'ILS') =>
  Math.round(Number(amount) * 10 ** getMinorUnits(currency));

export const DEFAULT_GROUP_CURRENCY = 'ILS';

/** A group's currency; groups without one are shekels. */
export const groupCurrency = (group) => group?.currency || DEFAULT_GROUP_CURRENCY;

export const formatMinorAmount = (amountMinor, rawCurrency, locale) => {
  const currency = rawCurrency || DEFAULT_GROUP_CURRENCY;
  // Keeps the "whole units, no cents" display convention; the divisor is
  // currency-aware (JPY has 0 minor units, KWD has 3).
  const value = (amountMinor || 0) / 10 ** getMinorUnits(currency);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
  }
};
