import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';

/**
 * Live "my groups" list — a single `memberIds array-contains` query, per plan 01
 * Debate B. Needs the composite index in firestore.indexes.json.
 */
export function useMyGroups(userId) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const q = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', userId),
      where('status', '==', 'active'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useMyGroups failed:', err);
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId]);

  return { groups, loading, error };
}
