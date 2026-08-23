/**
 * trainingLogSnapshotCompatibility — ambiguity-preserving TrainingLog read
 * adapter (canonical contract Section I step 3a-read; see
 * `/docs/fightweek_decisions.md` §24 and
 * `/docs/self_posted_lifecycle_and_invariants.md` Section E).
 *
 * This is a READ-SIDE correction, not persisted snapshot normalization: it
 * never mutates a `CompletedSelfPostedTrainingLog`, never writes anything,
 * and never claims a legacy UTC-Z/offset end can be converted to a specific
 * historical local end or duration. A recoverability investigation proved
 * that conversion is reader-runtime-timezone-dependent and not deterministic
 * (no writer timezone/offset/independent duration was ever persisted), so
 * this adapter preserves that ambiguity instead of inventing a writer
 * timezone or using the current runtime timezone as historical meaning.
 *
 * Pure — no Firestore, no React, no side effects.
 */
import { logToHistoryItem } from './selfPostedTraining';
import type { CompletedSelfPostedTrainingLog, TrainingHistoryItem } from './types';

// ──────────────────────────────────────────────
// Pure datetime classifier
// ──────────────────────────────────────────────

export type TrainingLogDateTimeFormat = 'local' | 'absolute' | 'invalid';

/** Offset-free local wall-clock: the format every current writer produces for `startDateTime` and an explicit `end`. */
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
/** Absolute/offset instant: trailing `Z` or an explicit numeric UTC offset, optionally with milliseconds. */
const ABSOLUTE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Classify a persisted datetime string's format. Never parses the string
 * into a runtime-timezone-dependent instant — classification only.
 */
export function classifyTrainingLogDateTimeFormat(value: string | undefined): TrainingLogDateTimeFormat {
  if (typeof value !== 'string' || value.length === 0) return 'invalid';
  if (LOCAL_DATETIME_RE.test(value)) return 'local';
  if (ABSOLUTE_DATETIME_RE.test(value)) return 'absolute';
  return 'invalid';
}

interface LocalDateTimeComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Parse an already-classified `'local'` datetime string into its wall-clock components. Returns `null` if malformed. */
function parseLocalComponents(value: string): LocalDateTimeComponents | null {
  const match = LOCAL_DATETIME_RE.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value) ?? [];
  if (y === undefined) return null;
  return {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi),
    second: s !== undefined ? Number(s) : 0,
  };
}

/**
 * Timezone-independent wall-clock arithmetic: treats the parsed components
 * as if they were UTC (which has no DST) purely to get a comparable
 * instant — never calls `new Date(string)` on the original values, so the
 * result never depends on the runtime/browser/device timezone. Correctly
 * supports midnight crossing (date components differ) and DST-boundary
 * wall-clock fields (no DST rule is ever applied).
 */
function wallClockDiffMinutes(start: LocalDateTimeComponents, end: LocalDateTimeComponents): number {
  const startMs = Date.UTC(start.year, start.month - 1, start.day, start.hour, start.minute, start.second);
  const endMs = Date.UTC(end.year, end.month - 1, end.day, end.hour, end.minute, end.second);
  return Math.round((endMs - startMs) / 60000);
}

// ──────────────────────────────────────────────
// Compatibility adapter
// ──────────────────────────────────────────────

/** Build a `TrainingHistoryItem` without `endDateTime`/`durationMinutes`, tagged with the given certainty. */
function withoutEndAndDuration(
  base: TrainingHistoryItem,
  durationCertainty: 'ambiguous' | 'unavailable',
): TrainingHistoryItem {
  const { endDateTime: _endDateTime, durationMinutes: _durationMinutes, ...rest } = base;
  return { ...rest, durationCertainty };
}

/**
 * Build the ambiguity-preserving compatibility read model for one persisted
 * `CompletedSelfPostedTrainingLog`, for any supported shape (standalone,
 * `self_posted_calendar_session`, or `new_model_calendar_entry` — provenance
 * is never consulted here; see below). Does not mutate `record`, requires no
 * source occurrence/CalendarEntry document, and ignores `occurrence.hasLogs`
 * (transitional, not historical truth) and a missing embedded
 * `calendarEntry.userId` (ownership is the Firestore path, not the
 * snapshot). Title/discipline/location/notes/intensity are always
 * preserved, even when time is unavailable.
 *
 * Start is always rendered as the deterministic wall-clock value already
 * persisted (`base.startDateTime`, unchanged).
 *
 * End/duration:
 * - both `start` and `end` are offset-free local strings → `'exact'`:
 *   computed via timezone-independent wall-clock arithmetic (no `new
 *   Date()` diffing across mixed formats).
 * - `end` is a UTC-Z/offset-bearing instant → `'ambiguous'`: no local end or
 *   duration is derived or guessed.
 * - `end` is missing/malformed, or the exact computation is negative (a
 *   local-local anomaly, never a timezone artifact of this arithmetic) →
 *   `'unavailable'`.
 *
 * `origin`/provenance is never read here — interpretation is driven only by
 * the persisted datetime's own format (I11: provenance is association
 * metadata only).
 */
export function buildTrainingLogHistoryItem(record: CompletedSelfPostedTrainingLog): TrainingHistoryItem {
  const base = logToHistoryItem(record);

  const startFormat = classifyTrainingLogDateTimeFormat(base.startDateTime);
  if (startFormat !== 'local') {
    return withoutEndAndDuration(base, 'unavailable');
  }

  const endFormat = classifyTrainingLogDateTimeFormat(base.endDateTime);
  if (endFormat === 'absolute') {
    return withoutEndAndDuration(base, 'ambiguous');
  }
  if (endFormat !== 'local') {
    return withoutEndAndDuration(base, 'unavailable');
  }

  const startComponents = parseLocalComponents(base.startDateTime);
  const endComponents = parseLocalComponents(base.endDateTime as string);
  if (!startComponents || !endComponents) {
    return withoutEndAndDuration(base, 'unavailable');
  }

  const durationMinutes = wallClockDiffMinutes(startComponents, endComponents);
  if (durationMinutes < 0) {
    return withoutEndAndDuration(base, 'unavailable');
  }

  return { ...base, durationMinutes, durationCertainty: 'exact' };
}
