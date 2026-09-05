import { describe, it, expect } from 'vitest';
import { buildEventSeriesDefinition, type EventSeriesDefinition } from './eventSeriesDefinition';
import {
  planSeriesMaterialization,
  type MaterializationOccurrenceInput,
  type MaterializationSuppressionInput,
} from './materializationPlan';

const NOW = '2026-01-01T00:00:00.000Z';
const SERIES = 'series-1';

function def(overrides: Partial<EventSeriesDefinition> = {}): EventSeriesDefinition {
  return {
    ...buildEventSeriesDefinition({
      seriesId: SERIES,
      ownerKey: 'fighter@example.com',
      title: 'Morning MMA',
      discipline: 'MMA',
      location: 'Gym A',
      dayOfWeek: 1, // Monday
      startTime: '07:00',
      endTime: '08:30',
      startDate: '2026-01-05', // Mon
      intervalWeeks: 1,
      endDate: null,
      now: NOW,
    }),
    ...overrides,
  };
}

function dates(plan: ReturnType<typeof planSeriesMaterialization>): string[] {
  if (!plan.ok) throw new Error(`expected ok plan, got ${plan.reason}`);
  return plan.generate.map((o) => o.occurrenceDateISO);
}

describe('planSeriesMaterialization — cadence', () => {
  it('steps weekly from startDate up to and including the horizon end', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-26', // 4 Mondays: 05, 12, 19, 26
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26']);
  });

  it('anchors bi-weekly cadence strictly to startDate stepping (no week parity)', () => {
    const plan = planSeriesMaterialization({
      definition: def({ intervalWeeks: 2 }),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-02-16',
    });
    // 05, +14 = 19, +14 = 02-02, +14 = 02-16
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-19', '2026-02-02', '2026-02-16']);
  });

  it('carries the definition content onto every planned occurrence', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-05',
    });
    if (!plan.ok) throw new Error('expected ok');
    expect(plan.generate[0]).toEqual({
      id: 'series_series-1_2026-01-05',
      seriesId: SERIES,
      occurrenceDateISO: '2026-01-05',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
      title: 'Morning MMA',
      discipline: 'MMA',
      location: 'Gym A',
    });
  });

  it('omits discipline/location when the definition omits them', () => {
    const bare = def();
    delete (bare as { discipline?: string }).discipline;
    delete (bare as { location?: string }).location;
    const plan = planSeriesMaterialization({
      definition: bare,
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-05',
    });
    if (!plan.ok) throw new Error('expected ok');
    expect('discipline' in plan.generate[0]).toBe(false);
    expect('location' in plan.generate[0]).toBe(false);
  });
});

describe('planSeriesMaterialization — R8 gate', () => {
  it('skips a date that already has an occurrence for this series', () => {
    const existing: MaterializationOccurrenceInput[] = [
      { id: 'occ-w2', seriesId: SERIES, occurrenceDateISO: '2026-01-12' },
    ];
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: existing,
      suppressions: [],
      horizonEndDateISO: '2026-01-26',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-19', '2026-01-26']);
    if (!plan.ok) throw new Error('expected ok');
    expect(plan.counts.existing).toBe(1);
  });

  it('skips a suppressed date (authoritative no-regeneration, R7/R8)', () => {
    const suppressions: MaterializationSuppressionInput[] = [
      { seriesId: SERIES, occurrenceDateISO: '2026-01-19' },
    ];
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [],
      suppressions,
      horizonEndDateISO: '2026-01-26',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-12', '2026-01-26']);
    if (!plan.ok) throw new Error('expected ok');
    expect(plan.counts.suppressed).toBe(1);
  });

  it('generates only dates that have NEITHER a suppression NOR an occurrence', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [{ id: 'occ-w1', seriesId: SERIES, occurrenceDateISO: '2026-01-05' }],
      suppressions: [{ seriesId: SERIES, occurrenceDateISO: '2026-01-12' }],
      horizonEndDateISO: '2026-01-26',
    });
    expect(dates(plan)).toEqual(['2026-01-19', '2026-01-26']);
    if (!plan.ok) throw new Error('expected ok');
    expect(plan.counts).toEqual({ candidates: 4, suppressed: 1, existing: 1, generate: 2 });
  });

  it('ignores blockers scoped to another series (membership by seriesId only)', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [{ id: 'occ-other-w2', seriesId: 'other', occurrenceDateISO: '2026-01-12' }],
      suppressions: [{ seriesId: 'other', occurrenceDateISO: '2026-01-19' }],
      horizonEndDateISO: '2026-01-26',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26']);
  });

  it('ignores a legacy occurrence without a seriesId (R5/R9)', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [{ id: 'legacy-1', occurrenceDateISO: '2026-01-12' }],
      suppressions: [],
      horizonEndDateISO: '2026-01-19',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19']);
  });

  it('skips an ACTIVE explicit exception occurrence for the same seriesId and date', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [
        { id: 'occ-w2-exc', seriesId: SERIES, occurrenceDateISO: '2026-01-12', isSeriesException: true, status: 'active' },
      ],
      suppressions: [],
      horizonEndDateISO: '2026-01-19',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-19']);
  });

  it('skips a CANCELLED tombstone occurrence for the same seriesId and date', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [{ id: 'occ-w2-tomb', seriesId: SERIES, occurrenceDateISO: '2026-01-12', status: 'cancelled' }],
      suppressions: [],
      horizonEndDateISO: '2026-01-19',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-19']);
  });

  it('skips a CANCELLED explicit exception occurrence for the same seriesId and date', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [
        { id: 'occ-w2-cexc', seriesId: SERIES, occurrenceDateISO: '2026-01-12', isSeriesException: true, status: 'cancelled' },
      ],
      suppressions: [],
      horizonEndDateISO: '2026-01-19',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-19']);
  });
});

describe('planSeriesMaterialization — deterministic occurrence id', () => {
  it('is derived only from (seriesId, occurrenceDateISO), stable across repeated calls', () => {
    const call = () =>
      planSeriesMaterialization({
        definition: def(),
        existingOccurrences: [],
        suppressions: [],
        horizonEndDateISO: '2026-01-05',
      });
    const first = call();
    const second = call(); // simulates a retry / reload — same inputs, new call
    if (!first.ok || !second.ok) throw new Error('expected ok');
    expect(first.generate[0].id).toBe(second.generate[0].id);
    expect(first.generate[0].id).toBe('series_series-1_2026-01-05');
  });

  it('is independent of mutable definition fields (title/time/location changes)', () => {
    const before = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-05',
    });
    const after = planSeriesMaterialization({
      definition: def({ title: 'Evening MMA', startTime: '18:00', endTime: '19:30', location: 'Gym B' }),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-05',
    });
    if (!before.ok || !after.ok) throw new Error('expected ok');
    expect(before.generate[0].id).toBe(after.generate[0].id);
  });
});

describe('planSeriesMaterialization — fail-closed conflicts', () => {
  it('fails on more than one occurrence for the same seriesId and date (E.7)', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [
        { id: 'occ-a', seriesId: SERIES, occurrenceDateISO: '2026-01-12' },
        { id: 'occ-b', seriesId: SERIES, occurrenceDateISO: '2026-01-12' },
      ],
      suppressions: [],
      horizonEndDateISO: '2026-01-19',
    });
    expect(plan).toEqual({
      ok: false,
      reason: 'duplicate_occurrence_for_date',
      occurrenceDateISO: '2026-01-12',
    });
  });

  it('fails when an ACTIVE occurrence coexists with a suppression for the same date (E.8)', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [{ id: 'occ-w2', seriesId: SERIES, occurrenceDateISO: '2026-01-12', status: 'active' }],
      suppressions: [{ seriesId: SERIES, occurrenceDateISO: '2026-01-12' }],
      horizonEndDateISO: '2026-01-19',
    });
    expect(plan).toEqual({
      ok: false,
      reason: 'active_occurrence_with_suppression',
      occurrenceDateISO: '2026-01-12',
    });
  });

  it('fails when an ACTIVE explicit exception coexists with a suppression for the same date (E.9)', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [
        { id: 'occ-w2-exc', seriesId: SERIES, occurrenceDateISO: '2026-01-12', isSeriesException: true, status: 'active' },
      ],
      suppressions: [{ seriesId: SERIES, occurrenceDateISO: '2026-01-12' }],
      horizonEndDateISO: '2026-01-19',
    });
    expect(plan).toEqual({
      ok: false,
      reason: 'active_occurrence_with_suppression',
      occurrenceDateISO: '2026-01-12',
    });
  });

  it('treats a CANCELLED occurrence plus a suppression as valid — no conflict, preserved, skipped', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [{ id: 'occ-w2-tomb', seriesId: SERIES, occurrenceDateISO: '2026-01-12', status: 'cancelled' }],
      suppressions: [{ seriesId: SERIES, occurrenceDateISO: '2026-01-12' }],
      horizonEndDateISO: '2026-01-19',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-19']);
    if (!plan.ok) throw new Error('expected ok');
    expect(plan.counts.suppressed).toBe(1);
  });

  it('treats a CANCELLED explicit exception plus a suppression as valid — no conflict', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [
        { id: 'occ-w2-cexc', seriesId: SERIES, occurrenceDateISO: '2026-01-12', isSeriesException: true, status: 'cancelled' },
      ],
      suppressions: [{ seriesId: SERIES, occurrenceDateISO: '2026-01-12' }],
      horizonEndDateISO: '2026-01-19',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-19']);
  });

  it('fails when a FOREIGN series occurrence occupies our deterministic target id (E.10)', () => {
    const foreignId = 'series_series-1_2026-01-12'; // == materializedOccurrenceId(SERIES, '2026-01-12')
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [{ id: foreignId, seriesId: 'other-series', occurrenceDateISO: '2026-01-12' }],
      suppressions: [],
      horizonEndDateISO: '2026-01-19',
    });
    expect(plan).toEqual({
      ok: false,
      reason: 'deterministic_id_conflict_foreign_series',
      occurrenceDateISO: '2026-01-12',
    });
  });

  it('fails when an occurrence claims our deterministic id but an incompatible date (E.11)', () => {
    // This occurrence's own date (01-12) differs from the date whose target id it holds (01-19).
    const corruptedId = 'series_series-1_2026-01-19'; // == materializedOccurrenceId(SERIES, '2026-01-19')
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [{ id: corruptedId, seriesId: SERIES, occurrenceDateISO: '2026-01-12' }],
      suppressions: [],
      horizonEndDateISO: '2026-01-19',
    });
    expect(plan).toEqual({
      ok: false,
      reason: 'deterministic_id_conflict_incompatible_date',
      occurrenceDateISO: '2026-01-19',
    });
  });

  it('a failed result never contains a partial generate list', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [
        { id: 'occ-a', seriesId: SERIES, occurrenceDateISO: '2026-01-12' },
        { id: 'occ-b', seriesId: SERIES, occurrenceDateISO: '2026-01-12' },
      ],
      suppressions: [],
      horizonEndDateISO: '2026-01-26',
    });
    expect(plan.ok).toBe(false);
    expect('generate' in plan).toBe(false);
    expect('counts' in plan).toBe(false);
  });
});

describe('planSeriesMaterialization — window bounds', () => {
  it('caps an open-ended series at the injected horizon, never beyond', () => {
    const plan = planSeriesMaterialization({
      definition: def({ endDate: null }),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-11', // between Mon 05 and Mon 12
    });
    expect(dates(plan)).toEqual(['2026-01-05']);
  });

  it('stops at endDate when it precedes the horizon', () => {
    const plan = planSeriesMaterialization({
      definition: def({ endDate: '2026-01-12' }),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-03-01',
    });
    expect(dates(plan)).toEqual(['2026-01-05', '2026-01-12']);
  });

  it('includes an occurrence exactly on the endDate boundary (inclusive)', () => {
    const plan = planSeriesMaterialization({
      definition: def({ endDate: '2026-01-19' }),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-03-01',
    });
    expect(dates(plan)).toContain('2026-01-19');
  });

  it('produces nothing when the horizon precedes the startDate', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-01',
    });
    expect(dates(plan)).toEqual([]);
  });
});

describe('planSeriesMaterialization — validation (fail closed)', () => {
  it('fails on a missing definition', () => {
    const plan = planSeriesMaterialization({
      definition: null,
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-26',
    });
    expect(plan).toEqual({ ok: false, reason: 'missing_definition' });
  });

  it('fails on a discontinued series', () => {
    const plan = planSeriesMaterialization({
      definition: def({ status: 'discontinued' }),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-26',
    });
    expect(plan).toEqual({ ok: false, reason: 'discontinued_series' });
  });

  it('fails on a non-positive interval', () => {
    const plan = planSeriesMaterialization({
      definition: def({ intervalWeeks: 0 }),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-26',
    });
    expect(plan).toEqual({ ok: false, reason: 'invalid_interval' });
  });

  it('fails when startDate weekday does not match dayOfWeek', () => {
    // 2026-01-05 is a Monday; claim Tuesday (2) to force a mismatch.
    const plan = planSeriesMaterialization({
      definition: def({ dayOfWeek: 2 }),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-26',
    });
    expect(plan).toEqual({ ok: false, reason: 'start_weekday_mismatch' });
  });

  it('fails on a malformed horizon date', () => {
    const plan = planSeriesMaterialization({
      definition: def(),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-1-5',
    });
    expect(plan).toEqual({ ok: false, reason: 'invalid_horizon' });
  });

  it('fails on a malformed endDate', () => {
    const plan = planSeriesMaterialization({
      definition: def({ endDate: 'not-a-date' }),
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: '2026-01-26',
    });
    expect(plan).toEqual({ ok: false, reason: 'invalid_end_date' });
  });
});
