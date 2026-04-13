import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, addDoc, deleteDoc as firestoreDeleteDoc, deleteField } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { PUBLIC_DATA_PATH } from '../config/constants';
import type { FightweekEvent, EventSignupStatus } from '../types/event';

export function useEvents() {
  const [events, setEvents] = useState<FightweekEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    function subscribe() {
      const q = query(collection(db, PUBLIC_DATA_PATH, 'events'));
      unsub = onSnapshot(q, (snap) => {
        const items: FightweekEvent[] = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as FightweekEvent))
          .filter((e) => e.title && e.date);
        items.sort((a, b) => a.date.localeCompare(b.date));
        setEvents(items);
        setLoading(false);
      }, (err) => {
        console.error('[useEvents] error:', err);
        setLoading(false);
        // Firestore terminates the listener on error — retry after a short delay
        unsub = null;
        retryTimer.current = setTimeout(subscribe, 2000);
      });
    }

    // Wait for auth before subscribing so Firestore has a valid token
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (!unsub) subscribe();
      }
    });

    return () => {
      unsubAuth();
      if (unsub) unsub();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  /** Update a fighter's sign-up status on an event */
  const updateSignup = async (eventId: string, fighterName: string, status: EventSignupStatus | null) => {
    const ref = doc(db, PUBLIC_DATA_PATH, 'events', eventId);
    if (status === null) {
      await updateDoc(ref, { [`signups.${fighterName}`]: deleteField() });
    } else {
      await updateDoc(ref, { [`signups.${fighterName}`]: status });
    }
  };

  /** Create a new event (admin/coach only) */
  const createEvent = async (data: Omit<FightweekEvent, 'id'>) => {
    await addDoc(collection(db, PUBLIC_DATA_PATH, 'events'), data);
  };

  /** Update an existing event (admin/coach only) */
  const saveEvent = async (eventId: string, data: Partial<FightweekEvent>) => {
    const ref = doc(db, PUBLIC_DATA_PATH, 'events', eventId);
    await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() });
  };

  /** Delete an event (admin/coach only) */
  const removeEvent = async (eventId: string) => {
    const ref = doc(db, PUBLIC_DATA_PATH, 'events', eventId);
    await firestoreDeleteDoc(ref);
  };

  return { events, loading, updateSignup, createEvent, saveEvent, removeEvent };
}
