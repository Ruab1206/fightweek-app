/**
 * seriesEditScopeEligibility — foundation-only application-owned eligibility
 * contract for "Denne og alle fremtidige træninger" (this-and-following) on a
 * self-posted recurring occurrence. Single source of truth so SessionModal's
 * own button gating and the `calendarItemDetail` projection's
 * `recurringEditScope` capability cannot independently drift once the UI is
 * wired in a later, separately-approved outcome (this slice does NOT wire
 * either consumer). Pure; takes `todayISO` as an explicit input rather than
 * reading a clock, matching the existing pure-planner convention.
 *
 * Approved PO decisions this encodes:
 *  1. This-and-following is available only when the occurrence date is today
 *     or in the future. A historical occurrence remains eligible for
 *     "Kun denne træning" only (that path is unaffected by this function).
 *  2. A recurring occurrence without a durable `seriesId` (legacy,
 *     tuple-matched) is never eligible for this-and-following — no seriesId
 *     is migrated or inferred here or anywhere downstream.
 */

export type ThisAndFollowingIneligibleReason =
  | 'not_recurring'
  | 'historical'
  | 'no_durable_series';

export type ThisAndFollowingEligibility =
  | { eligible: true }
  | { eligible: false; reason: ThisAndFollowingIneligibleReason };

/**
 * Evaluate this-and-following eligibility for one occurrence. Historical
 * (`occurrenceDateISO < todayISO`) is checked before durable-series presence,
 * so a past legacy occurrence reports `'historical'` rather than
 * `'no_durable_series'` — "must not offer" takes precedence over the
 * legacy-capability explanation.
 */
export function evaluateThisAndFollowingEligibility(params: {
  isRecurring: boolean;
  seriesId?: string;
  occurrenceDateISO: string;
  todayISO: string;
}): ThisAndFollowingEligibility {
  const { isRecurring, seriesId, occurrenceDateISO, todayISO } = params;
  if (!isRecurring) return { eligible: false, reason: 'not_recurring' };
  if (occurrenceDateISO < todayISO) return { eligible: false, reason: 'historical' };
  if (!seriesId) return { eligible: false, reason: 'no_durable_series' };
  return { eligible: true };
}
