/**
 * The raw React context object, split into its own file because React Fast
 * Refresh requires a file to export either only components or only
 * non-component values, never both - CurrencyContext.jsx (the Provider) and
 * useCurrencyContext.js (the hook) both import this.
 */
import { createContext } from 'react';
import { DEFAULT_CURRENCY_PREFS } from './useCurrencyPrefs';

export const CurrencyContext = createContext({
  defaultCurrency: DEFAULT_CURRENCY_PREFS.defaultCurrency,
});

export default CurrencyContext;
