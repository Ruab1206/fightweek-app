import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PUBLIC_DATA_PATH } from '../config/constants';
import type { Gym } from '../types/gym';

export function useGyms() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, PUBLIC_DATA_PATH, 'gyms'));
    const unsub = onSnapshot(q, (snap) => {
      const items: Gym[] = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      } as Gym));
      items.sort((a, b) => a.name.localeCompare(b.name, 'da'));
      setGyms(items);
      setLoading(false);
    }, (err) => {
      console.error('[useGyms] error:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { gyms, loading };
}
