import { describe, it, expect } from 'vitest';
import {
  hasLog,
  decideDeletion,
  preserveSessionCoreData,
  preserveFraværCoreData,
  preserveEventCoreData,
} from './logProtection';
import type { TrainingSession, FraværSession } from '../../types/common';
import type { FightweekEvent } from '../../types/event';

// ──────────────────────────────────────────────
// hasLog
// ──────────────────────────────────────────────

describe('hasLog', () => {
  it('is true for a non-empty note (Phase 2a #1)', () => {
    expect(hasLog('Great session, felt strong')).toBe(true);
  });

  it('is false for missing, empty or whitespace-only notes (Phase 2a #2)', () => {
    expect(hasLog(undefined)).toBe(false);
    expect(hasLog(null)).toBe(false);
    expect(hasLog('')).toBe(false);
    expect(hasLog('   ')).toBe(false);
    expect(hasLog('\n\t ')).toBe(false);
  });
});

// ──────────────────────────────────────────────
// decideDeletion — the core protection decision
// ──────────────────────────────────────────────

describe('decideDeletion', () => {
  it('soft-cancels a logged/noted item (Phase 2a #3, #5, #6)', () => {
    expect(decideDeletion({ canResolveKey: true, note: 'logged' })).toBe('soft-cancel');
  });

  it('hard-deletes an un-logged item (Phase 2a #4)', () => {
    expect(decideDeletion({ canResolveKey: true, note: '' })).toBe('hard-delete');
    expect(decideDeletion({ canResolveKey: true, note: undefined })).toBe('hard-delete');
  });

  it('fails safe (no hard-delete) when the note key cannot be resolved (Phase 2a #8)', () => {
    expect(decideDeletion({ canResolveKey: false, note: undefined })).toBe('soft-cancel');
    // Even if a note happens to be absent, ambiguity must not allow hard-delete.
    expect(decideDeletion({ canResolveKey: false, note: '' })).toBe('soft-cancel');
  });
});

// ──────────────────────────────────────────────
// Core data snapshots (Phase 2a #7)
// ──────────────────────────────────────────────

describe('preserveSessionCoreData', () => {
  it('preserves title/type/category/start/end/location/source id', () => {
    const session: TrainingSession = {
      id: 'sess_1',
      day: 'Mandag',
      name: 'MMA Elite',
      category: 'MMA',
      start: '17:00',
      end: '18:30',
      location: 'Fightworld',
      status: 'active',
      catalogueClassId: 'cls_1',
    };
    expect(preserveSessionCoreData(session)).toEqual({
      title: 'MMA Elite',
      category: 'MMA',
      type: undefined,
      start: '17:00',
      end: '18:30',
      location: 'Fightworld',
      sourceId: 'cls_1',
    });
  });
});

describe('preserveFraværCoreData', () => {
  it('preserves title/category/type/times/group id', () => {
    const fravaer: FraværSession = {
      id: 'frv_1',
      type: 'fravær',
      name: 'Ferie',
      category: 'Fravær',
      day: 'Mandag',
      start: '08:00',
      end: '17:00',
      status: 'active',
      fraværTitel: 'Sommerferie',
      fraværBeskrivelse: 'Væk',
      fraværGroupId: 'grp_1',
      fraværDayIndex: 1,
      fraværTotalDays: 3,
      fraværStartDate: '2026-07-01',
      fraværEndDate: '2026-07-03',
      fraværStartTime: '08:00',
      fraværEndTime: '17:00',
    };
    expect(preserveFraværCoreData(fravaer)).toEqual({
      title: 'Sommerferie',
      category: 'Fravær',
      type: 'fravær',
      start: '08:00',
      end: '17:00',
      sourceId: 'grp_1',
    });
  });
});

describe('preserveEventCoreData', () => {
  it('preserves title/type/discipline/times/location/address/id', () => {
    const evt: FightweekEvent = {
      id: 'evt_1',
      title: 'DM i Brydning 2026',
      type: 'tournament',
      discipline: 'Brydning',
      date: '2026-05-16',
      startTime: '09:00',
      endTime: '18:00',
      location: 'Brøndby Hallen',
      address: 'Testvej 1',
      signups: {},
      createdBy: 'coach@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    expect(preserveEventCoreData(evt)).toEqual({
      title: 'DM i Brydning 2026',
      category: 'Brydning',
      type: 'tournament',
      start: '09:00',
      end: '18:00',
      location: 'Brøndby Hallen',
      address: 'Testvej 1',
      sourceId: 'evt_1',
    });
  });
});

// ──────────────────────────────────────────────
// Spec: recurring notes are per-occurrence/date (Phase 2a Q3 assumption)
// ──────────────────────────────────────────────

describe('recurring note-key granularity (spec / assumption doc)', () => {
  // The app builds a session note key as `s_{dateISO}_{sessionId}` and each
  // materialized recurring occurrence gets BOTH a unique date and a fresh
  // session id (see useSessionHandlers.handleAddRecurring + SessionDetailSheet).
  // Therefore two occurrences of the same recurring session must resolve to
  // DISTINCT note keys — a note logged on one occurrence must not appear on
  // another. This test documents that contract for the Phase 2b wiring.
  const sessionNoteKey = (dateISO: string, id: string) => `s_${dateISO}_${id}`;

  it('distinct occurrences of one series get distinct note keys', () => {
    const weekAKey = sessionNoteKey('2026-06-15', 'occurrence-uuid-a');
    const weekBKey = sessionNoteKey('2026-06-22', 'occurrence-uuid-b');
    expect(weekAKey).not.toBe(weekBKey);
  });

  it('a note on one occurrence only counts as a log for that occurrence', () => {
    const notes: Record<string, string> = {
      's_2026-06-15_occurrence-uuid-a': 'Sparred well',
    };
    expect(hasLog(notes[sessionNoteKey('2026-06-15', 'occurrence-uuid-a')])).toBe(true);
    expect(hasLog(notes[sessionNoteKey('2026-06-22', 'occurrence-uuid-b')])).toBe(false);
  });
});
