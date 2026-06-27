/**
 * useNotificationsMeta — persists notification state per fighter so it syncs
 * across devices (phone + laptop), instead of living only in one browser's
 * localStorage (#1208 Tier 1, cross-device sync).
 *
 * Storage: artifacts/production/users/{fighterKey}/meta/notifications
 * Single document: {
 *   lastSeen:  <ms epoch>     — drives the "new" highlight on unseen items,
 *   dismissed: string[]       — feed-item keys the user has cleared (#1215),
 *   updatedAt: <iso>
 * }.
 *
 * `dismissed` lets informational notifications (responses, cancellations)
 * persist in the tray until the user explicitly clears them — by tapping the
 * item, pressing its delete (X), or "Slet alle" — instead of all vanishing the
 * moment the panel closes.
 *
 * A user only ever writes their OWN marker (rules already allow writing one's
 * own users/{email}/… path), so no cross-user permission is involved.
 */
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION } from '../config/constants';

export function useNotificationsMeta(fighterKey: string) {
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (!fighterKey) { setLastSeen(0); setDismissed([]); return; }
    const ref = doc(db, ROOT_COLLECTION, fighterKey, 'meta', 'notifications');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const v = Number(data.lastSeen);
      setLastSeen(Number.isFinite(v) ? v : 0);
      setDismissed(Array.isArray(data.dismissed)
        ? data.dismissed.filter((k: unknown): k is string => typeof k === 'string')
        : []);
    }, (err) => {
      console.error('[useNotificationsMeta] error:', err);
    });
    return unsub;
  }, [fighterKey]);

  const markSeen = useCallback(async () => {
    if (!fighterKey) return;
    const now = Date.now();
    // Optimistic local update so the "new" highlight clears immediately.
    setLastSeen(now);
    const ref = doc(db, ROOT_COLLECTION, fighterKey, 'meta', 'notifications');
    try {
      await setDoc(ref, { lastSeen: now, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error('[useNotificationsMeta] markSeen failed:', err);
    }
  }, [fighterKey]);

  const dismiss = useCallback(async (key: string) => {
    if (!fighterKey || !key) return;
    setDismissed((prev) => (prev.includes(key) ? prev : [...prev, key]));
    const ref = doc(db, ROOT_COLLECTION, fighterKey, 'meta', 'notifications');
    try {
      await setDoc(ref, { dismissed: arrayUnion(key), updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error('[useNotificationsMeta] dismiss failed:', err);
    }
  }, [fighterKey]);

  const dismissAll = useCallback(async (keys: string[]) => {
    if (!fighterKey || keys.length === 0) return;
    setDismissed((prev) => Array.from(new Set([...prev, ...keys])));
    const ref = doc(db, ROOT_COLLECTION, fighterKey, 'meta', 'notifications');
    try {
      await setDoc(ref, { dismissed: arrayUnion(...keys), updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error('[useNotificationsMeta] dismissAll failed:', err);
    }
  }, [fighterKey]);

  return { lastSeen, markSeen, dismissed, dismiss, dismissAll };
}
