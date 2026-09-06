/**
 * durableDeleteObservability.test.ts — distinguishability contract for the
 * durable-vs-legacy dispatch classifier and the durable delete outcome-to-
 * feedback mapping (see durableDeleteObservability.ts for the rationale).
 */
import { describe, it, expect } from 'vitest';
import {
  classifyDeleteThisAndFollowingDispatch,
  describeDurableDeleteOutcome,
} from './durableDeleteObservability';
import type { SeriesDeleteFailureReason } from './seriesDeletePlan';
import type { DurableSeriesDeleteOutcome } from './durableSeriesDeleteFlow';
import type { SeriesDeletePersistResult } from '../../services/seriesDeleteService';

describe('classifyDeleteThisAndFollowingDispatch', () => {
  it('durable: seriesId present, no catalogueClassId', () => {
    expect(classifyDeleteThisAndFollowingDispatch({ seriesId: 's1' })).toBe('durable');
  });
  it('legacy: no seriesId at all', () => {
    expect(classifyDeleteThisAndFollowingDispatch({})).toBe('legacy');
    expect(classifyDeleteThisAndFollowingDispatch(null)).toBe('legacy');
    expect(classifyDeleteThisAndFollowingDispatch(undefined)).toBe('legacy');
  });
  it('legacy: seriesId present but catalogueClassId also present (defensive — matches App.tsx gate exactly)', () => {
    expect(classifyDeleteThisAndFollowingDispatch({ seriesId: 's1', catalogueClassId: 'c1' })).toBe('legacy');
  });
});

const ALL_REASONS: SeriesDeleteFailureReason[] = [
  'unsupported_legacy_occurrence',
  'invalid_occurrence_date',
  'missing_definition',
  'not_series_member',
  'selected_before_definition_start',
  'definition_not_active',
  'selected_after_definition_end',
  'selected_off_cadence',
  'selected_occurrence_not_found',
  'already_deleted',
  'duplicate_occurrence_for_date',
  'conflicting_occurrence_and_suppression',
];

function plannerRejection(reason: SeriesDeleteFailureReason): SeriesDeletePersistResult {
  return { ok: false, kind: 'planner', reason, occurrenceDateISO: '2026-09-07' };
}
function transactionRejection(): SeriesDeletePersistResult {
  return { ok: false, kind: 'transaction', error: new Error('permission-denied') };
}

describe('describeDurableDeleteOutcome — never presents a failed persist as success', () => {
  it('every planner-rejection reason produces an error toast, never success', () => {
    for (const reason of ALL_REASONS) {
      const outcome: DurableSeriesDeleteOutcome<SeriesDeletePersistResult> = { kind: 'delete_failed', result: plannerRejection(reason) };
      const feedback = describeDurableDeleteOutcome(outcome, { name: 'Morning MMA', seriesId: 's1' });
      expect(feedback.toastType).toBe('error');
      expect(feedback.diagnostic.reason).toBe(reason);
      expect(feedback.diagnostic.outcome).toBe('delete_failed');
      expect(feedback.diagnostic.persistKind).toBe('planner');
    }
  });

  it('a transaction-level rejection produces an error toast distinguishable from a planner rejection', () => {
    const outcome: DurableSeriesDeleteOutcome<SeriesDeletePersistResult> = { kind: 'delete_failed', result: transactionRejection() };
    const feedback = describeDurableDeleteOutcome(outcome, { name: 'Morning MMA', seriesId: 's1' });
    expect(feedback.toastType).toBe('error');
    expect(feedback.diagnostic.persistKind).toBe('transaction');
    expect(feedback.diagnostic.reason).toBeUndefined();

    const plannerFeedback = describeDurableDeleteOutcome(
      { kind: 'delete_failed', result: plannerRejection('selected_off_cadence') },
      { name: 'Morning MMA', seriesId: 's1' },
    );
    // Distinguishable: different message text and different diagnostic shape.
    expect(feedback.toastMessage).not.toBe(plannerFeedback.toastMessage);
  });

  it('a true success (kind: deleted) produces the success toast', () => {
    const outcome: DurableSeriesDeleteOutcome<SeriesDeletePersistResult> = {
      kind: 'deleted',
      result: { ok: true, counts: { definitionUpdates: 1, deletions: 2, total: 3 } },
    };
    const feedback = describeDurableDeleteOutcome(outcome, { name: 'Morning MMA' });
    expect(feedback.toastType).toBe('success');
    expect(feedback.toastMessage).toBe('Morning MMA fjernet');
    expect(feedback.diagnostic.outcome).toBe('deleted');
  });

  it('deleted_invitations_failed is a distinct partial-outcome error, not a plain success', () => {
    const outcome: DurableSeriesDeleteOutcome<SeriesDeletePersistResult> = {
      kind: 'deleted_invitations_failed',
      result: { ok: true, counts: { definitionUpdates: 1, deletions: 2, total: 3 } },
      error: new Error('invitation cancel failed'),
    };
    const feedback = describeDurableDeleteOutcome(outcome, { name: 'Morning MMA' });
    expect(feedback.toastType).toBe('error');
    expect(feedback.diagnostic.outcome).toBe('deleted_invitations_failed');
  });

  it('never returns toastType success for any delete_failed outcome, across every reason and the transaction case', () => {
    const outcomes: DurableSeriesDeleteOutcome<SeriesDeletePersistResult>[] = [
      ...ALL_REASONS.map((reason) => ({ kind: 'delete_failed' as const, result: plannerRejection(reason) })),
      { kind: 'delete_failed', result: transactionRejection() },
    ];
    for (const outcome of outcomes) {
      expect(describeDurableDeleteOutcome(outcome, { name: 'X' }).toastType).not.toBe('success');
    }
  });
});
