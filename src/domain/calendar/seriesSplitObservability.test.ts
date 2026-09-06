/**
 * seriesSplitObservability.test.ts — pure feedback/diagnostic mapping for the
 * series-split App.tsx dispatch. No Firebase, no React, no persistence.
 */
import { describe, it, expect } from 'vitest';
import { describeSeriesSplitOutcome, describeThisAndFollowingIneligible } from './seriesSplitObservability';
import type { SeriesSplitPersistResult } from '../../services/seriesSplitService';

describe('describeSeriesSplitOutcome', () => {
  it('never returns a success toast for a non-ok result', () => {
    const results: SeriesSplitPersistResult[] = [
      { ok: false, kind: 'planner', reason: 'missing_definition' },
      { ok: false, kind: 'stale', reason: 'anchor_not_found' },
      { ok: false, kind: 'transaction', error: new Error('boom') },
    ];
    for (const result of results) {
      const feedback = describeSeriesSplitOutcome(result, { name: 'MMA' });
      expect(feedback.toastType).toBe('error');
    }
  });

  it('describes a successful split as success', () => {
    const feedback = describeSeriesSplitOutcome({ ok: true, newSeriesId: 'new-1', counts: { definitionUpdates: 1, definitionCreates: 1, occurrenceReparents: 2, suppressionContinuations: 0, total: 4 } }, { name: 'MMA Sparring' });
    expect(feedback.toastType).toBe('success');
    expect(feedback.diagnostic).toEqual({ path: 'series-split', outcome: 'split' });
  });

  it('describes a stale anchor distinctly from a planner rejection', () => {
    const stale = describeSeriesSplitOutcome({ ok: false, kind: 'stale', reason: 'anchor_not_found' }, { name: 'MMA' });
    const planner = describeSeriesSplitOutcome({ ok: false, kind: 'planner', reason: 'missing_definition' }, { name: 'MMA' });
    expect(stale.diagnostic.persistKind).toBe('stale');
    expect(planner.diagnostic.persistKind).toBe('planner');
    expect(stale.toastMessage).not.toBe(planner.toastMessage);
  });

  it('describes a transaction failure distinctly', () => {
    const feedback = describeSeriesSplitOutcome({ ok: false, kind: 'transaction', error: new Error('boom') }, { name: 'MMA' });
    expect(feedback.diagnostic.persistKind).toBe('transaction');
    expect(feedback.diagnostic).not.toHaveProperty('reason');
  });

  it('produces a distinct message per planner rejection reason, including unsupported_legacy_occurrence', () => {
    const reasons = [
      'missing_series_id', 'missing_definition', 'selected_before_definition_start',
      'unsupported_legacy_occurrence', 'invalid_occurrence_date',
      'conflicting_occurrence_and_suppression', 'anchor_is_deleted',
    ] as const;
    const messages = reasons.map((reason) => describeSeriesSplitOutcome({ ok: false, kind: 'planner', reason }, { name: 'MMA' }).toastMessage);
    expect(new Set(messages).size).toBe(reasons.length);
  });

  it('never includes occurrenceDateISO in the diagnostic, even for the conflict reason that used to carry one', () => {
    const feedback = describeSeriesSplitOutcome({ ok: false, kind: 'planner', reason: 'conflicting_occurrence_and_suppression', occurrenceDateISO: '2026-06-19' }, { name: 'MMA' });
    expect(feedback.diagnostic).not.toHaveProperty('occurrenceDateISO');
  });

  it('preserves a sanitized Firestore error code for a transaction failure', () => {
    const feedback = describeSeriesSplitOutcome({ ok: false, kind: 'transaction', error: { code: 'permission-denied', message: 'Missing or insufficient permissions on artifacts/production/users/sankarem00@gmail.com/eventSeries/e3d02fac' } }, { name: 'MMA' });
    expect(feedback.diagnostic.firestoreErrorCode).toBe('permission-denied');
  });

  it('falls back to "unknown" when no sanitizable Firestore error code is present', () => {
    const withoutCode = describeSeriesSplitOutcome({ ok: false, kind: 'transaction', error: new Error('boom') }, { name: 'MMA' });
    expect(withoutCode.diagnostic.firestoreErrorCode).toBe('unknown');
    const withBadCode = describeSeriesSplitOutcome({ ok: false, kind: 'transaction', error: { code: '../../etc/passwd' } }, { name: 'MMA' });
    expect(withBadCode.diagnostic.firestoreErrorCode).toBe('unknown');
  });

  it('never includes seriesId, occurrence identifiers, or raw error messages in the diagnostic', () => {
    const feedback = describeSeriesSplitOutcome(
      { ok: false, kind: 'transaction', error: { code: 'permission-denied', message: 'Missing or insufficient permissions on artifacts/production/users/sankarem00@gmail.com/eventSeries/e3d02fac' } },
      { name: 'MMA' },
    );
    expect(feedback.diagnostic).not.toHaveProperty('seriesId');
    expect(feedback.diagnostic).not.toHaveProperty('occurrenceDateISO');
    const serialized = JSON.stringify(feedback.diagnostic);
    expect(serialized).not.toMatch(/artifacts\/production|@|sankarem00|e3d02fac|password|token/i);
  });

  it('never exposes raw document paths, fighter keys, or credentials in the diagnostic', () => {
    const feedback = describeSeriesSplitOutcome({ ok: false, kind: 'transaction', error: new Error('boom') }, { name: 'MMA' });
    const serialized = JSON.stringify(feedback.diagnostic);
    expect(serialized).not.toMatch(/artifacts\/production|@|password|token/i);
  });
});

describe('describeThisAndFollowingIneligible', () => {
  it('always returns an error toast, never success, and never calls the eligibility rule itself', () => {
    for (const reason of ['not_recurring', 'historical', 'no_durable_series'] as const) {
      const feedback = describeThisAndFollowingIneligible(reason);
      expect(feedback.toastType).toBe('error');
      expect(feedback.diagnostic).toEqual({ path: 'series-split', outcome: 'ineligible', reason });
    }
  });

  it('produces a distinct message per ineligibility reason', () => {
    const messages = (['not_recurring', 'historical', 'no_durable_series'] as const).map(
      (reason) => describeThisAndFollowingIneligible(reason).toastMessage,
    );
    expect(new Set(messages).size).toBe(3);
  });
});
