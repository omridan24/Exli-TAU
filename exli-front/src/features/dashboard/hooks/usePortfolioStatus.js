import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, CLOUD_RUN_URL } from '../../../config/firebase';
import { isQuotableHolding } from '../utils/statusInsights';

/**
 * Loads the user's saved investment holdings (users/{uid}.holdings) and a fresh quote for each
 * real ticker, for the dashboard's Status panel. Failures leave the panel without an investments
 * tile rather than breaking the dashboard.
 *
 * @returns {{ holdings: Array, quotes: Object, loading: boolean }}
 */
export function usePortfolioStatus(userId) {
  const [state, setState] = useState({ holdings: [], quotes: {}, loading: Boolean(userId) });

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        const holdings = snap.exists() && Array.isArray(snap.data().holdings) ? snap.data().holdings : [];
        if (cancelled) return;
        setState({ holdings, quotes: {}, loading: false });

        const symbols = [...new Set(holdings.filter(isQuotableHolding).map((h) => h.symbol))];
        const entries = await Promise.all(symbols.map(async (symbol) => {
          try {
            const res = await fetch(`${CLOUD_RUN_URL}/market/symbol/${encodeURIComponent(symbol)}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data && !data.error ? [symbol, data] : null;
          } catch {
            return null;
          }
        }));
        if (cancelled) return;
        setState({ holdings, quotes: Object.fromEntries(entries.filter(Boolean)), loading: false });
      } catch (err) {
        console.error('Failed to load portfolio for the dashboard:', err);
        if (!cancelled) setState({ holdings: [], quotes: {}, loading: false });
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return state;
}
