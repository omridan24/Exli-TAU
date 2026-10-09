/**
 * Provides { defaultCurrency } down the tree so
 * <Money>, <ForeignCurrencyAlert> and <CurrencyPicker> follow the right settings
 * without every caller having to pass them as props — docs/fx/01-fx-plan.md
 * §5.
 *
 * The app root wraps everything with the user's own currencyPrefs (via
 * useCurrencyPrefs). Group pages read the group's own currencySettings
 * separately (keep_original vs merge, §6).
 *
 * The context object lives in currencyContextObject.js and the hook to read
 * it (useCurrencyContext) in useCurrencyContext.js - a file exporting a
 * component alongside a context or hook breaks React Fast Refresh.
 */
import { useMemo } from 'react';
import { CurrencyContext } from './currencyContextObject';

/**
 * @param {{defaultCurrency:string, children: any}} props
 */
export function CurrencyProvider({ defaultCurrency, children }) {
  const value = useMemo(
    () => ({ defaultCurrency }),
    [defaultCurrency]
  );
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export default CurrencyProvider;
