/**
 * seriesSplitMaterializerInteraction.test.ts — proves the dormant split
 * planner (`planSeriesSplit`) composes safely with the ACTIVE, production-wired
 * materializer planner (`planSeriesMaterialization`). Pure domain composition
 * only — no Firestore, no service/transaction mocking, no UI wiring. Exercises
 * the exact contract a future `persistSeriesSplitAtomically` write would leave
 * behind, fed straight into `planSeriesMaterialization` for both the new and
 * the old (ended) series, to prove the active materializer cannot resurrect
 * or duplicate anything the split is responsible for protecting.
 */
import { describe, it, expect } from 'vitest';
import { buildEventSeriesDefinition, type EventSeriesDefinition } from './eventSeriesDefinition';
import { planSeriesSplit, type SplitOccurrenceInput, type SplitEditedFields } from './seriesSplitPlan';
import { planSeriesMaterialization, type MaterializationOccurrenceInput, type MaterializationSuppressionInput } from './materializationPlan';

const NOW = '2026-01-01T00:00:00.000Z';
const OLD_SERIES = 'old-series-1';
const NEW_SERIES = 'new-series-2';
const HORIZON = '2026-02-16';

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
      startDate: '2026-01-05', // Mon (w1)
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

// Weekly Mondays from the anchor.
const W2 = '2026-01-12'; // split anchor
const W3 = '2026-01-19'; // active future exception
const W4 = '2026-01-26'; // cancelled future occurrence
const W5 = '2026-02-02'; // isDeleted future occurrence
const W6 = '2026-02-09'; // clean, not yet persisted — must still materialize normally
const W7 = '2026-02-16'; // pre-existing suppression, no stored occurrence

const anchor: SplitOccurrenceInput = { id: 'occ-w2', seriesId: OLD_SERIES, occurrenceDateISO: W2 };
const activeException: SplitOccurrenceInput = { id: 'occ-w3', seriesId: OLD_SERIES, occurrenceDateISO: W3, isSeriesException: true };
const cancelled: SplitOccurrenceInput = { id: 'occ-w4', seriesId: OLD_SERIES, occurrenceDateISO: W4, status: 'cancelled' };
const deleted: SplitOccurrenceInput = { id: 'occ-w5', seriesId: OLD_SERIES, occurrenceDateISO: W5, isDeleted: true };
const existingSuppression = { seriesId: OLD_SERIES, occurrenceDateISO: W7 };

function runSplit() {
  const plan = planSeriesSplit({
    oldDefinition: oldDef(),
    selected: anchor,
    edited: EDITED,
    forwardOccurrences: [anchor, activeException, cancelled, deleted],
    forwardSuppressions: [existingSuppression],
    newSeriesId: NEW_SERIES,
    now: NOW,
  });
  if (!plan.ok) throw new Error(`test setup: split unexpectedly failed (${plan.reason})`);
  return plan;
}

describe('split \u2192 materializer composition — new series', () => {
  it('never regenerates a reparented active exception, a reparented clean anchor, a cancelled/isDeleted/suppressed date, and still materializes a genuinely clean future date', () => {
    const plan = runSplit();

    // What persistSeriesSplitAtomically would have written under NEW_SERIES:
    // the anchor and the exception (per plan.reparents), each carrying their
    // resulting seriesId. Cancelled/isDeleted stay on OLD_SERIES (not in this list).
    const newSeriesOccurrences: MaterializationOccurrenceInput[] = plan.reparents.map((r) => ({
      id: r.occurrenceId,
      seriesId: r.toSeriesId,
      occurrenceDateISO: r.occurrenceDateISO,
      isSeriesException: r.occurrenceId === activeException.id,
    }));
    const newSeriesSuppressions: MaterializationSuppressionInput[] = plan.suppressionContinuations.map((c) => ({
      seriesId: c.to.seriesId,
      occurrenceDateISO: c.to.occurrenceDateISO,
    }));

    const result = planSeriesMaterialization({
      definition: plan.newDefinition,
      existingOccurrences: newSeriesOccurrences,
      suppressions: newSeriesSuppressions,
      horizonEndDateISO: HORIZON,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const generatedDates = result.generate.map((g) => g.occurrenceDateISO);
    // Protected dates: never (re)generated under the new series.
    expect(generatedDates).not.toContain(W2); // reparented anchor — already exists
    expect(generatedDates).not.toContain(W3); // reparented active exception — already exists
    expect(generatedDates).not.toContain(W4); // cancelled — suppressed via continuity
    expect(generatedDates).not.toContain(W5); // isDeleted — suppressed via continuity
    expect(generatedDates).not.toContain(W7); // pre-existing suppression carried forward

    // A genuinely clean, not-yet-persisted forward date still materializes normally.
    expect(generatedDates).toContain(W6);
    const w6 = result.generate.find((g) => g.occurrenceDateISO === W6)!;
    expect(w6.seriesId).toBe(NEW_SERIES);
    expect(w6.title).toBe('Evening MMA'); // carries the new definition's (edited) content

    // Exactly one generated occurrence total — no duplicate for any protected date.
    expect(result.generate).toHaveLength(1);
  });

  it('never overwrites, reactivates, or duplicates the isDeleted occurrence itself: it never appears in existingOccurrences under the new series, and the new series only ever gets a suppression for its date', () => {
    const plan = runSplit();
    expect(plan.reparents.find((r) => r.occurrenceId === deleted.id)).toBeUndefined();
    const continuation = plan.suppressionContinuations.find((c) => c.to.occurrenceDateISO === W5);
    expect(continuation).toEqual({ from: { seriesId: OLD_SERIES, occurrenceDateISO: W5 }, to: { seriesId: NEW_SERIES, occurrenceDateISO: W5 } });
  });

  it('preserves the active exception\'s independently edited fields through the reparent (never the submitted series-wide edit)', () => {
    const plan = runSplit();
    const exceptionOp = plan.reparents.find((r) => r.occurrenceId === activeException.id)!;
    expect(exceptionOp.preserveExistingFields).toBe(true);
    expect(exceptionOp.fields).toBeUndefined(); // no series-wide fields applied
  });
});

describe('split \u2192 materializer composition — old (ended) series', () => {
  it('never regenerates anything at or after the split date once ended (endDate set, not discontinued)', () => {
    const plan = runSplit();
    const endedOldDefinition: EventSeriesDefinition = {
      ...oldDef(),
      endDate: plan.oldDefinitionUpdate.endDateBefore,
    };
    // The old series' own first (pre-split) occurrence already exists — the
    // only thing the ended definition's window could still want.
    const result = planSeriesMaterialization({
      definition: endedOldDefinition,
      existingOccurrences: [{ id: 'occ-w1', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-05' }],
      suppressions: [],
      horizonEndDateISO: HORIZON,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generate).toHaveLength(0);
    for (const g of result.generate) expect(g.occurrenceDateISO < W2).toBe(true);
  });

  it('rejects materialization outright once discontinued (split anchored at the series\' own first occurrence)', () => {
    const discontinuedPlan = planSeriesSplit({
      oldDefinition: oldDef(),
      selected: { id: 'occ-w1', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-05' },
      edited: EDITED,
      forwardOccurrences: [{ id: 'occ-w1', seriesId: OLD_SERIES, occurrenceDateISO: '2026-01-05' }],
      forwardSuppressions: [],
      newSeriesId: NEW_SERIES,
      now: NOW,
    });
    expect(discontinuedPlan.ok).toBe(true);
    if (!discontinuedPlan.ok) return;
    expect(discontinuedPlan.oldDefinitionUpdate.discontinued).toBe(true);
    const discontinuedOldDefinition: EventSeriesDefinition = { ...oldDef(), status: 'discontinued' };
    const result = planSeriesMaterialization({
      definition: discontinuedOldDefinition,
      existingOccurrences: [],
      suppressions: [],
      horizonEndDateISO: HORIZON,
    });
    expect(result).toEqual({ ok: false, reason: 'discontinued_series' });
  });
});
