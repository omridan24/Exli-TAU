/**
 * Reads and updates users/{uid}.currencyPrefs live — docs/fx/01-fx-plan.md
 * §4 (Decision G). Same shape everywhere: { defaultCurrency,
 * favoriteCurrencies }.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export const DEFAULT_CURRENCY_PREFS = {
  defaultCurrency: 'ILS',
  favoriteCurrencies: ['USD', 'EUR'],
};

/**
 * @param {string} userId
 * @returns {{
 *   prefs: {defaultCurrency:string, favoriteCurrencies:string[]},
 *   loading: boolean,
 *   setDefaultCurrency: (code:string) => Promise<void>,
 *   setFavoriteCurrencies: (codes:string[]) => Promise<void>,
 * }}
 */
export function useCurrencyPrefs(userId) {
  // Raw doc data only lives in state; `prefs` itself is derived (useMemo)
  // rather than set from inside the effect, so the effect only ever calls
  // setState from its onSnapshot callback (a legitimate external-subscription
  // update), never synchronously in the effect body.
  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) return undefined;

    // No setLoading(true) here on purpose: the lazy initial state above
    // already covers the normal "userId present from the start" case, and
    // userId changing mid-session (a rare account switch) is a brief stale-
    // data flash at worst, not a correctness issue - keeping every setState
    // call here inside the onSnapshot callback (a real external-subscription
    // update) avoids the synchronous-setState-in-effect anti-pattern.
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        setDocData(snap.exists() ? snap.data() : {});
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [userId]);

  const prefs = useMemo(() => {
    if (!userId || !docData) return DEFAULT_CURRENCY_PREFS;
    const saved = docData.currencyPrefs;
    // One-time graceful fallback: the old (never actually wired up to any
    // UI) profile.preferredCurrency field, before this feature existed.
    const legacyDefault = docData.profile?.preferredCurrency;
    const merged = {
      ...DEFAULT_CURRENCY_PREFS,
      ...(saved || (legacyDefault ? { defaultCurrency: legacyDefault } : {})),
    };
    // The old ask/convert preference is retired: records always stay in the currency they were
    // made in, and a ForeignCurrencyAlert next to them offers the conversion.
    delete merged.onForeignAmount;
    return merged;
  }, [userId, docData]);

  // Writes ONLY the changed field. Rewriting the whole currencyPrefs object from the last values this
  // screen saw could overwrite a newer default currency with an old one.
  const save = useCallback(
    async (patch) => {
      if (!userId) return;
      setDocData((prev) => ({ ...(prev || {}), currencyPrefs: { ...(prev?.currencyPrefs || {}), ...patch } })); // optimistic - onSnapshot will confirm/correct
      await setDoc(doc(db, 'users', userId), { currencyPrefs: patch }, { merge: true });
    },
    [userId]
  );

  return {
    prefs,
    loading,
    setDefaultCurrency: (code) => save({ defaultCurrency: code }),
    setFavoriteCurrencies: (codes) => save({ favoriteCurrencies: codes }),
  };
}

export default useCurrencyPrefs;
