/**
 * eventSeriesDefinition — Slice 1 durable recurrence-foundation record for a
 * user-created recurring self-posted training series.
 *
 * Persisted at `users/{fighterKey}/eventSeries/{seriesId}`. Aligned with the
 * domain `EventSeries` vocabulary (id, type, title, discipline, location) but
 * ADDS the recurrence LIFECYCLE fields the pure domain `EventSeries` does not
 * carry — owner, concrete recurrence start, weekday anchor, times, explicit end
 * (nullable = open-ended, NOT the materialization horizon) and active/
 * discontinued status — the minimum needed to later (Slice 2) materialize
 * occurrences from the definition.
 *
 * This is an ADDITIVE recurrence-foundation record. It is NOT a claim that
 * `EventSeries` is adopted app-wide, and it does not modify the pure
 * `EventSeries` domain type.
 */
import type { EventType } from './types';

export interface EventSeriesDefinition {
  /** Equals the seriesId (the Firestore document id). */
  id: string;
  type: EventType;
  /** Owning fighter's Firestore key (the path owner). */
  ownerKey: string;
  title: string;
  /** Training content/category, e.g. "MMA". */
  discipline?: string;
  location?: string;
  /** Recurrence weekday anchor, 1=Mon … 7=Sun (ISO 8601). */
  dayOfWeek: number;
  /** "HH:mm". */
  startTime: string;
  /** "HH:mm". */
  endTime: string;
  /** ISO "YYYY-MM-DD" — the first occurrence's date. */
  startDate: string;
  /** 1 = weekly, 2 = bi-weekly … */
  intervalWeeks: number;
  /** ISO "YYYY-MM-DD", or null = open-ended (semantic, NOT the horizon). */
  endDate: string | null;
  status: 'active' | 'discontinued';
  createdAt: string;
  updatedAt: string;
}

/**
 * Build the durable definition for a newly-created self-posted recurring
 * series. Pure. `endDate: null` is preserved verbatim as open-ended — the
 * caller must never substitute the materialization horizon here.
 */
export function buildEventSeriesDefinition(params: {
  seriesId: string;
  ownerKey: string;
  title: string;
  discipline?: string;
  location?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startDate: string;
  intervalWeeks: number;
  endDate: string | null;
  now?: string;
}): EventSeriesDefinition {
  const now = params.now ?? new Date().toISOString();
  const def: EventSeriesDefinition = {
    id: params.seriesId,
    type: 'self_posted_training',
    ownerKey: params.ownerKey,
    title: params.title,
    dayOfWeek: params.dayOfWeek,
    startTime: params.startTime,
    endTime: params.endTime,
    startDate: params.startDate,
    intervalWeeks: params.intervalWeeks,
    endDate: params.endDate,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  if (params.discipline) def.discipline = params.discipline;
  if (params.location) def.location = params.location;
  return def;
}
