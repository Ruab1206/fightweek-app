/**
 * useNotificationsMeta — persists the "notifications last seen" marker per
 * fighter so the unread state syncs across devices (phone + laptop), instead of
 * living only in one browser's localStorage (#1208 Tier 1, cross-device sync).
 *
 * Storage: artifacts/production/users/{fighterKey}/meta/notifications
 * Single document: { lastSeen: <ms epoch>, updatedAt: <iso> }.
 *
 * A user only ever writes their OWN marker (rules already allow writing one's
 * own users/{email}/… path), so no cross-user permission is involved.
 */
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION } from '../config/constants';

export function useNotificationsMeta(fighterKey: string) {
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    if (!fighterKey) { setLastSeen(0); return; }
    const ref = doc(db, ROOT_COLLECTION, fighterKey, 'meta', 'notifications');
    const unsub = onSnapshot(ref, (snap) => {
      const v = snap.exists() ? Number(snap.data().lastSeen) : 0;
      setLastSeen(Number.isFinite(v) ? v : 0);
    }, (err) => {
      console.error('[useNotificationsMeta] error:', err);
    });
    return unsub;
  }, [fighterKey]);

  const markSeen = useCallback(async () => {
    if (!fighterKey) return;
    const now = Date.now();
    // Optimistic local update so the badge clears immediately.
    setLastSeen(now);
    const ref = doc(db, ROOT_COLLECTION, fighterKey, 'meta', 'notifications');
    try {
      await setDoc(ref, { lastSeen: now, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error('[useNotificationsMeta] markSeen failed:', err);
    }
  }, [fighterKey]);

  return { lastSeen, markSeen };
}
