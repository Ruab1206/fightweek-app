/**
 * legacySessionDetailAdapter.ts — pure source adapter mapping a legacy
 * self-posted `TrainingSession` (`users/{fighterKey}/weeks/week_{n}`) to the
 * shared `CalendarItemDetail`/`CalendarItemCapabilities` read contract (see
 * `calendarItemDetail.ts` and `/docs/self_posted_lifecycle_and_invariants.md`
 * Section I step 4).
 *
 * TRANSITIONAL source adapter: legacy sessions have no canonical
 * `EventOccurrence`/`CalendarEntry` identity, so this adapter never
 * fabricates `occurrenceId`/`calendarEntryId` — it maps only what the legacy
 * record actually has. Retirement condition: retire once legacy self-posted
 * sessions are represented as canonical `EventOccurrence`/`CalendarEntry`
 * records and a canonical-source adapter replaces this one.
 *
 * Pure — no Firebase, no React, no routing, no mutation of `session`/
 * `context`. Constructs no `EventOccurrence`, no `CalendarEntry`. Reuses the
 * existing `toDateTime` timing helper and `sessionNoteKey` convention exactly
 * (both already pure, Firebase-free) rather than reimplementing them.
 * Ownership/eligibility-dependent capabilities (`canLogTraining`,
 * `canInvite`, `canSeriesInvite`, `trainingLogAssociation`) are never
 * inferred here — they are explicit supporting context the caller already
 * computes today (mirrors `SessionModal`'s own optional props), passed
 * through unchanged.
 */
import { toDateTime } from './adapters';
import { sessionNoteKey } from '../../hooks/noteKeys';
import { evaluateThisAndFollowingEligibility } from './seriesEditScopeEligibility';
import type { OccurrenceLogAssociation } from './logAssociation';
import type { TrainingSession } from '../../types/common';
import type {
  CalendarItemDetail,
  CalendarItemCapabilities,
  CalendarItemDetailRecord,
  CalendarItemKey,
} from './calendarItemDetail';

/**
 * Explicit supporting context the caller already has today. None of this is
 * derivable from `session` alone — it is either placement context (week/day
 * the calendar rendered the session under) or an already-decided capability
 * fact (ownership, eligibility, association) computed elsewhere, reused here
 * unchanged.
 */
export interface LegacySessionAdapterContext {
  weekNumber: number;
  dateISO: string;
  /** Local "YYYY-MM-DD" today — needed only to classify this-and-following
   *  eligibility via the single shared `evaluateThisAndFollowingEligibility`
   *  contract (never re-derived or used for any other capability here). */
  todayISO: string;
  /** Reuse the existing read-side classification unchanged — never recomputed here. */
  trainingLogAssociation?: OccurrenceLogAssociation;
  canLogTraining?: boolean;
  canInvite?: boolean;
  canSeriesInvite?: boolean;
}

function buildItemKey(session: TrainingSession, context: LegacySessionAdapterContext): CalendarItemKey {
  const sessionId = session.id !== undefined ? String(session.id) : 'unsaved';
  return `self_posted_legacy:${context.weekNumber}:${context.dateISO}:${sessionId}` as CalendarItemKey;
}

/**
 * Map one legacy `TrainingSession` + its explicit supporting context into the
 * shared `CalendarItemDetail`/`CalendarItemCapabilities` read contract.
 */
export function mapLegacySessionToCalendarItemDetail(
  session: TrainingSession,
  context: LegacySessionAdapterContext,
): CalendarItemDetailRecord {
  const isRecurring = session.isRecurring === true || (session.recurrenceInterval ?? 0) > 0;

  const detail: CalendarItemDetail = {
    itemKey: buildItemKey(session, context),
    source: 'self_posted_legacy',
    title: session.name,
    dateISO: context.dateISO,
    startDateTime: toDateTime(context.dateISO, session.start),
    endDateTime: toDateTime(context.dateISO, session.end),
    availability:
      session.status === 'cancelled'
        ? {
            status: 'cancelled',
            ...(session.cancellationReason !== undefined ? { cancellationReason: session.cancellationReason } : {}),
            ...(session.cancellationTime !== undefined ? { cancellationTime: session.cancellationTime } : {}),
          }
        : { status: 'active' },
  };
  // Firestore-safe / contract-honest: omit rather than assign undefined/empty for absent optional fields.
  if (session.location) detail.location = session.location;
  if (session.category) detail.category = session.category;
  if (isRecurring) {
    detail.recurrenceContext = { isRecurring: true, ...(session.recurrenceInterval !== undefined ? { intervalWeeks: session.recurrenceInterval } : {}) };
  }

  const hasSavedIdentity = session.id !== undefined;
  const capabilities: CalendarItemCapabilities = {
    // Legitimate source-specific restriction: a catalogue-linked session (same
    // TrainingSession shape, `catalogueClassId` present) is not directly
    // editable — recurrence/cancellation handling remain, deletion remains.
    editable: !session.catalogueClassId,
    deletable: true,
    noteState: hasSavedIdentity
      ? { supported: true, noteKey: sessionNoteKey(context.dateISO, String(session.id)) }
      : { supported: false },
    canLogTraining: context.canLogTraining ?? false,
    canInvite: context.canInvite ?? false,
    canSeriesInvite: context.canSeriesInvite ?? false,
  };
  // Single source of truth (shared with SessionModal) — never re-derives the
  // durable-seriesId/historical rule independently here.
  if (isRecurring) {
    const eligibility = evaluateThisAndFollowingEligibility({
      isRecurring: true,
      seriesId: session.seriesId,
      occurrenceDateISO: context.dateISO,
      todayISO: context.todayISO,
    });
    capabilities.recurringEditScope = eligibility.eligible ? 'this_and_following' : 'this';
  }
  if (context.trainingLogAssociation !== undefined) capabilities.trainingLogAssociation = context.trainingLogAssociation;

  return { detail, capabilities };
}
