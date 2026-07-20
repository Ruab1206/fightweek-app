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
