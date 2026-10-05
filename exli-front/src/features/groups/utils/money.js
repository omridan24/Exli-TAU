/** Group money is stored in minor units (agorot) — see docs/groups/02-phase2-ui-and-splits-plan.md §5. */

export const toMinorUnits = (amount) => Math.round(Number(amount) * 100);

export const DEFAULT_GROUP_CURRENCY = 'ILS';

/** A group's currency; groups without one are shekels. */
export const groupCurrency = (group) => group?.currency || DEFAULT_GROUP_CURRENCY;

export const formatMinorAmount = (amountMinor, rawCurrency, locale) => {
  const currency = rawCurrency || DEFAULT_GROUP_CURRENCY;
  const value = (amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
  }
};
