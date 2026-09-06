/**
 * seriesSplitService — Slice 2b-2 EMULATOR verification (added in 2c-2).
 *
 * Exercises the REAL split persistence adapter (no firebase mock) against a
 * local Firestore emulator with production `firestore.rules` loaded, using an
 * injected owner Firestore client. Proves the single-transaction split commits
 * atomically under real rules and that a planner rejection leaves no partial
 * state or empty definition.
 *
 * SAFETY: local emulator only (synthetic `demo-` project id). Fails fast if
 * FIRESTORE_EMULATOR_HOST is unset (launch via `npm run test:rules`).
 *
 * Deterministic concurrent-retry orchestration (competing edit preserved,
 * concurrent suppression included after retry, competing split makes no
 * duplicate definition) is proven in the in-memory harness
 * (src/services/seriesSplitService.test.ts); this suite proves real
 * single-client transactional + rules behavior.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { persistSeriesSplitAtomically } from '../../src/services/seriesSplitService';
import { getISOWeekForDate } from '../../src/utils/dateUtils';
import { computeSeriesOccurrenceDates, recurrenceHorizonEndDate, productionWeekNumberForOccurrence } from '../../src/hooks/computeSeriesOccurrences';

const PROJECT_ID = 'demo-fightweek-rules';
const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const ROLES_DOC = 'artifacts/production/public/data/config/roles';
const OWNER = 'owner@x';
const OLD = 'old-series-1';
const NEW = 'new-series-2';
const NOW = '2026-01-01T00:00:00.000Z';
const SPLIT = '2026-01-12';
const HORIZON = '2026-01-26'; // 01-12, 01-19, 01-26
const EDITED = { title: 'Evening MMA', discipline: 'MMA', location: 'Gym B', startTime: '18:00', endTime: '19:30' };

const seriesPath = (id: string) => `artifacts/production/users/${OWNER}/eventSeries/${id}`;
const weekPathFor = (dateISO: string) => {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `artifacts/production/users/${OWNER}/weeks/week_${getISOWeekForDate(new Date(y, m - 1, d))}`;
};

let testEnv: RulesTestEnvironment;
const ownerDb = () => testEnv.authenticatedContext(OWNER, { email: OWNER }).firestore();
const adminDb = () => testEnv.authenticatedContext('admin@x', { email: 'admin@x' }).firestore();
const coachDb = () => testEnv.authenticatedContext('coach@x', { email: 'coach@x' }).firestore();
const teammateDb = () => testEnv.authenticatedContext('other@x', { email: 'other@x' }).firestore();

/** Typed field/day-array accessors for snapshot data (avoids `any`). */
const field = (data: unknown, key: string): unknown => ((data ?? {}) as Record<string, unknown>)[key];
const dayArr = (data: unknown, day = 'Mandag'): Array<Record<string, unknown>> => {
  const arr = field(data, day);
  return Array.isArray(arr) ? (arr as Array<Record<string, unknown>>) : [];
};

const OLD_DEF = {
  id: OLD, type: 'self_posted_training', ownerKey: OWNER, title: 'Morning MMA', discipline: 'MMA', location: 'Gym A',
  dayOfWeek: 1, startTime: '07:00', endTime: '08:30', startDate: '2026-01-05', intervalWeeks: 1, endDate: null,
  status: 'active', createdAt: NOW, updatedAt: NOW,
};
const occ = (id: string) => ({ id, seriesId: OLD, name: 'Morning MMA', category: 'MMA', location: 'Gym A', start: '07:00', end: '08:30', status: 'active', isRecurring: true, day: 'Mandag' });

beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is not set. Run via `npm run test:rules`.');
  if (!PROJECT_ID.startsWith('demo-')) throw new Error('Refusing to run: project id must be a synthetic `demo-` id.');
  const [hostname, portStr] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: hostname, port: Number(portStr) },
  });
});
afterAll(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(defOverrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, ROLES_DOC), { admins: ['admin@x'], coaches: ['coach@x'], members: { 'owner@x': 'Owner', 'other@x': 'Other', 'coach@x': 'Coach', 'admin@x': 'Admin' } });
    await setDoc(doc(db, seriesPath(OLD)), { ...OLD_DEF, ...defOverrides });
    await setDoc(doc(db, weekPathFor('2026-01-12')), { Mandag: [occ('occ-w2')], lastUpdated: NOW });
    await setDoc(doc(db, weekPathFor('2026-01-19')), { Mandag: [occ('occ-w3')], lastUpdated: NOW });
    await setDoc(doc(db, weekPathFor('2026-01-26')), { Mandag: [occ('occ-w4')], lastUpdated: NOW });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function run(selectedId = 'occ-w2', firestore: ReturnType<typeof ownerDb> = ownerDb()) {
  return persistSeriesSplitAtomically(
    { fighterKey: OWNER, selected: { id: selectedId, seriesId: OLD, occurrenceDateISO: SPLIT }, edited: EDITED },
    { firestore: firestore as never, newSeriesId: NEW, now: NOW, horizonEndDate: HORIZON },
  );
}

describe('persistSeriesSplitAtomically — emulator', () => {
  it('commits a complete split atomically under production rules', async () => {
    await seed();
    const res = await run();
    expect(res).toMatchObject({ ok: true, newSeriesId: NEW });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const newDef = await getDoc(doc(db, seriesPath(NEW)));
      const oldDef = await getDoc(doc(db, seriesPath(OLD)));
      expect(newDef.exists()).toBe(true);
      expect(field(newDef.data(), 'startDate')).toBe(SPLIT);
      expect(field(oldDef.data(), 'endDate')).toBe('2026-01-11');
      const wk = await getDoc(doc(db, weekPathFor('2026-01-19')));
      expect(dayArr(wk.data())[0].seriesId).toBe(NEW);
    });
  });

  it('a planner rejection leaves no new definition and no partial re-parenting', async () => {
    // Selected anchor references a series id that does not match its own doc:
    // an occurrence dated before the definition start forces a planner reject.
    await seed({ startDate: '2026-02-02' }); // SPLIT (01-12) is before start → rejected
    const res = await persistSeriesSplitAtomically(
      { fighterKey: OWNER, selected: { id: 'occ-w2', seriesId: OLD, occurrenceDateISO: SPLIT }, edited: EDITED },
      { firestore: ownerDb() as never, newSeriesId: NEW, now: NOW, horizonEndDate: HORIZON },
    );
    expect(res.ok).toBe(false);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const newDef = await getDoc(doc(db, seriesPath(NEW)));
      expect(newDef.exists()).toBe(false); // no empty/partial new definition
      const wk = await getDoc(doc(db, weekPathFor('2026-01-19')));
      expect(dayArr(wk.data())[0].seriesId).toBe(OLD); // unchanged
    });
  });

  // ─── Authorization matrix (short 3-week horizon — mirrors seriesDeleteService's
  // existing owner/admin/coach/teammate coverage so split and delete are held to
  // the SAME documented policy). No rules change; this only PROVES current
  // behavior for the small-horizon case before the realistic/open-horizon
  // characterization below.
  it('admin cross-owner split SUCCEEDS under the admin read rule (short horizon)', async () => {
    await seed();
    const res = await run('occ-w2', adminDb());
    expect(res).toMatchObject({ ok: true, newSeriesId: NEW });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      expect(field((await getDoc(doc(ctx.firestore(), seriesPath(OLD)))).data(), 'endDate')).toBe('2026-01-11');
    });
  });

  it('coach cross-owner split FAILS (no coach eventSeries read) with zero writes', async () => {
    await seed();
    const res = await run('occ-w2', coachDb());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.kind).toBe('transaction');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      expect(field((await getDoc(doc(db, seriesPath(OLD)))).data(), 'endDate')).toBeNull();
      expect(dayArr((await getDoc(doc(db, weekPathFor('2026-01-12')))).data())[0].seriesId).toBe(OLD);
    });
  });

  it('teammate cross-owner split FAILS with zero writes', async () => {
    await seed();
    const res = await run('occ-w2', teammateDb());
    expect(res.ok).toBe(false);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      expect(field((await getDoc(doc(ctx.firestore(), seriesPath(OLD)))).data(), 'endDate')).toBeNull();
    });
  });
});

/**
 * ─── Realistic open-ended / real-default-horizon characterization ───
 *
 * Distinct from the short 3-week fixtures above: this reproduces the SHAPE of
 * the San TST scenario (open-ended `endDate: null` series, split anchored at
 * "now", the REAL `recurrenceHorizonEndDate()` default — no shortened
 * `horizonEndDate` override) to establish whether an admin cross-owner split
 * of a long/open-ended series actually succeeds or fails under the currently
 * deployed rules, and to capture the exact Firestore error when it does not.
 * Purely local `demo-fightweek-rules` emulator project — unrelated to and
 * incapable of touching the real `fightweek-app` TST/production data.
 */
function toLocalISO(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function mostRecentMonday(from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diffFromMonday = (d.getDay() + 6) % 7; // 0 = already Monday
  d.setDate(d.getDate() - diffFromMonday);
  return toLocalISO(d);
}
function addWeeksISO(iso: string, weeks: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + weeks * 7);
  return toLocalISO(dt);
}

describe('persistSeriesSplitAtomically — emulator — realistic open-ended default-horizon characterization', () => {
  const REAL_OLD = 'realistic-old-series';
  const REAL_NEW = 'realistic-new-series';
  const REAL_NOW = '2026-09-06T12:00:00.000Z';
  // Anchored to the most recent Monday on/before the actual test-run clock, so
  // the forward window to `recurrenceHorizonEndDate()` (today + 52 weeks) stays
  // a realistic ~52-occurrence span no matter which day this suite is run.
  const REAL_SPLIT = mostRecentMonday(new Date());
  const REAL_SERIES_START = addWeeksISO(REAL_SPLIT, -8); // already running for 8 weeks
  const REAL_HORIZON_END = recurrenceHorizonEndDate();
  const REAL_CANDIDATE_DATES = computeSeriesOccurrenceDates({
    startDate: REAL_SPLIT, intervalWeeks: 1, endDate: null, horizonEndDate: REAL_HORIZON_END,
  });
  const REAL_EDITED = { title: 'COPILOT CHARACTERIZATION split title', discipline: 'MMA', location: 'COPILOT CHARACTERIZATION GYM', startTime: '18:00', endTime: '19:30' };
  const SELECTED_REAL = { id: 'real-occ-0', seriesId: REAL_OLD, occurrenceDateISO: REAL_SPLIT };

  function realisticWeekPathFor(dateISO: string): string {
    const wk = productionWeekNumberForOccurrence(dateISO, REAL_SERIES_START);
    return `artifacts/production/users/${OWNER}/weeks/week_${wk}`;
  }
  function realisticOcc(id: string, overrides: Record<string, unknown> = {}) {
    return { id, seriesId: REAL_OLD, name: 'Realistic characterization training', category: 'MMA', location: 'Original Gym', start: '17:00', end: '18:30', status: 'active', isRecurring: true, day: 'Mandag', ...overrides };
  }

  async function seedRealistic() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, ROLES_DOC), { admins: ['admin@x'], coaches: ['coach@x'], members: { 'owner@x': 'Owner', 'other@x': 'Other', 'coach@x': 'Coach', 'admin@x': 'Admin' } });
      await setDoc(doc(db, seriesPath(REAL_OLD)), {
        id: REAL_OLD, type: 'self_posted_training', ownerKey: OWNER, title: 'Realistic characterization training',
        discipline: 'MMA', location: 'Original Gym', dayOfWeek: 1, startTime: '17:00', endTime: '18:30',
        startDate: REAL_SERIES_START, intervalWeeks: 1, endDate: null, status: 'active', createdAt: REAL_NOW, updatedAt: REAL_NOW,
      });
      for (let i = 0; i < REAL_CANDIDATE_DATES.length; i++) {
        const dateISO = REAL_CANDIDATE_DATES[i];
        const wkPath = realisticWeekPathFor(dateISO);
        if (i === 6) {
          // A pre-existing suppression with no live occurrence — exercises the
          // "copy an existing forward suppression" continuation path.
          await setDoc(doc(db, wkPath), { Mandag: [], lastUpdated: REAL_NOW });
          await setDoc(doc(db, `${seriesPath(REAL_OLD)}/suppressions/${dateISO}`), { seriesId: REAL_OLD, occurrenceDateISO: dateISO, reason: 'deleted', createdAt: REAL_NOW });
          continue;
        }
        const id = `real-occ-${i}`;
        let entry;
        if (i === 2) entry = realisticOcc(id, { name: 'Realistic active exception', isSeriesException: true, start: '19:00', end: '20:00' }); // active future exception
        else if (i === 4) entry = realisticOcc(id, { status: 'cancelled' }); // triggers a suppression continuation write
        else entry = realisticOcc(id);
        await setDoc(doc(db, wkPath), { Mandag: [entry], lastUpdated: REAL_NOW });
      }
    });
  }

  function runRealistic(firestore: ReturnType<typeof ownerDb>) {
    // Deliberately NO `horizonEndDate` override — persistSeriesSplitAtomically
    // must fall back to the REAL `recurrenceHorizonEndDate()` default, exactly
    // as production does.
    return persistSeriesSplitAtomically(
      { fighterKey: OWNER, selected: SELECTED_REAL, edited: REAL_EDITED },
      { firestore: firestore as never, newSeriesId: REAL_NEW, now: REAL_NOW },
    );
  }

  /** Sanitized, no-PII/no-token diagnostic dump for whichever result actually occurred. */
  function describeResult(actor: string, res: Awaited<ReturnType<typeof runRealistic>>) {
    if (res.ok) {
      console.log(`[characterization:${actor}] ok=true newSeriesId=${res.newSeriesId} counts=${JSON.stringify(res.counts)}`);
      return;
    }
    const errAny = res as { kind: string; error?: unknown; reason?: unknown };
    const err = errAny.error as { code?: string; message?: string } | undefined;
    console.log(`[characterization:${actor}] ok=false kind=${errAny.kind} reason=${errAny.reason ?? ''} code=${err?.code ?? ''} message=${String(err?.message ?? '').slice(0, 200)}`);
  }

  it('owner: complete split of an open-ended series across the real default horizon (intended: succeeds)', async () => {
    expect(REAL_CANDIDATE_DATES.length).toBeGreaterThan(40); // sanity: this really is a large/open-ended horizon
    await seedRealistic();
    const res = await runRealistic(ownerDb());
    describeResult('owner', res);
    expect(res).toMatchObject({ ok: true, newSeriesId: REAL_NEW });
  });

  it('admin cross-owner: complete split of an open-ended series across the real default horizon (intended: succeeds)', async () => {
    await seedRealistic();
    const res = await runRealistic(adminDb());
    describeResult('admin', res);

    // Atomicity evidence FIRST (must hold regardless of ok/fail): either every
    // forward occurrence moved to the new series, or NONE did — never partial.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const oldDef = await getDoc(doc(db, seriesPath(REAL_OLD)));
      const sampleUntouchedWeek = await getDoc(doc(db, realisticWeekPathFor(REAL_CANDIDATE_DATES[10])));
      const sampleEntry = dayArr(sampleUntouchedWeek.data())[0];
      if (res.ok) {
        expect(field(oldDef.data(), 'endDate')).not.toBeNull(); // ended just before the split date
        expect(sampleEntry?.seriesId).toBe(REAL_NEW);
      } else {
        expect(field(oldDef.data(), 'endDate')).toBeNull(); // untouched
        expect(sampleEntry?.seriesId).toBe(REAL_OLD);
      }
    });

    // Documents the APPROVED, INTENDED behavior (admin cross-owner split is a
    // sanctioned capability) — failing-first if the hypothesis under
    // investigation is real; a genuine pass outright refutes it.
    expect(res).toMatchObject({ ok: true, newSeriesId: REAL_NEW });
  });
});
