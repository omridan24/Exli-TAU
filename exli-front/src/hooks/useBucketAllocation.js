import { useCallback, useState } from 'react';

/**
 * Generic n-bucket allocation: drag/type one value, the unlocked others rebalance
 * proportionally, total always stays exactly `total`. Extracted from
 * AllocationBuckets.jsx (investments) per docs/groups/02-phase2-ui-and-splits-plan.md
 * Debate M — same math, generalized to n ids and any integer total (percent=100,
 * or a money amount in minor units for Pour It Yourself).
 */
export function useBucketAllocation(ids, initialValues, total) {
  const [values, setValues] = useState(() => ({ ...initialValues }));
  const [locks, setLocks] = useState(() => Object.fromEntries(ids.map((id) => [id, false])));

  const toggleLock = useCallback((id) => setLocks((prev) => ({ ...prev, [id]: !prev[id] })), []);

  const setValue = useCallback((id, rawValue) => {
    setValues((prev) => {
      const clamped = Math.max(0, Math.min(total, Math.round(rawValue)));
      const diff = clamped - (prev[id] || 0);
      if (diff === 0) return prev;

      const unlocked = ids.filter((i) => i !== id && !locks[i]);
      if (unlocked.length === 0) return prev;

      const totalUnlocked = unlocked.reduce((sum, i) => sum + (prev[i] || 0), 0);
      if (diff > 0 && totalUnlocked < diff) return prev;

      const next = { ...prev, [id]: clamped };
      if (totalUnlocked === 0) {
        const per = -diff / unlocked.length;
        unlocked.forEach((i) => { next[i] = Math.max(0, Math.round((prev[i] || 0) + per)); });
      } else {
        unlocked.forEach((i) => {
          const proportion = (prev[i] || 0) / totalUnlocked;
          next[i] = Math.max(0, Math.round((prev[i] || 0) - diff * proportion));
        });
      }

      let sum = ids.reduce((s, i) => s + next[i], 0);
      if (sum !== total) {
        const correction = total - sum;
        for (const i of unlocked) {
          if (next[i] + correction >= 0) { next[i] += correction; break; }
        }
      }
      return next;
    });
  }, [ids, locks, total]);

  const reset = useCallback((newValues) => setValues({ ...newValues }), []);
  const sum = ids.reduce((s, i) => s + (values[i] || 0), 0);

  return { values, locks, setValue, toggleLock, reset, sum };
}
