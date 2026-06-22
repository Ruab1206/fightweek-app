// ──────────────────────────────────────────────
// Fighter Profile service (#1058 / 1.12)
// Public profiles stored at artifacts/production/public/data/profiles/{emailKey}.
// ──────────────────────────────────────────────
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PUBLIC_DATA_PATH } from '../config/constants';
import type { FighterProfile } from '../types/profile';
import { emptyFighterProfile } from '../types/profile';

const COL = 'profiles';

/** Merge a stored partial into a complete profile (defaults fill gaps). */
function hydrate(emailKey: string, data: Partial<FighterProfile> | undefined): FighterProfile {
  const base = emptyFighterProfile(emailKey, data?.name ?? '');
  return {
    ...base,
    ...data,
    emailKey,
    record: { ...base.record, ...(data?.record ?? {}) },
  };
}

/** One-time read of a profile by email key. Returns null if it doesn't exist. */
export async function getProfile(emailKey: string): Promise<FighterProfile | null> {
  const snap = await getDoc(doc(db, PUBLIC_DATA_PATH, COL, emailKey));
  if (!snap.exists()) return null;
  return hydrate(emailKey, snap.data() as Partial<FighterProfile>);
}

/** Real-time subscription to a single profile (used by the edit page). */
export function subscribeProfile(
  emailKey: string,
  callback: (profile: FighterProfile | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, PUBLIC_DATA_PATH, COL, emailKey),
    (snap) => callback(snap.exists() ? hydrate(emailKey, snap.data() as Partial<FighterProfile>) : null),
    (err) => onError?.(err),
  );
}

/** Create or overwrite a profile. */
export async function saveProfile(profile: FighterProfile): Promise<void> {
  const { emailKey } = profile;
  await setDoc(doc(db, PUBLIC_DATA_PATH, COL, emailKey), {
    ...profile,
    updatedAt: new Date().toISOString(),
  });
}
