import { describe, it, expect } from 'vitest';
import { buildRecurringOccurrencePlan } from './useSessionHandlers';

// Slice 1 (+ collision correction) — pure week-document write-plan builder for
// recurring series creation. No Firestore. Deterministic ids injected via
// makeId. `mode` gates the collision policy — see the function doc comment.

function idGen() {
  let n = 0;
  return () => `id-${++n}`;
}

const selfPosted = { name: 'MMA Sparring', category: 'MMA', start: '17:00', end: '18:30', location: 'Klub A' };

describe('buildRecurringOccurrencePlan — self_posted_series: happy path (no collisions)', () => {
  it('stamps the SAME seriesId on every newly-materialized occurrence', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40, 41, 42], resolvedWeeks: {}, loadedWeeks: {},
      systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.weekUpdates.map(w => w.weekNum)).toEqual([40, 41, 42]);
    for (const w of plan.weekUpdates) expect(w.data['Mandag'][0].seriesId).toBe('S1');
  });

  it('gives each occurrence a DISTINCT id (seriesId is not occurrence identity)', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40, 41, 42], resolvedWeeks: {}, loadedWeeks: {},
      systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    if (!plan.ok) throw new Error('expected ok plan');
    const ids = plan.weekUpdates.map(w => w.data['Mandag'][0].id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every(id => id !== 'S1')).toBe(true);
  });

  it('creates exactly one occurrence per target week and reports added count', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40, 41], resolvedWeeks: {}, loadedWeeks: {},
      systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    if (!plan.ok) throw new Error('expected ok plan');
    expect(plan.added).toBe(2);
    expect(plan.weekUpdates).toHaveLength(2);
  });

  it('preserves other sessions already present in a resolved week', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40], resolvedWeeks: { 40: { Mandag: [{ id: 'x', name: 'BJJ', start: '19:00' }] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    if (!plan.ok) throw new Error('expected ok plan');
    const day = plan.weekUpdates[0].data['Mandag'];
    expect(day.map((s: any) => s.name)).toContain('BJJ');
    expect(day.map((s: any) => s.name)).toContain('MMA Sparring');
  });

  it('never removes anything (interval>1 destructive cleanup is disabled for self-posted creation)', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40, 42], resolvedWeeks: {},
      loadedWeeks: { 41: { Mandag: [{ id: 'unrelated', name: 'MMA Sparring', start: '17:00' }] } },
      systemWeek: 40, interval: 2, makeId: idGen(), mode: 'self_posted_series',
    });
    if (!plan.ok) throw new Error('expected ok plan');
    expect(plan.removed).toBe(0);
    // The unrelated week-41 occurrence must not appear in the write plan at all.
    expect(plan.weekUpdates.find(w => w.weekNum === 41)).toBeUndefined();
  });

  it('self-match passthrough: converting an EXISTING session (session.id set) into recurring is not a collision', () => {
    const existingSession = { ...selfPosted, id: 'anchor-1' };
    const plan = buildRecurringOccurrencePlan({
      session: existingSession, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40, 41], resolvedWeeks: { 40: { Mandag: [{ id: 'anchor-1', name: 'MMA Sparring', start: '17:00' }] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const wk40 = plan.weekUpdates.find(w => w.weekNum === 40)!;
    expect(wk40.data['Mandag'][0].id).toBe('anchor-1'); // self, untouched id
    expect('seriesId' in wk40.data['Mandag'][0]).toBe(false); // existing occurrence never stamped
    const wk41 = plan.weekUpdates.find(w => w.weekNum === 41)!;
    expect(wk41.data['Mandag'][0].seriesId).toBe('S1'); // genuinely new occurrence IS stamped
  });
});

describe('buildRecurringOccurrencePlan — self_posted_series: collision fails the ENTIRE operation with zero writes', () => {
  it('collision in the FIRST target week: typed failure, no weekUpdates produced at all', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40, 41, 42], resolvedWeeks: { 40: { Mandag: [{ id: 'other', name: 'MMA Sparring', start: '17:00' }] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    expect(plan).toEqual({ ok: false, reason: 'collision', weekNum: 40, dayName: 'Mandag' });
  });

  it('collision in a LATER target week: typed failure, zero writes for the whole operation (earlier weeks discarded)', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40, 41, 42],
      resolvedWeeks: { 42: { Mandag: [{ id: 'other', name: 'MMA Sparring', start: '17:00' }] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    expect(plan).toEqual({ ok: false, reason: 'collision', weekNum: 42, dayName: 'Mandag' });
  });

  it('the existing occurrence remains byte-for-byte unchanged on collision (never mutated, never returned)', () => {
    const original = { id: 'other', name: 'MMA Sparring', start: '17:00', status: 'active', isRecurring: false };
    const snapshotBefore = JSON.stringify(original);
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40], resolvedWeeks: { 40: { Mandag: [original] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    expect(plan.ok).toBe(false);
    expect(JSON.stringify(original)).toBe(snapshotBefore); // the SOURCE object itself is never touched
  });

  it('an existing occurrence WITH its own seriesId is not adopted or modified — it causes a collision', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40], resolvedWeeks: { 40: { Mandag: [{ id: 'old', name: 'MMA Sparring', start: '17:00', isRecurring: true, seriesId: 'OLD' }] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    expect(plan).toEqual({ ok: false, reason: 'collision', weekNum: 40, dayName: 'Mandag' });
  });

  it('a legacy occurrence without seriesId is not adopted or modified — it causes a collision', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40], resolvedWeeks: { 40: { Mandag: [{ id: 'legacy', name: 'MMA Sparring', start: '17:00' }] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    expect(plan).toEqual({ ok: false, reason: 'collision', weekNum: 40, dayName: 'Mandag' });
  });

  it('a template-backed / migration-stamped occurrence (recurrenceInterval present) is not adopted — it causes a collision', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40], resolvedWeeks: { 40: { Mandag: [{ id: 'tpl', name: 'MMA Sparring', start: '17:00', isRecurring: true, recurrenceInterval: 1 }] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    expect(plan).toEqual({ ok: false, reason: 'collision', weekNum: 40, dayName: 'Mandag' });
  });

  it('ignores rest-day markers (never a collision)', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: 'S1',
      targetWeeks: [40], resolvedWeeks: { 40: { Mandag: [{ id: 'rest-1', name: 'MMA Sparring', start: '17:00', isRestDay: true }] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'self_posted_series',
    });
    expect(plan.ok).toBe(true);
  });
});

describe('buildRecurringOccurrencePlan — legacy mode (catalogue-linked): unchanged prior behaviour', () => {
  it('dedups a pre-existing matching occurrence instead of failing (no collision in legacy mode)', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: null,
      targetWeeks: [40], resolvedWeeks: { 40: { Mandag: [{ id: 'keep', name: 'MMA Sparring', start: '17:00' }] } },
      loadedWeeks: {}, systemWeek: 40, interval: 1, makeId: idGen(), mode: 'legacy',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.added).toBe(0);
    const entry = plan.weekUpdates[0].data['Mandag'][0];
    expect(entry.id).toBe('keep');
    expect(entry.isRecurring).toBe(true);
    expect('seriesId' in entry).toBe(false); // still never stamped — seriesId is null for catalogue anyway
  });

  it('still runs the interval>1 stale-cleanup (unchanged prior behaviour)', () => {
    const plan = buildRecurringOccurrencePlan({
      session: selfPosted, dayName: 'Mandag', seriesId: null,
      targetWeeks: [40, 42], resolvedWeeks: {},
      loadedWeeks: { 41: { Mandag: [{ id: 'stale', name: 'MMA Sparring', start: '17:00' }] } },
      systemWeek: 40, interval: 2, makeId: idGen(), mode: 'legacy',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.removed).toBe(1);
    const wk41 = plan.weekUpdates.find(w => w.weekNum === 41);
    expect(wk41!.data['Mandag']).toHaveLength(0);
  });
});

describe('buildRecurringOccurrencePlan — catalogue (seriesId null → no stamping)', () => {
  it('does not stamp any seriesId when seriesId is null', () => {
    const plan = buildRecurringOccurrencePlan({
      session: { ...selfPosted, catalogueClassId: 'c1' }, dayName: 'Mandag', seriesId: null,
      targetWeeks: [40, 41], resolvedWeeks: {}, loadedWeeks: {},
      systemWeek: 40, interval: 1, makeId: idGen(), mode: 'legacy',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    for (const w of plan.weekUpdates) expect('seriesId' in w.data['Mandag'][0]).toBe(false);
  });
});
