/**
 * seriesDeletePlan.test.ts — pure planner for durable series
 * delete-this-and-following (invisible isDeleted records). No Firestore, no React.
 */
import { describe, it, expect } from 'vitest';
import { planSeriesDelete, type DeleteOccurrenceInput } from './seriesDeletePlan';
import { buildEventSeriesDefinition, type EventSeriesDefinition } from './eventSeriesDefinition';

const OWNER = 'owner@x';
const SERIES = 'series-1';
const OTHER = 'series-2';
const DELETED_AT = '2026-02-01T00:00:00.000Z';

// Mondays.
const D_START = '2026-01-05';
const D2 = '2026-01-12';
const D3 = '2026-01-19';
const D4 = '2026-01-26';

function def(overrides: Partial<EventSeriesDefinition> = {}): EventSeriesDefinition {
  return {
    ...buildEventSeriesDefinition({
      seriesId: SERIES, ownerKey: OWNER, title: 'Morning MMA', discipline: 'MMA', location: 'Gym A',
      dayOfWeek: 1, startTime: '07:00', endTime: '08:30', startDate: D_START, intervalWeeks: 1, endDate: null,
      now: '2026-01-01T00:00:00.000Z',
    }),
    ...overrides,
  };
}

/** Live active same-series occurrence at a date. */
function occ(id: string, dateISO: string, extra: Partial<DeleteOccurrenceInput> = {}): DeleteOccurrenceInput {
  return { id, seriesId: SERIES, occurrenceDateISO: dateISO, status: 'active', ...extra };
}

const SELECTED = { id: 'occ-d2', seriesId: SERIES, occurrenceDateISO: D2 };

function run(p: { definition?: EventSeriesDefinition | null; selected?: any; forwardOccurrences: DeleteOccurrenceInput[]; forwardSuppressions?: any[] }) {
  return planSeriesDelete({
    definition: p.definition === undefined ? def() : p.definition,
    selected: p.selected ?? SELECTED,
    forwardOccurrences: p.forwardOccurrences,
    forwardSuppressions: p.forwardSuppressions,
    deletedAt: DELETED_AT,
  });
}

describe('planSeriesDelete — invisible deletion of forward occurrences', () => {
  it('marks selected + all future occurrences deleted and ends the definition', () => {
    const plan = run({ forwardOccurrences: [occ('occ-d2', D2), occ('occ-d3', D3), occ('occ-d4', D4)] });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.deletions.map((d) => d.occurrenceId).sort()).toEqual(['occ-d2', 'occ-d3', 'occ-d4']);
    expect(plan.deletedAt).toBe(DELETED_AT);
    expect(plan.definitionUpdate).toEqual({ seriesId: SERIES, endDateBefore: '2026-01-11', discontinued: false });
    expect(plan.counts).toEqual({ definitionUpdates: 1, deletions: 3, total: 4 });
  });

  it('has NO removals/tombstones fields — deletion is never a hard delete or cancellation', () => {
    const plan = run({ forwardOccurrences: [occ('occ-d2', D2)] });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan).not.toHaveProperty('removals');
    expect(plan).not.toHaveProperty('tombstones');
  });

  it('discontinues the definition when deleting from its first occurrence', () => {
    const plan = run({
      selected: { id: 'occ-d1', seriesId: SERIES, occurrenceDateISO: D_START },
      forwardOccurrences: [occ('occ-d1', D_START), occ('occ-d2', D2)],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.definitionUpdate).toEqual({ seriesId: SERIES, endDateBefore: null, discontinued: true });
    expect(plan.deletions.map((d) => d.occurrenceId).sort()).toEqual(['occ-d1', 'occ-d2']);
  });

  it('deletes forward occurrences regardless of prior status, and preserves isSeriesException', () => {
    const plan = run({
      forwardOccurrences: [
        occ('occ-d2', D2),
        occ('occ-d3', D3, { isSeriesException: true }),
        occ('occ-d4', D4, { status: 'cancelled' }), // a legacy cancelled forward occurrence is also deleted (hidden)
      ],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.deletions).toEqual([
      { occurrenceId: 'occ-d2', occurrenceDateISO: D2, isSeriesException: false },
      { occurrenceId: 'occ-d3', occurrenceDateISO: D3, isSeriesException: true },
      { occurrenceId: 'occ-d4', occurrenceDateISO: D4, isSeriesException: false },
    ]);
  });

  it('no Note/TrainingLog inputs exist on the planner contract', () => {
    // Type-level guarantee reflected structurally: passing only identity/state
    // still yields a full plan (no protection needed).
    const plan = run({ forwardOccurrences: [occ('occ-d2', D2)] });
    expect(plan.ok).toBe(true);
  });
});

describe('planSeriesDelete — isolation & scope', () => {
  it('never touches another series with the same tuple', () => {
    const plan = run({
      forwardOccurrences: [
        occ('occ-d2', D2),
        { id: 'sib-d2', seriesId: OTHER, occurrenceDateISO: D2, status: 'active' },
        { id: 'sib-d3', seriesId: OTHER, occurrenceDateISO: D3, status: 'active' },
      ],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.deletions.map((d) => d.occurrenceId)).toEqual(['occ-d2']);
  });

  it('preserves occurrences before the selected date', () => {
    const plan = run({ forwardOccurrences: [occ('occ-d1', D_START), occ('occ-d2', D2), occ('occ-d3', D3)] });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.deletions.map((d) => d.occurrenceId)).not.toContain('occ-d1');
  });
});

describe('planSeriesDelete — already-deleted handling (safe repeat)', () => {
  it('fails closed as already_deleted when the anchor is already an isDeleted record', () => {
    const plan = run({ forwardOccurrences: [occ('occ-d2', D2, { isDeleted: true }), occ('occ-d3', D3)] });
    expect(plan).toEqual({ ok: false, reason: 'already_deleted' });
  });

  it('skips already-deleted forward members (no re-stamp) while marking the rest', () => {
    const plan = run({ forwardOccurrences: [occ('occ-d2', D2), occ('occ-d3', D3, { isDeleted: true }), occ('occ-d4', D4)] });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.deletions.map((d) => d.occurrenceId).sort()).toEqual(['occ-d2', 'occ-d4']);
  });
});

describe('planSeriesDelete — fail closed (no partial plan)', () => {
  it('legacy occurrence without seriesId', () => {
    expect(run({ selected: { id: 'x', occurrenceDateISO: D2 }, forwardOccurrences: [] }))
      .toEqual({ ok: false, reason: 'unsupported_legacy_occurrence' });
  });

  it('invalid occurrence date', () => {
    expect(run({ selected: { id: 'x', seriesId: SERIES, occurrenceDateISO: '2026/01/12' }, forwardOccurrences: [] }))
      .toEqual({ ok: false, reason: 'invalid_occurrence_date' });
  });

  it('missing definition', () => {
    expect(run({ definition: null, forwardOccurrences: [] })).toEqual({ ok: false, reason: 'missing_definition' });
  });

  it('selected not a member of the definition', () => {
    expect(run({ definition: def({ id: OTHER }), forwardOccurrences: [occ('occ-d2', D2)] }))
      .toEqual({ ok: false, reason: 'not_series_member' });
  });

  it('selected before definition start', () => {
    expect(run({ definition: def({ startDate: D3 }), forwardOccurrences: [occ('occ-d2', D2)] }))
      .toEqual({ ok: false, reason: 'selected_before_definition_start' });
  });

  it('definition not active (discontinued)', () => {
    expect(run({ definition: def({ status: 'discontinued' }), forwardOccurrences: [occ('occ-d2', D2)] }))
      .toEqual({ ok: false, reason: 'definition_not_active' });
  });

  it('selected after a finite definition end', () => {
    expect(run({ definition: def({ endDate: '2026-01-11' }), forwardOccurrences: [occ('occ-d2', D2)] }))
      .toEqual({ ok: false, reason: 'selected_after_definition_end' });
  });

  it('selected off cadence (weekly)', () => {
    expect(run({ selected: { id: 'x', seriesId: SERIES, occurrenceDateISO: '2026-01-13' }, forwardOccurrences: [] }))
      .toEqual({ ok: false, reason: 'selected_off_cadence' });
  });

  it('accepts an on-cadence bi-weekly selection', () => {
    const plan = run({
      definition: def({ intervalWeeks: 2 }),
      selected: { id: 'occ-b', seriesId: SERIES, occurrenceDateISO: D3 }, // +14 days
      forwardOccurrences: [occ('occ-b', D3)],
    });
    expect(plan.ok).toBe(true);
  });

  it('selected occurrence not found in the forward set', () => {
    expect(run({ forwardOccurrences: [occ('occ-d3', D3)] }))
      .toEqual({ ok: false, reason: 'selected_occurrence_not_found' });
  });

  it('duplicate live same-series occurrences on one date', () => {
    expect(run({ forwardOccurrences: [occ('occ-d2', D2), occ('occ-d2-dup', D2)] }))
      .toEqual({ ok: false, reason: 'duplicate_occurrence_for_date', occurrenceDateISO: D2 });
  });

  it('a live occurrence coexisting with a suppression', () => {
    expect(run({ forwardOccurrences: [occ('occ-d2', D2), occ('occ-d3', D3)], forwardSuppressions: [{ seriesId: SERIES, occurrenceDateISO: D3 }] }))
      .toEqual({ ok: false, reason: 'conflicting_occurrence_and_suppression', occurrenceDateISO: D3 });
  });

  it('an already-deleted or cancelled occurrence + suppression is NOT a conflict', () => {
    const plan = run({
      forwardOccurrences: [occ('occ-d2', D2), occ('occ-d3', D3, { status: 'cancelled' }), occ('occ-d4', D4, { isDeleted: true })],
      forwardSuppressions: [{ seriesId: SERIES, occurrenceDateISO: D3 }, { seriesId: SERIES, occurrenceDateISO: D4 }],
    });
    expect(plan.ok).toBe(true);
  });
});
