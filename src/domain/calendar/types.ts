/**
 * Fightweek calendar domain types (target model).
 *
 * These types describe the calendar-first target model documented in
 * `/docs/fightweek_domain_model.md` and `/docs/fightweek_database_model.dbml`.
 *
 * Phase 1 scope: type declarations only. No runtime, no Firestore, no UI.
 * They are consumed by the pure adapters in `./adapters` that translate the
 * current app/Firestore shapes into this domain vocabulary. Persistence still
 * uses the existing Firestore shapes; nothing here changes how data is stored.
 */

// ──────────────────────────────────────────────
// Enums (string-literal unions mirroring the DBML)
// ──────────────────────────────────────────────

/** Scheduling flow of an event. Separate from discipline/category. */
export type EventType =
  | 'class'
  | 'self_posted_training'
  | 'tournament'
  | 'seminar'
  | 'absence'
  | 'other';

/** Lifecycle status of an occurrence. */
export type EventStatus =
  | 'draft'
  | 'scheduled'
  | 'cancelled'
  | 'completed'
  | 'archived';

/** Visibility/sharing boundary. */
export type Visibility = 'private' | 'shared' | 'organization' | 'public';

/** How participation is collected for an event. */
export type ParticipationMode =
  | 'none'
  | 'open_signup'
  | 'invite_only'
  | 'invite_with_response';

/** A user's response/status for a series or occurrence. */
export type ParticipationStatus =
  | 'needs_action'
  | 'accepted'
  | 'tentative'
  | 'declined'
  | 'enrolled'
  | 'waitlisted'
  | 'attended'
  | 'no_show'
  | 'cancelled';

/** Planning status of an occurrence on a specific calendar. */
export type CalendarEntryStatus =
  | 'planned'
  | 'tentative'
  | 'skipped'
  | 'completed'
  | 'cancelled';

// ──────────────────────────────────────────────
// Recurrence (structured / app-native — NOT RRULE)
// ──────────────────────────────────────────────

/**
 * One recurring weekly timeslot, preserved from the current
 * `CatalogueClass.schedules` shape in a clearer domain form.
 */
export interface SeriesSchedule {
  /** 1=Mon … 7=Sun (ISO 8601). */
  dayOfWeek: number;
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" */
  endTime: string;
}

/**
 * Structured, app-native recurrence description for Phase 1.
 * RRULE serialization is intentionally deferred to a later phase.
 */
export interface Recurrence {
  /** One entry per recurring weekly timeslot. */
  schedules: SeriesSchedule[];
  /** Interval in weeks (1 = weekly, 2 = bi-weekly …). Optional; app default is weekly. */
  intervalWeeks?: number;
}

// ──────────────────────────────────────────────
// Core entities
// ──────────────────────────────────────────────

/** The recurring/source definition for repeated events. */
export interface EventSeries {
  id: string;
  type: EventType;
  title: string;
  /** Training content, e.g. "MMA", "BJJ". Separate from `type`. */
  discipline?: string;
  location?: string;
  address?: string;
  /** Structured recurrence (schedules/timeslots), not an RRULE string. */
  recurrence?: Recurrence;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** One concrete scheduled event in time. */
export interface EventOccurrence {
  id: string;
  /** May be null: one-off events need no artificial parent series. */
  seriesId: string | null;
  type: EventType;
  title: string;
  discipline?: string;
  /** ISO 8601 datetime. */
  startDateTime: string;
  /** ISO 8601 datetime. */
  endDateTime: string;
  location?: string;
  address?: string;
  status: EventStatus;
  /** True once an EventLog exists — protects against hard delete (Phase 2). */
  hasLogs?: boolean;
  /** True when this occurrence overrides its series (Phase 4). */
  isSeriesException?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** The appearance of an occurrence on a specific calendar (planning data). */
export interface CalendarEntry {
  id: string;
  occurrenceId: string;
  userId?: string;
  calendarId?: string;
  status: CalendarEntryStatus;
  personalTitle?: string;
  personalNote?: string;
  personalFocus?: string;
  reminderMinutesBefore?: number;
}

// ──────────────────────────────────────────────
// Participation & logging (declared for later phases; no adapters yet)
// ──────────────────────────────────────────────

/** A user's response/intention for a whole recurring series. */
export interface SeriesParticipation {
  id: string;
  seriesId: string;
  userId: string;
  invitedByUserId?: string;
  status: ParticipationStatus;
  role?: string;
  responseNote?: string;
}

/** A user's response/status for one concrete occurrence. */
export interface OccurrenceParticipation {
  id: string;
  occurrenceId: string;
  userId: string;
  invitedByUserId?: string;
  status: ParticipationStatus;
  role?: string;
  responseNote?: string;
  source?: string;
}

// ──────────────────────────────────────────────
// Optional log provenance (Phase 3 calendar-originated slice)
// ──────────────────────────────────────────────

/**
 * Optional provenance recorded when a log is created from an existing legacy
 * calendar session, instead of the standalone unplanned-training entry point.
 * Provenance only: optional, and never required to render or understand the
 * log — the `CompletedSelfPostedTrainingLog` snapshot fields (title,
 * discipline, date/time, location, notes, intensity) remain self-sufficient
 * on their own. Absent entirely on standalone logs; existing standalone logs
 * remain valid without it.
 *
 * `sessionId` identifies the legacy session that was logged, but is NOT
 * universally unique per occurrence: a manually materialized recurring
 * session gets a distinct id per week, but a template-seeded recurring
 * session (`templates/standard`, auto-fed per week) can carry the SAME id
 * across multiple dates. `occurrenceDateISO` is therefore a genuine identity
 * component, not merely defensive context — consumers must use `sessionId`
 * together with `occurrenceDateISO` to identify the selected occurrence, the
 * same pairing the existing activity-note key convention (`s_{date}_{id}`)
 * already relies on.
 *
 * Fighter identity is intentionally NOT included here: ownership is already
 * unambiguous from the owning `CompletedSelfPostedTrainingLog`'s Firestore
 * path (`.../users/{fighterKey}/eventLogs/{id}`), so duplicating it into
 * provenance would be redundant.
 */
export interface SelfPostedCalendarSessionOrigin {
  type: 'self_posted_calendar_session';
  sessionId: string;
  occurrenceDateISO: string;
}

/**
 * Provenance recorded when a log is created from a separately persisted
 * new-model `NewModelCalendarAggregate` (Checkpoint A — see
 * `/docs/fightweek_refactoring_plan.md`). `calendarEntryId` is deliberately
 * omitted: the aggregate id already uniquely identifies the owning document,
 * and the occurrence id is the identity that matters for association, so a
 * third id would be redundant. Fighter identity is omitted for the same
 * reason as the legacy variant above (ownership is already unambiguous from
 * the log's own Firestore path).
 */
export interface NewModelCalendarEntryOrigin {
  type: 'new_model_calendar_entry';
  aggregateId: string;
  occurrenceId: string;
}

/** Provenance recorded when a log originates from an existing calendar entry — either the legacy per-week session or a new-model aggregate. */
export type TrainingLogOrigin = SelfPostedCalendarSessionOrigin | NewModelCalendarEntryOrigin;

/** The fighter's journal/log for what actually happened. Protected data. */
export interface EventLog {
  id: string;
  occurrenceId: string;
  calendarEntryId?: string;
  userId: string;
  attended?: boolean;
  actualStartDateTime?: string;
  actualEndDateTime?: string;
  intensity?: number;
  energy?: number;
  discipline?: string;
  focus?: string;
  notes?: string;
  injuries?: string;
}

// ──────────────────────────────────────────────
// Self-contained logs (Phase 3 active slice: "Log completed self-posted
// training" — see /docs/fightweek_refactoring_plan.md)
// ──────────────────────────────────────────────

/**
 * A self-contained "completed self-posted training" record.
 *
 * Bundles an `EventOccurrence` **snapshot** (title/discipline/start/end/
 * location at logging time, not a live reference), its `CalendarEntry`
 * reference/lifecycle context, and the `EventLog` itself, so the record
 * remains understandable without looking up a live occurrence or calendar
 * entry elsewhere. This is what lets a chronological history view render
 * correctly even if the originating calendar entry is later hidden/removed.
 *
 * IMPORTANT: the existence of this record means the user explicitly
 * registered the training as completed. It is NOT the same as an ordinary
 * note/comment on a calendar entry — a note is not proof that training
 * happened (see "Domain clarification: notes/comments vs logs" in the
 * refactoring plan). This type must not be reused to imply that.
 */
export interface CompletedSelfPostedTrainingLog {
  id: string;
  /** Snapshot of occurrence context at logging time (not a live reference). */
  occurrence: EventOccurrence;
  /** Calendar-entry-style reference/lifecycle context. */
  calendarEntry: CalendarEntry;
  /** What actually happened. */
  log: EventLog;
  /** Optional — present only when created from an existing calendar session. */
  origin?: TrainingLogOrigin;
  createdAt: string;
  updatedAt: string;
}

/**
 * Duration/end certainty for a rendered `TrainingHistoryItem`, produced by
 * the TrainingLog compatibility read adapter (see
 * `./trainingLogSnapshotCompatibility.ts`). Absent on an item means it was
 * NOT produced by that adapter (e.g. a direct `logToHistoryItem` caller) —
 * treat duration/end as exact, matching prior behaviour unchanged.
 * `'ambiguous'` means the persisted end cannot be mapped back to a local
 * historical end/duration without unavailable writer-timezone information
 * (see `/docs/fightweek_decisions.md` §24) — this is not data corruption.
 */
export type TrainingLogDurationCertainty = 'exact' | 'ambiguous' | 'unavailable';

/** A render-ready row for the chronological training history view. */
export interface TrainingHistoryItem {
  id: string;
  title: string;
  type: EventType;
  discipline?: string;
  startDateTime: string;
  /** Present only when `durationCertainty` is `'exact'` (or the item predates the compatibility adapter). */
  endDateTime?: string;
  /** Present only when `durationCertainty` is `'exact'` (or the item predates the compatibility adapter). */
  durationMinutes?: number;
  durationCertainty?: TrainingLogDurationCertainty;
  location?: string;
  notes: string;
  intensity?: number;
}

// ──────────────────────────────────────────────
// New-model calendar aggregate (Checkpoint A — pure types only, no
// persistence/hooks/UI; see /docs/fightweek_refactoring_plan.md)
// ──────────────────────────────────────────────

/**
 * A separately persisted new-model calendar record: a Firestore-native
 * embedding of an `EventOccurrence` and a `CalendarEntry` that keeps the two
 * concepts conceptually distinct (occurrence = scheduled atom, calendarEntry
 * = its appearance/planning context) even though both live in one document.
 *
 * Distinct from `CompletedSelfPostedTrainingLog`: this aggregate is the
 * calendar/planning source of truth, while the log remains its own
 * self-contained historical snapshot. Deleting or editing this aggregate
 * must never delete or mutate a `TrainingLog` that references it.
 */
export interface NewModelCalendarAggregate {
  id: string;
  userId: string;
  occurrence: EventOccurrence;
  calendarEntry: CalendarEntry;
  createdAt: string;
  updatedAt: string;
  /** Always 1 in Checkpoint A — reserved for future prospective schema evolution. */
  schemaVersion: 1;
  /**
   * The paired `CompletedSelfPostedTrainingLog.id` created atomically with
   * this aggregate (Checkpoint B). Required, immutable — equals
   * `UnplannedTrainingCreationIds.logRecordId`. Enables bilateral Firestore
   * pair-integrity validation; it is a co-persistence identity reference,
   * not a general one-log-per-occurrence uniqueness mechanism.
   */
  logRecordId: string;
}

/**
 * Read-only projection of a `NewModelCalendarAggregate` into the minimum
 * shape the current calendar UI (`PersonalSchedule`/`MobileScrollView`/
 * `SearchOverlay`) needs to render a card. Deliberately NOT `TrainingSession`
 * — that type carries legacy edit/delete/save semantics this projection must
 * never imply. `readOnly` is always `true`: this slice creates no editing
 * path for the projected entry.
 */
export interface ProjectedNewModelCalendarEntry {
  type: 'calendar_entry';
  readOnly: true;
  aggregateId: string;
  occurrenceId: string;
  calendarEntryId: string;
  name: string;
  category: string;
  start: string;
  end: string;
  location?: string;
  status: 'active' | 'cancelled';
}
