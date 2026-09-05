/**
 * occurrenceSuppression — Slice 2a durable "this occurrence was removed"
 * record for one occurrence of a self-posted recurring series.
 *
 * Persisted at
 *   users/{fighterKey}/eventSeries/{seriesId}/suppressions/{occurrenceDateISO}
 * — ONE document per series occurrence, keyed by the occurrence's local date
 * so a repeated delete of the same occurrence upserts the SAME document
 * (idempotent, never a duplicate). Slice 2a only WRITES this contract; the
 * Slice 2c materializer will later consume it to avoid recreating a removed
 * occurrence. Identity is `(seriesId, occurrenceDateISO)` only — never
 * title/time/category/location (no tuple matching).
 */

export interface OccurrenceSuppression {
  seriesId: string;
  /** Local "YYYY-MM-DD" of the suppressed occurrence (matches the definition's date stepping). */
  occurrenceDateISO: string;
  reason: 'deleted';
  createdAt: string;
}

/** True when the string is a plain local calendar date safe as a Firestore doc id. */
function isPlainDateId(occurrenceDateISO: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(occurrenceDateISO);
}

/**
 * Deterministic suppression document id. A local `YYYY-MM-DD` date is a safe,
 * unique-per-weekly-occurrence Firestore document id, so it is used verbatim.
 * Any other shape is deterministically encoded (Firestore forbids `/`) while
 * `occurrenceDateISO` is always kept as an explicit field on the document.
 */
export function suppressionDocId(occurrenceDateISO: string): string {
  if (isPlainDateId(occurrenceDateISO)) return occurrenceDateISO;
  return encodeURIComponent(occurrenceDateISO).replace(/\./g, '%2E');
}

/** Build the durable suppression record. Pure. */
export function buildOccurrenceSuppression(params: {
  seriesId: string;
  occurrenceDateISO: string;
  now?: string;
}): OccurrenceSuppression {
  return {
    seriesId: params.seriesId,
    occurrenceDateISO: params.occurrenceDateISO,
    reason: 'deleted',
    createdAt: params.now ?? new Date().toISOString(),
  };
}
