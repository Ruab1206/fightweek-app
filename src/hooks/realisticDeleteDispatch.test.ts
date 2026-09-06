/**
 * realisticDeleteDispatch.test.ts — characterizes the durable-vs-legacy
 * delete-this-and-following dispatch (classifyDeleteThisAndFollowingDispatch)
 * against a REALISTIC occurrence shape produced by the actual production
 * series-creation code (buildRecurringOccurrencePlan + buildEventSeriesDefinition
 * — the same functions handleAddRecurring calls for "Tilføj eget pas"), not a
 * hand-built service fixture.
 *
 * Purpose: prove whether an owner-created and an admin "Vis som bruger"-created
 * self-posted weekly recurring session are classified identically. The created
 * occurrence's shape never carries the acting/viewed identity (fighterKey only
 * selects the Firestore PATH the caller persists to — see seriesDeleteService
 * SeriesDeleteRequest.fighterKey) — so this test's expectation is that BOTH
 * contexts classify the same way. If a real admin-authored shape classified
 * differently, that would BE the owner/admin divergence and this test would
 * fail — per the investigation's stop condition, no dispatch code would be
 * silently changed as a result.
 */
import { describe, it, expect } from 'vitest';
import { buildRecurringOccurrencePlan, newSeriesId, newSessionId } from './useSessionHandlers';
import { buildEventSeriesDefinition } from '../domain/calendar/eventSeriesDefinition';
import { classifyDeleteThisAndFollowingDispatch } from '../domain/calendar/durableDeleteObservability';

const NOW = '2026-08-24T00:00:00.000Z';

/** The exact "Tilføj eget pas" new-session form shape (SessionModal's initial
 *  `form` state) — no `catalogueClassId` field exists on this shape at all. */
function tilfoejEgetPasForm(name: string) {
  return { name, category: 'MMA', start: '17:00', end: '18:30', location: '', status: 'active' as const };
}

/** Mirrors handleAddRecurring's own construction for a NEW self-posted weekly
 *  series (isSelfPosted branch) — real production code, real inputs — and
 *  returns the occurrence object exactly as it would be read back later as
 *  `editingSession` when someone clicks it on the calendar. `ownerKey` is the
 *  only value that ever differs between an owner-authored and an admin
 *  "Vis som bruger"-authored series (it becomes the Firestore path/definition
 *  owner, never a field on the occurrence itself). */
function createWeeklySelfPostedOccurrence(params: { title: string; ownerKey: string; startDateISO: string; weekNum: number; dayName: string }) {
  const seriesId = newSeriesId();
  const session = tilfoejEgetPasForm(params.title);
  const plan = buildRecurringOccurrencePlan({
    session,
    dayName: params.dayName,
    seriesId,
    targetWeeks: [params.weekNum],
    resolvedWeeks: { [params.weekNum]: {} },
    loadedWeeks: {},
    systemWeek: params.weekNum,
    interval: 1,
    makeId: newSessionId,
    mode: 'self_posted_series',
  });
  if (!plan.ok) throw new Error('unexpected collision in test fixture setup');
  const definition = buildEventSeriesDefinition({
    seriesId,
    ownerKey: params.ownerKey,
    title: params.title,
    dayOfWeek: 1,
    startTime: '17:00',
    endTime: '18:30',
    startDate: params.startDateISO,
    intervalWeeks: 1,
    endDate: null,
    now: NOW,
  });
  const occurrence = plan.weekUpdates[0].data[params.dayName][0];
  return { occurrence, definition };
}

describe('realistic delete-this-and-following dispatch — owner vs admin "Vis som bruger"', () => {
  it('classifies an OWNER-authored self-posted weekly recurring occurrence as durable', () => {
    const { occurrence } = createWeeklySelfPostedOccurrence({
      title: 'COPILOT TEST realistic-dispatch owner',
      ownerKey: 'owner@example.com',
      startDateISO: '2026-08-31',
      weekNum: 36,
      dayName: 'Mandag',
    });
    expect(occurrence).toMatchObject({ seriesId: expect.any(String), isRecurring: true });
    expect(occurrence.catalogueClassId).toBeUndefined();
    expect(classifyDeleteThisAndFollowingDispatch(occurrence)).toBe('durable');
  });

  it('classifies an ADMIN "Vis som bruger"-authored self-posted weekly recurring occurrence identically (durable)', () => {
    // Same production construction, same session shape — the only thing that
    // differs from the owner case is `ownerKey` (San's email instead of the
    // authenticated admin's own), because that is the ONLY identity input this
    // creation path threads through — see handleAddRecurring's `fighterKey`.
    const { occurrence } = createWeeklySelfPostedOccurrence({
      title: 'COPILOT TEST admin cross-owner retry 1e5ab2b',
      ownerKey: 'san@example.com',
      startDateISO: '2026-08-31',
      weekNum: 36,
      dayName: 'Mandag',
    });
    expect(occurrence).toMatchObject({ seriesId: expect.any(String), isRecurring: true });
    expect(occurrence.catalogueClassId).toBeUndefined();
    expect(classifyDeleteThisAndFollowingDispatch(occurrence)).toBe('durable');
  });

  it('confirms the dispatch decision never consumes owner/admin identity — only the occurrence shape', () => {
    // Two occurrences built for DIFFERENT owners, identical shape otherwise,
    // classify identically. This isolates the owner/admin divergence (if any)
    // to somewhere OTHER than the dispatch gate itself.
    const owner = createWeeklySelfPostedOccurrence({ title: 'A', ownerKey: 'owner@example.com', startDateISO: '2026-08-31', weekNum: 36, dayName: 'Mandag' });
    const admin = createWeeklySelfPostedOccurrence({ title: 'A', ownerKey: 'san@example.com', startDateISO: '2026-08-31', weekNum: 36, dayName: 'Mandag' });
    expect(classifyDeleteThisAndFollowingDispatch(owner.occurrence)).toBe(classifyDeleteThisAndFollowingDispatch(admin.occurrence));
  });

  it('a catalogue-linked recurring occurrence (legacy mode) is classified as legacy regardless of ownerKey', () => {
    const seriesForCatalogue: string | null = null; // legacy/catalogue adds stamp no seriesId
    const plan = buildRecurringOccurrencePlan({
      session: { ...tilfoejEgetPasForm('Hold'), catalogueClassId: 'class-1' },
      dayName: 'Mandag',
      seriesId: seriesForCatalogue,
      targetWeeks: [36],
      resolvedWeeks: { 36: {} },
      loadedWeeks: {},
      systemWeek: 36,
      interval: 1,
      makeId: newSessionId,
      mode: 'legacy',
    });
    if (!plan.ok) throw new Error('unexpected collision in test fixture setup');
    const occurrence = plan.weekUpdates[0].data['Mandag'][0];
    expect(occurrence.seriesId).toBeUndefined();
    expect(classifyDeleteThisAndFollowingDispatch(occurrence)).toBe('legacy');
  });
});
