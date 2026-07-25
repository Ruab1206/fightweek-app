/**
 * Event delete/soft-cancel decision (Phase 2b Step 3 — pure, firebase-free).
 *
 * Purpose: decide whether an event may be hard-deleted, using the existing
 * `e_{eventId}` note-key convention and the shared log-protection decision
 * (`decideDeletion`). Mirrors the pattern used for sessions/fravær in
 * useSessionHandlers.ts (Phase 2b Step 2) and noteKeys.ts.
 *
 * This module does NOT import Firebase, React, hooks with side effects, or UI
 * components — it is pure and unit-testable in isolation.
 */
import { eventNoteKey } from './noteKeys';
import { decideDeletion, type DeletionMode } from '../domain/calendar/logProtection';
import type { FightweekEvent } from '../types/event';

/**
 * Build the activity-note key for an event using the EXISTING convention:
 *   e_{eventId}
 *
 * Returns `canResolveKey: false` when the id cannot be resolved, so the caller
 * fails safe (soft-cancel / abort hard-delete) per the log-protection rules.
 */
export function buildEventNoteKey(
  eventId: string | null | undefined
): { key: string | null; canResolveKey: boolean } {
  const idOk = eventId !== null && eventId !== undefined && String(eventId).length > 0;
  if (!idOk) return { key: null, canResolveKey: false };
  return { key: eventNoteKey(eventId as string), canResolveKey: true };
}

/**
 * Decide how to handle a delete request for an event: soft-cancel if it has a
 * note/log (or its note key cannot be resolved, fail-safe); hard-delete
 * otherwise.
 */
export function decideEventDeletion(params: {
  eventId: string | null | undefined;
  getNote: (key: string) => string;
}): DeletionMode {
  const { key, canResolveKey } = buildEventNoteKey(params.eventId);
  const note = key ? params.getNote(key) : undefined;
  return decideDeletion({ canResolveKey, note });
}

/** True when the event has been soft-cancelled (used to drive the "Aflyst" badge). */
export function isEventCancelled(event: Pick<FightweekEvent, 'status'> | null | undefined): boolean {
  return event?.status === 'cancelled';
}
