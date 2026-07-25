/**
 * useActivityNotes — persists plain-text notes per fighter per activity.
 *
 * Storage: artifacts/production/users/{fighterName}/meta/notes
 * Single document with a flat key→text map, plus an updatedAt timestamp.
 *
 * Key format:
 *   Sessions  →  s_{YYYY-MM-DD}_{sessionId}
 *   Events    →  e_{eventId}
 */
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION } from '../config/constants';

export function useActivityNotes(fighterName: string) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!fighterName) return;
    const ref = doc(db, ROOT_COLLECTION, fighterName, 'meta', 'notes');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = { ...snap.data() } as Record<string, string>;
        delete data.updatedAt;
        setNotes(data);
      } else {
        setNotes({});
      }
    });
    return unsub;
  }, [fighterName]);

  const getNote = useCallback((key: string) => notes[key] || '', [notes]);

  const saveNote = useCallback(async (key: string, text: string) => {
    if (!fighterName) return;
    const ref = doc(db, ROOT_COLLECTION, fighterName, 'meta', 'notes');
    const trimmed = text.trim();
    if (trimmed) {
      await setDoc(ref, { [key]: trimmed, updatedAt: new Date().toISOString() }, { merge: true });
    } else {
      await setDoc(ref, { [key]: deleteField(), updatedAt: new Date().toISOString() }, { merge: true });
    }
  }, [fighterName]);

  return { notes, getNote, saveNote };
}

// Note-key builders now live in a pure, firebase-free module. Re-exported here
// so existing importers keep working unchanged.
export { sessionNoteKey, eventNoteKey } from './noteKeys';
