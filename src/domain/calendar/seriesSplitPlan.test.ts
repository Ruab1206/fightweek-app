import { describe, it, expect } from 'vitest';
import { buildEventSeriesDefinition, type EventSeriesDefinition } from './eventSeriesDefinition';
import {
  planSeriesSplit,
  type SplitOccurrenceInput,
  type SplitSuppressionInput,
  type SplitEditedFields,
} from './seriesSplitPlan';

const NOW = '2026-01-01T00:00:00.000Z';
const OLD_SERIES = 'old-series-1';
const NEW_SERIES = 'new-series-2';

function oldDef(overrides: Partial<EventSeriesDefinition> = {}): EventSeriesDefinition {
  return {
    ...buildEventSeriesDefinition({
      seriesId: OLD_SERIES,
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

const EDITED: SplitEditedFields = {
  title: 'Evening MMA',
  discipline: 'MMA',
  location: 'Gym B',
  startTime: '18:00',
  endTime: '19:30',
};

// Weekly Mondays from 2026-01-05.
const OCC: Record<string, SplitOccurrenceInput> = {
  w1: { id: 'occ-w1', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-05' },
  w2: { id: 'occ-w2', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-12' },
  w3: { id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' },
  w4: { id: 'occ-w4', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-26' },
};

describe('planSeriesSplit — normal split', () => {
  it('updates the old definition, creates a new definition, and re-parents the anchor + forward members', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, OCC.w3, OCC.w4],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    // Old definition bounded to the day before the split date, not discontinued.
    expect(plan.oldDefinitionUpdate).toEqual({
      seriesId: OLD_SERIES,
      endDateBefore: '2026-01-11',
      discontinued: false,
    });

    // New definition: new id, split-date start, edited fields, carried cadence/end.
    expect(plan.newDefinition.id).toBe(NEW_SERIES);
    expect(plan.newDefinition.startDate).toBe('2026-01-12');
    expect(plan.newDefinition.title).toBe('Evening MMA');
    expect(plan.newDefinition.location).toBe('Gym B');
    expect(plan.newDefinition.startTime).toBe('18:00');
    expect(plan.newDefinition.endTime).toBe('19:30');
    expect(plan.newDefinition.dayOfWeek).toBe(1);
    expect(plan.newDefinition.intervalWeeks).toBe(1);
    expect(plan.newDefinition.endDate).toBeNull();
    expect(plan.newDefinition.ownerKey).toBe('fighter@example.com');

    // Anchor + two forward members re-parented, ids and dates preserved.
    expect(plan.reparents.map((r) => r.occurrenceId)).toEqual(['occ-w2', 'occ-w3', 'occ-w4']);
    expect(plan.reparents.map((r) => r.occurrenceDateISO)).toEqual(['2026-01-12', '2026-01-19', '2026-01-26']);
    for (const r of plan.reparents) {
      expect(r.fromSeriesId).toBe(OLD_SERIES);
      expect(r.toSeriesId).toBe(NEW_SERIES);
      expect(r.fields).toEqual(EDITED);
    }
    expect(plan.counts).toEqual({
      definitionUpdates: 1,
      definitionCreates: 1,
      occurrenceReparents: 3,
      suppressionContinuations: 0,
      total: 5,
    });
  });

  it('does not re-parent past occurrences (before the split date)', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w3,
      edited: EDITED,
      forwardOccurrences: [OCC.w1, OCC.w2, OCC.w3, OCC.w4],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.reparents.map((r) => r.occurrenceId)).toEqual(['occ-w3', 'occ-w4']);
    expect(plan.oldDefinitionUpdate.endDateBefore).toBe('2026-01-18');
  });

  it('discontinues the old series when the anchor is its own first occurrence', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w1,
      edited: EDITED,
      forwardOccurrences: [OCC.w1, OCC.w2, OCC.w3, OCC.w4],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.oldDefinitionUpdate).toEqual({
      seriesId: OLD_SERIES,
      endDateBefore: null,
      discontinued: true,
    });
    expect(plan.reparents).toHaveLength(4);
  });
});

describe('planSeriesSplit — exception anchor', () => {
  it('allows an exception occurrence as anchor and clears its exception flag', () => {
    const anchor: SplitOccurrenceInput = {
      id: 'occ-w2',
      seriesId: OLD_SERIES,
      occurrenceDateISO: '2026-01-12',
      isSeriesException: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: anchor,
      edited: EDITED,
      forwardOccurrences: [anchor, OCC.w3],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const anchorOp = plan.reparents.find((r) => r.occurrenceId === 'occ-w2');
    expect(anchorOp).toBeDefined();
    expect(anchorOp?.clearedException).toBe(true);
    expect(anchorOp?.toSeriesId).toBe(NEW_SERIES);
  });
});

describe('planSeriesSplit — active future exception is re-parented with fields preserved', () => {
  it('re-parents a future active exception to the new series, preserving isSeriesException and never applying the submitted edit to its content', () => {
    const futureException: SplitOccurrenceInput = {
      id: 'occ-w3',
      seriesId: OLD_SERIES,
      occurrenceDateISO: '2026-01-19',
      isSeriesException: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, futureException, OCC.w4],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.reparents.map((r) => r.occurrenceId)).toEqual(['occ-w2', 'occ-w3', 'occ-w4']);
    const exceptionOp = plan.reparents.find((r) => r.occurrenceId === 'occ-w3');
    expect(exceptionOp).toMatchObject({ fromSeriesId: OLD_SERIES, toSeriesId: NEW_SERIES, clearedException: false, preserveExistingFields: true });
    expect(exceptionOp?.fields).toBeUndefined();
    // The input object itself is never mutated by the planner.
    expect(futureException).toEqual({
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', isSeriesException: true,
    });
  });

  it('never produces a suppression continuation for a re-parented active exception', () => {
    const futureException: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', isSeriesException: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, futureException],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([]);
  });
});

describe('planSeriesSplit — cancelled occurrences are untouched', () => {
  it('leaves a future cancelled occurrence on the original series, unmodified, and not re-parented', () => {
    const cancelled: SplitOccurrenceInput = {
      id: 'occ-w3',
      seriesId: OLD_SERIES,
      occurrenceDateISO: '2026-01-19',
      status: 'cancelled',
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, cancelled, OCC.w4],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    // Not re-parented — the input object itself is never touched by the planner.
    expect(plan.reparents.map((r) => r.occurrenceId)).toEqual(['occ-w2', 'occ-w4']);
    expect(cancelled).toEqual({
      id: 'occ-w3',
      seriesId: OLD_SERIES,
      occurrenceDateISO: '2026-01-19',
      status: 'cancelled',
    });
  });
});

describe('planSeriesSplit — cancelled-occurrence suppression continuity', () => {
  it('produces exactly one new-series continuity op for a future cancelled occurrence', () => {
    const cancelled: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', status: 'cancelled',
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, cancelled],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-19' } },
    ]);
    // Not re-parented, and no reparent op emitted for the cancelled date.
    expect(plan.reparents.find((r) => r.occurrenceDateISO === '2026-01-19')).toBeUndefined();
  });

  it('produces no continuity op for a past cancelled occurrence', () => {
    const pastCancelled: SplitOccurrenceInput = {
      id: 'occ-w1', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-05', status: 'cancelled',
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [pastCancelled, OCC.w2],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([]);
  });

  it('produces exactly one continuity op for a future occurrence that is both cancelled and isSeriesException', () => {
    const cancelledException: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19',
      status: 'cancelled', isSeriesException: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, cancelledException],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-19' } },
    ]);
    expect(plan.reparents.find((r) => r.occurrenceDateISO === '2026-01-19')).toBeUndefined();
  });

  it('produces no continuity op for an active (non-cancelled) future exception', () => {
    const activeException: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', isSeriesException: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, activeException],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([]);
  });

  it('produces exactly one new-series continuity op when a cancelled occurrence already has an old-series suppression for the same date (no duplicate)', () => {
    const cancelled: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', status: 'cancelled',
    };
    const existingSuppression: SplitSuppressionInput = { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, cancelled],
      forwardSuppressions: [existingSuppression],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-19' } },
    ]);
    expect(plan.counts.suppressionContinuations).toBe(1);
  });

  it('does not duplicate a new-series suppression when multiple inputs reference the same date', () => {
    // Two independent signals for the SAME date: an existing suppression record
    // and a cancelled occurrence — must collapse to exactly one continuity op.
    const cancelled: SplitOccurrenceInput = {
      id: 'occ-w4', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-26', status: 'cancelled',
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, cancelled],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-26' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const forDate = plan.suppressionContinuations.filter((c) => c.to.occurrenceDateISO === '2026-01-26');
    expect(forDate).toHaveLength(1);
  });

  it('treats a cancelled exception plus an existing suppression as valid, producing exactly one continuity op', () => {
    const cancelledException: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19',
      status: 'cancelled', isSeriesException: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, cancelledException],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-19' } },
    ]);
    expect(plan.reparents.find((r) => r.occurrenceDateISO === '2026-01-19')).toBeUndefined();
  });
});

describe('planSeriesSplit — conflicting occurrence and suppression (fail closed)', () => {
  it('fails closed when a clean active occurrence has a same-date suppression', () => {    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, OCC.w3],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, reason: 'conflicting_occurrence_and_suppression', occurrenceDateISO: '2026-01-19' });
  });

  it('fails closed when an active exception has a same-date suppression', () => {
    const activeException: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', isSeriesException: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, activeException],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, reason: 'conflicting_occurrence_and_suppression', occurrenceDateISO: '2026-01-19' });
  });

  it('produces no old-definition update, no new definition, no reparents, and no continuations on conflict', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, OCC.w3],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(false);
    expect(plan).not.toHaveProperty('oldDefinitionUpdate');
    expect(plan).not.toHaveProperty('newDefinition');
    expect(plan).not.toHaveProperty('reparents');
    expect(plan).not.toHaveProperty('suppressionContinuations');
  });

  it('does not fail closed when a cancelled occurrence has a same-date suppression (valid combination)', () => {
    const cancelled: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', status: 'cancelled',
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, cancelled],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
  });

  it('does not fail closed for a past clean occurrence sharing a date with a past suppression (out of the plan\'s write set)', () => {
    const pastOcc: SplitOccurrenceInput = { id: 'occ-w1', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-05' };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [pastOcc, OCC.w2],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-05' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
  });

  it('never produces both a re-parent and a suppression continuation for the same new-series date across mixed valid input', () => {
    const cancelled: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', status: 'cancelled',
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, cancelled, OCC.w4],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const reparentDates = new Set(plan.reparents.map((r) => r.occurrenceDateISO));
    const continuationDates = new Set(plan.suppressionContinuations.map((c) => c.to.occurrenceDateISO));
    for (const d of reparentDates) expect(continuationDates.has(d)).toBe(false);
    for (const d of continuationDates) expect(reparentDates.has(d)).toBe(false);
  });
});

describe('planSeriesSplit — suppression continuity', () => {
  it('carries forward suppressions to the new series, leaves past suppressions, and loses none', () => {
    // Suppressed dates have no stored occurrence (rule 5) — only the anchor
    // (w2, unsuppressed) is passed as a stored occurrence.
    const suppressions: SplitSuppressionInput[] = [
      { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-05' }, // past — stays on old
      { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, // future — continues
      { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-26' }, // future — continues
    ];
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2],
      forwardSuppressions: suppressions,
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-19' } },
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-26' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-26' } },
    ]);
    // A suppressed forward date is still expressed exactly once as continuity.
    const dates = plan.suppressionContinuations.map((c) => c.to.occurrenceDateISO);
    expect(new Set(dates).size).toBe(dates.length);
    expect(plan.counts.suppressionContinuations).toBe(2);
  });

  it('includes a future suppression with no stored occurrence as continuity', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-19' } },
    ]);
  });
});

describe('planSeriesSplit — validation failures (fail closed)', () => {
  it('fails when the selected occurrence has no seriesId (legacy)', () => {
    const legacy = { id: 'legacy-1', occurrenceDateISO: '2026-01-12' };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: legacy,
      edited: EDITED,
      forwardOccurrences: [],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, reason: 'unsupported_legacy_occurrence' });
  });

  it('fails when no EventSeries definition is provided', () => {
    const plan = planSeriesSplit({
      oldDefinition: null,
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, reason: 'missing_definition' });
  });

  it('fails when the provided definition does not own the selected occurrence', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef({ id: 'a-different-series' }),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, reason: 'missing_series_id' });
  });

  it('fails when the selected occurrence is before the definition start', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef({ startDate: '2026-02-02' }),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, reason: 'selected_before_definition_start' });
  });

  it('fails when the selected occurrence date is not a plain calendar date', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: { id: 'occ-x', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-12T10:00:00Z' },
      edited: EDITED,
      forwardOccurrences: [],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, reason: 'invalid_occurrence_date' });
  });
});

describe('planSeriesSplit — downstream key preservation (Notes / TrainingLog)', () => {
  it('preserves each re-parented occurrence id and date so Note keys still resolve', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, OCC.w3, OCC.w4],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    // Note key convention s_{date}_{id}: both parts come straight from the input.
    const keys = plan.reparents.map((r) => `s_${r.occurrenceDateISO}_${r.occurrenceId}`);
    expect(keys).toEqual(['s_2026-01-12_occ-w2', 's_2026-01-19_occ-w3', 's_2026-01-26_occ-w4']);
  });

  it('preserves the id+date pair a TrainingLog association resolves on', () => {
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const anchor = plan.reparents[0];
    expect({ id: anchor.occurrenceId, date: anchor.occurrenceDateISO }).toEqual({
      id: OCC.w2.id,
      date: OCC.w2.occurrenceDateISO,
    });
  });
});

describe('planSeriesSplit — write-set count reporting', () => {
  it('reports total = 2 + reparents + suppressionContinuations', () => {
    // w3's date is suppressed (no stored occurrence for it, rule 5); w2 and w4
    // are clean and re-parented.
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, OCC.w4],
      forwardSuppressions: [
        { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' },
      ],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.counts.total).toBe(
      plan.counts.definitionUpdates +
        plan.counts.definitionCreates +
        plan.counts.occurrenceReparents +
        plan.counts.suppressionContinuations,
    );
    expect(plan.counts.total).toBe(5);
  });
});

describe('planSeriesSplit — isDeleted future occurrence', () => {
  it('fails closed when the selected anchor itself is isDeleted (defense-in-depth — R32 already excludes it from the UI)', () => {
    const deletedAnchor: SplitOccurrenceInput = { id: 'occ-w2', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-12', isDeleted: true };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: deletedAnchor,
      edited: EDITED,
      forwardOccurrences: [deletedAnchor],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, reason: 'anchor_is_deleted' });
  });

  it('leaves a future isDeleted occurrence on the original series, unmodified, and not re-parented', () => {
    const deleted: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', isDeleted: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, deleted, OCC.w4],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.reparents.map((r) => r.occurrenceId)).toEqual(['occ-w2', 'occ-w4']);
    expect(deleted).toEqual({
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', isDeleted: true,
    });
  });

  it('produces exactly one new-series continuity op for a future isDeleted occurrence, so the materializer cannot resurrect it', () => {
    const deleted: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', isDeleted: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, deleted],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.suppressionContinuations).toEqual([
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-19' } },
    ]);
  });

  it('treats an isDeleted occurrence coexisting with a same-date suppression as valid (not a conflict)', () => {
    const deleted: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', isDeleted: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, deleted],
      forwardSuppressions: [{ seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    // Still exactly one continuity op (deduped), no conflict, no reparent.
    expect(plan.suppressionContinuations).toEqual([
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-19' } },
    ]);
    expect(plan.reparents.find((r) => r.occurrenceDateISO === '2026-01-19')).toBeUndefined();
  });

  it('does not produce a duplicate continuity op for an isDeleted occurrence that is also isSeriesException', () => {
    const deletedException: SplitOccurrenceInput = {
      id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19', isSeriesException: true, isDeleted: true,
    };
    const plan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: OCC.w2,
      edited: EDITED,
      forwardOccurrences: [OCC.w2, deletedException],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    // isDeleted takes priority over isSeriesException: never re-parented.
    expect(plan.reparents.find((r) => r.occurrenceId === 'occ-w3')).toBeUndefined();
    expect(plan.suppressionContinuations).toEqual([
      { from: { seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-19' }, to: { seriesId: NEW_SERIES, occurrenceDateISO: '2026-01-19' } },
    ]);
  });
});
