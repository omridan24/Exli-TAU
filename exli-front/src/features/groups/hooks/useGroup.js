import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../config/firebase';

/**
 * Live data for one group page: the group doc, its (non-deleted) expenses and recorded payments (settlements), and —
 * for an admin only — pending join requests.
 *
 * Note on joinRequests: firestore.rules lets an admin read the WHOLE
 * joinRequests subcollection (their permission doesn't depend on which
 * document is being read), but a non-admin can only ever read their OWN
 * request doc by id, which this collection-level listener can't express. For
 * a non-admin, Firestore denies the query outright and the onSnapshot error
 * callback fires — that's expected, not a bug, so it just resolves to an
 * empty list rather than surfacing an error.
 */
export function useGroup(groupId) {
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!groupId) return undefined;

    setLoading(true);
    setNotFound(false);

    return onSnapshot(
      doc(db, 'groups', groupId),
      (snap) => {
        if (snap.exists()) {
          setGroup({ id: snap.id, ...snap.data() });
        } else {
          setGroup(null);
          setNotFound(true);
        }
        setLoading(false);
      },
      (err) => {
        console.error('useGroup (group doc) failed:', err);
        setGroup(null);
        setNotFound(true);
        setLoading(false);
      }
    );
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return undefined;
    const q = query(collection(db, 'groups', groupId, 'expenses'), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snap) => setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => !e.deleted)),
      (err) => console.error('useGroup (expenses) failed:', err)
    );
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return undefined;
    return onSnapshot(
      collection(db, 'groups', groupId, 'settlements'),
      (snap) => {
        const millis = (d) => d.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER; // pending local write = newest
        setSettlements(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => !s.deleted).sort((a, b) => millis(b) - millis(a))
        );
      },
      (err) => console.error('useGroup (settlements) failed:', err)
    );
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return undefined;
    return onSnapshot(
      collection(db, 'groups', groupId, 'joinRequests'),
      (snap) =>
        setJoinRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.status === 'pending')
        ),
      () => setJoinRequests([]) // not an admin — see the note above
    );
  }, [groupId]);

  return { group, expenses, settlements, joinRequests, loading, notFound };
}
