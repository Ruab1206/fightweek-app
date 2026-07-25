/**
 * Activity-note key builders (pure, no Firebase/React).
 *
 * Extracted from `useActivityNotes` so the note-key convention lives in one
 * firebase-free place and can be reused by pure logic (e.g. the log-protection
 * delete wiring in `useSessionHandlers`) and unit-tested without pulling in the
 * Firestore client. `useActivityNotes` re-exports these for backwards
 * compatibility, so existing importers keep working unchanged.
 *
 * Key format (unchanged):
 *   Sessions  →  s_{YYYY-MM-DD}_{sessionId}
 *   Events    →  e_{eventId}
 */

/** Key for a training session note. */
export function sessionNoteKey(dateISO: string, sessionId: string): string {
  return `s_${dateISO}_${sessionId}`;
}

/** Key for an event note. */
export function eventNoteKey(eventId: string): string {
  return `e_${eventId}`;
}
