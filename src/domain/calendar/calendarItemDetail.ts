/**
 * calendarItemDetail.ts — shared, source-neutral calendar-item read/detail
 * contract (Phase: shared CalendarEntry detail boundary — see
 * `/docs/self_posted_lifecycle_and_invariants.md` Section I step 4).
 *
 * Pure types only — no Firebase, no React. This is a READ MODEL: it never
 * constructs `EventOccurrence` or `CalendarEntry`, never defines domain type,
 * navigation, or capability by itself. `source` is a presentation/capability
 * SELECTOR only (I16) — it must never be treated as a persisted discriminator
 * or used to infer capabilities; capabilities are always explicit fields on
 * `CalendarItemCapabilities`, set by a source adapter from real repository
 * evidence, never derived by a presentation component from `source`.
 *
 * `CalendarSource` enumerates the calendar-item sources identified by the
 * shared-detail-contract architecture review. Only `self_posted_legacy` has
 * an adapter in this slice; the others are declared vocabulary for later,
 * separately implemented adapters — declaring the value here does not imply
 * behaviour for it.
 */
import type { OccurrenceLogAssociation } from './logAssociation';

export type CalendarSource =
  | 'self_posted_legacy'
  | 'self_posted_new_model'
  | 'catalogue_class'
  | 'event'
  | 'invitation';

/**
 * Opaque, source-neutral identity for one calendar item. Never parsed by
 * presentation or application code — only ever compared for equality or
 * round-tripped back to the adapter that produced it.
 */
export type CalendarItemKey = string & { readonly __calendarItemKey: unique symbol };

/**
 * Minimum source-neutral read model needed to preserve current calendar
 * detail meaning. `occurrenceId`/`calendarEntryId` are optional because most
 * current sources (including legacy self-posted sessions) have no canonical
 * occurrence identity yet — omitting them here is honest, not a gap to patch
 * by fabricating one (see the adapter's own contract).
 */
export interface CalendarItemDetail {
  itemKey: CalendarItemKey;
  /** Present only when the source already has canonical `EventOccurrence` identity. */
  occurrenceId?: string;
  /** Present only when the source already has canonical `CalendarEntry` identity. */
  calendarEntryId?: string;
  source: CalendarSource;
  title: string;
  dateISO: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  description?: string;
  category?: string;
  recurrenceContext?: {
    isRecurring: boolean;
    intervalWeeks?: number;
  };
  availability: {
    status: 'active' | 'cancelled';
    cancellationReason?: string;
    cancellationTime?: string | null;
  };
}

/**
 * Explicit capability/status projection. Every field must be set by a source
 * adapter from evidenced current behaviour — never inferred by a presentation
 * component from `source`, collection, or provenance (I16). `Participation`
 * is deliberately absent from this slice's fields: nothing here may be read
 * as participation, and no field infers it from calendar presence (I5/I6).
 */
export interface CalendarItemCapabilities {
  editable: boolean;
  deletable: boolean;
  /** Present only when a recurring-edit scope beyond "this occurrence" is currently supported. */
  recurringEditScope?: 'this' | 'this_and_following';
  noteState: {
    supported: boolean;
    /** Present only when `supported` and the item has a persisted identity to key notes by. */
    noteKey?: string;
  };
  /**
   * Status projection only — reuses the existing none/one/conflict
   * classification unchanged (`OccurrenceLogAssociation`). MUST NOT become
   * the primary navigation target; a presentation consumer renders it as an
   * indicator, not a destination.
   */
  trainingLogAssociation?: OccurrenceLogAssociation;
  canLogTraining: boolean;
  canInvite: boolean;
  canSeriesInvite: boolean;
}

/** The adapter's output: a read-model/capability pair for one calendar item. */
export interface CalendarItemDetailRecord {
  detail: CalendarItemDetail;
  capabilities: CalendarItemCapabilities;
}
