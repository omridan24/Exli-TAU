import { getCurrencySettings } from './currencySettings';

/** The ledgers a group currently holds, as [[currency, balances], ...]. keep_original: one per currency (plus
 * the old flat ledger if it carries history from before a merge -> keep_original switch, docs/fx/01-fx-plan.md §6
 * Decision C). Otherwise the single flat ledger in the group's currency. */
export function ledgersOf(group) {
  const settings = getCurrencySettings(group);
  if (settings.mode !== 'keep_original') return [[settings.mergeCurrency || group.currency || 'ILS', group.balances || {}]];
  const byCurrency = { ...(group.balancesByCurrency || {}) };
  const legacyCurrency = group.currency || 'ILS';
  if (Object.values(group.balances || {}).some((v) => v !== 0) && !byCurrency[legacyCurrency]) {
    byCurrency[legacyCurrency] = group.balances;
  }
  return Object.entries(byCurrency);
}
