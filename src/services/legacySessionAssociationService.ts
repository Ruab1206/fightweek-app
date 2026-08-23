/**
 * legacySessionAssociationService — TRANSITIONAL legacy read adapter.
 *
 * Why it exists: `TrainingLogPage` needs exact timing from legacy week/
 * session persistence during the strangler (no session is already in
 * memory there, unlike App.tsx's open `SessionModal`).
 * Invariant it cannot yet satisfy: no persisted `EventOccurrence` exists for
 * the legacy self-posted calendar session.
 * Replacement direction: canonical `EventOccurrence`-backed calendar reads.
 * Retirement condition: legacy calendar sessions no longer need week-document
 * lookup for TrainingLog timing.
 *
 * Scope: ONE Firestore call — load one legacy week document by fighter +
 * ISO week number. Reads the SAME `weeks/week_{n}` document/path/rules
 * already used elsewhere (`useScheduleData.fetchWeekData`) — no new
 * collection, no new rule, no write. Session matching/timing derivation is
 * pure and lives in `../domain/calendar/legacySessionAssociation` — this
 * module intentionally does not know about sessions, days, or ids, only
 * about loading one week document. Caching/dedup by fighter+week (so several
 * logs in the same week share one request) is the caller's responsibility
 * (`TrainingLogPage`), not this module's — this stays a plain per-call
 * loader with no internal/global cache.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_COLLECTION } from '../config/constants';

const WEEKS_SUBCOLLECTION = 'weeks';

/**
 * Load one legacy week document for a fighter, or `null` if it doesn't
 * exist. One `getDoc` per call — no retry, no cache, no write.
 */
export async function loadLegacyWeekDocument(
  fighterKey: string,
  weekNumber: number,
): Promise<Record<string, unknown> | null> {
  const weekRef = doc(db, ROOT_COLLECTION, fighterKey, WEEKS_SUBCOLLECTION, `week_${weekNumber}`);
  const snap = await getDoc(weekRef);
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}
