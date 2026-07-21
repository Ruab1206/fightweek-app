/**
 * Log protection (Phase 2a — pure decision layer, NOT wired in yet).
 *
 * Purpose: decide whether a session / fravær / event may be hard-deleted, and
 * build a snapshot of the core event data that must remain readable when it
 * cannot. Current activity notes are treated as early/simple EventLogs: a
 * non-empty note for an item means "this item has a log" and must be protected.
 *
 * This module is PURE — no Firestore, no React, no side effects. It does not
 * build note keys itself: callers (Phase 2b) resolve the note via the existing
 * `sessionNoteKey` / `eventNoteKey` helpers and pass the looked-up note string
 * plus whether the key could be resolved. This keeps the module decoupled from
 * persistence and avoids duplicating the note-key format.
 *
 * Phase 2a scope: this decision logic is implemented and unit-tested. It is NOT
 * yet called from any delete handler — that wiring is Phase 2b and requires
 * separate approval.
 */
import type { TrainingSession, FraværSession } from '../../types/common';
import type { FightweekEvent } from '../../types/event';

/** What should happen to an item when a delete is requested. */
export type DeletionMode = 'hard-delete' | 'soft-cancel';

/**
 * Core event data that must remain readable after a delete attempt on a
 * logged/noted item (see `/docs/fightweek_domain_model.md`, log protection).
 */
export interface CoreEventData {
  title?: string;
  /** Discipline/category — training content, e.g. "MMA". */
  category?: string;
  /** Scheduling type where available, e.g. "fravær" / event type. */
  type?: string;
  start?: string;
  end?: string;
  location?: string;
  address?: string;
  /** Stable source id linking back to the origin (class / event / group). */
  sourceId?: string;
}

/**
 * True when a note counts as a log. Empty, missing or whitespace-only notes do
 * NOT count.
 */
export function hasLog(note: string | null | undefined): boolean {
  return typeof note === 'string' && note.trim().length > 0;
}

/**
 * Decide how to handle a delete request.
 *
 * Fail-safe rule: if the note key could not be reliably resolved
 * (`canResolveKey === false`), we cannot prove the item is un-logged, so we do
 * NOT hard-delete — we soft-cancel instead.
 */
export function decideDeletion(params: {
  canResolveKey: boolean;
  note: string | null | undefined;
}): DeletionMode {
  if (!params.canResolveKey) return 'soft-cancel';
  return hasLog(params.note) ? 'soft-cancel' : 'hard-delete';
}

/** Build the preserved core-data snapshot for a training session. */
export function preserveSessionCoreData(session: TrainingSession): CoreEventData {
  return {
    title: session.name,
    category: session.category,
    type: session.type,
    start: session.start,
    end: session.end,
    location: session.location,
    sourceId: session.catalogueClassId,
  };
}

/** Build the preserved core-data snapshot for a fravær (absence). */
export function preserveFraværCoreData(fravaer: FraværSession): CoreEventData {
  return {
    title: fravaer.fraværTitel || fravaer.name,
    category: fravaer.category,
    type: fravaer.type,
    start: fravaer.fraværStartTime,
    end: fravaer.fraværEndTime,
    sourceId: fravaer.fraværGroupId,
  };
}

/** Build the preserved core-data snapshot for a one-off event. */
export function preserveEventCoreData(evt: FightweekEvent): CoreEventData {
  return {
    title: evt.title,
    category: evt.discipline,
    type: evt.type,
    start: evt.startTime,
    end: evt.endTime,
    location: evt.location,
    address: evt.address,
    sourceId: evt.id,
  };
}
