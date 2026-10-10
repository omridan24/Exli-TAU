import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useMyGroups } from '../../groups/hooks/useMyGroups';

/** Listen for recorded payments in at most this many groups (the most recently active ones). */
export const MAX_WATCHED_GROUPS = 10;
/** Only the newest few payments per group matter for a "payment received" notification. */
const PAYMENTS_PER_GROUP = 5;

/**
 * Data behind the dashboard's group notifications. The group docs (members, balances, pending request
 * count) come from useMyGroups' single query, so join requests and balances cost nothing extra. Recorded
 * payments live in each group's settlements subcollection, so there is one small listener (newest 5) per
 * group, capped at MAX_WATCHED_GROUPS, all released on unmount or when the set of groups changes.
 */
export function useGroupNotificationData(userId) {
  const { groups, loading } = useMyGroups(userId);
  const [paymentsByGroup, setPaymentsByGroup] = useState({});

  const watchedIds = useMemo(() => groups.slice(0, MAX_WATCHED_GROUPS).map((g) => g.id), [groups]);
  const watchedKey = watchedIds.join('|');

  useEffect(() => {
    if (!userId || watchedIds.length === 0) {
      setPaymentsByGroup({});
      return undefined;
    }
    const unsubscribes = watchedIds.map((groupId) => {
      const q = query(
        collection(db, 'groups', groupId, 'settlements'),
        orderBy('createdAt', 'desc'),
        limit(PAYMENTS_PER_GROUP)
      );
      return onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, groupId, ...d.data() })).filter((s) => !s.deleted);
          setPaymentsByGroup((prev) => ({ ...prev, [groupId]: list }));
        },
        (err) => console.error('useGroupNotificationData (settlements) failed:', err)
      );
    });
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      setPaymentsByGroup({});
    };
    // watchedKey is the stable identity of watchedIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, watchedKey]);

  const payments = useMemo(() => Object.values(paymentsByGroup).flat(), [paymentsByGroup]);

  return { groups, payments, loading };
}

export default useGroupNotificationData;
