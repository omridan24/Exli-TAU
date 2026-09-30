/** Group money is stored in minor units (agorot) — see docs/groups/02-phase2-ui-and-splits-plan.md §5. */

export const toMinorUnits = (amount) => Math.round(Number(amount) * 100);

export const formatMinorAmount = (amountMinor, currency = 'ILS', locale) => {
  const value = (amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
  }
};
