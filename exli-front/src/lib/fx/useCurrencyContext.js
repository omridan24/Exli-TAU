import { useContext } from 'react';
import { CurrencyContext } from './currencyContextObject';

export function useCurrencyContext() {
  return useContext(CurrencyContext);
}

export default useCurrencyContext;
