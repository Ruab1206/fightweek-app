import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PUBLIC_DATA_PATH } from '../config/constants';
import type { CatalogueClass } from '../types/catalogue';

export function useCatalogue() {
  const [classes, setClasses] = useState<CatalogueClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, PUBLIC_DATA_PATH, 'catalogue'));
    const unsub = onSnapshot(q, (snap) => {
      const items: CatalogueClass[] = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      } as CatalogueClass));
      items.sort((a, b) => a.title.localeCompare(b.title, 'da'));
      setClasses(items);
      setLoading(false);
    }, (err) => {
      console.error('[useCatalogue] error:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { classes, loading };
}
