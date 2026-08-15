/**
 * logCoordinator.test.ts — Pure coordinator for creating completed training logs.
 *
 * Tests the domain coordinator that:
 * 1. Validates structured input.
 * 2. Builds a complete log record (using existing builder).
 * 3. Calls injected persistence (never direct Firestore).
 * 4. Returns the log id or propagates persistence errors.
 *
 * No Firebase, React, or hooks.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  addCompletedTrainingLog,
  type AddCompletedTrainingLogDeps,
} from './logCoordinator';
import type { CompletedSelfPostedTrainingInput } from './selfPostedTraining';
import type { CompletedSelfPostedTrainingLog } from './types';

describe('logCoordinator', () => {
  // Test helpers
  const createMockDeps = (overrides?: Partial<AddCompletedTrainingLogDeps>) => {
    const persist = vi.fn<[string, CompletedSelfPostedTrainingLog], Promise<string>>(
      async (_, record) => record.id,
    );
    return { persist, ...overrides };
  };

  const validInput: CompletedSelfPostedTrainingInput = {
    title: 'Boxing training',
    dateISO: '2026-08-14',
    start: '18:00',
    end: '19:00',
    discipline: 'Boxing',
  };

  // ──────────────────────────────────────────────
  // Test 1: Valid input without notes
  // ──────────────────────────────────────────────
  it('accepts valid input without notes and persists', async () => {
    const deps = createMockDeps();
    const fighterKey = 'fighter@example.com';

    const logId = await addCompletedTrainingLog(validInput, fighterKey, deps);

    expect(logId).toBeDefined();
    expect(typeof logId).toBe('string');
    expect(deps.persist).toHaveBeenCalledOnce();

    const [persistedFighterKey, persistedRecord] = deps.persist.mock.calls[0];
    expect(persistedFighterKey).toBe(fighterKey);
    expect(persistedRecord).toBeDefined();
    expect(persistedRecord.log.notes).toBeUndefined();
  });

  // ──────────────────────────────────────────────
  // Test 2: Optional notes are preserved
  // ──────────────────────────────────────────────
  it('preserves optional notes in the persisted record', async () => {
    const deps = createMockDeps();
    const fighterKey = 'fighter@example.com';
    const inputWithNotes: CompletedSelfPostedTrainingInput = {
      ...validInput,
      notes: 'Great session, felt strong today',
    };

    await addCompletedTrainingLog(inputWithNotes, fighterKey, deps);

    expect(deps.persist).toHaveBeenCalledOnce();
    const persistedRecord = deps.persist.mock.calls[0][1];
    expect(persistedRecord.log.notes).toBe('Great session, felt strong today');
  });

  // ──────────────────────────────────────────────
  // Test 3: Missing fighter key
  // ──────────────────────────────────────────────
  it('rejects with missing fighter key before calling persistence', async () => {
    const deps = createMockDeps();

    await expect(addCompletedTrainingLog(validInput, '', deps)).rejects.toThrow(
      /fighterKey is required/i,
    );
    expect(deps.persist).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Test 4: Invalid input
  // ──────────────────────────────────────────────
  it('rejects invalid input before calling persistence', async () => {
    const deps = createMockDeps();
    const invalidInput: CompletedSelfPostedTrainingInput = {
      title: '',
      dateISO: 'invalid-date',
      // missing end/durationMinutes
    };

    await expect(
      addCompletedTrainingLog(invalidInput, 'fighter@example.com', deps),
    ).rejects.toThrow();
    expect(deps.persist).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Test 5: Record integrity
  // ──────────────────────────────────────────────
  it('passes complete record unchanged to persistence', async () => {
    const deps = createMockDeps();
    const fighterKey = 'fighter@example.com';
    const input = {
      ...validInput,
      intensity: 4,
      location: 'Boxing gym',
      notes: 'Test notes',
    };

    await addCompletedTrainingLog(input, fighterKey, deps);

    const persistedRecord = deps.persist.mock.calls[0][1];
    expect(persistedRecord.occurrence).toBeDefined();
    expect(persistedRecord.calendarEntry).toBeDefined();
    expect(persistedRecord.log).toBeDefined();
    expect(persistedRecord.log.intensity).toBe(4);
    expect(persistedRecord.log.discipline).toBe('Boxing');
    expect(persistedRecord.log.notes).toBe('Test notes');
    expect(persistedRecord.createdAt).toBeDefined();
    expect(persistedRecord.updatedAt).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // Test 6: Persistence failure is propagated
  // ──────────────────────────────────────────────
  it('propagates persistence errors without swallowing', async () => {
    const persistError = new Error('Firestore write failed');
    const deps = createMockDeps();
    deps.persist.mockRejectedValueOnce(persistError);
    const fighterKey = 'fighter@example.com';

    await expect(addCompletedTrainingLog(validInput, fighterKey, deps)).rejects.toBe(
      persistError,
    );
  });

  // ──────────────────────────────────────────────
  // Test 7: Coordinator returns the id from persistence
  // ──────────────────────────────────────────────
  it('returns the log id from the persistence result', async () => {
    const deps = createMockDeps();
    const expectedId = 'custom-log-id-12345';
    deps.persist.mockResolvedValueOnce(expectedId);
    const fighterKey = 'fighter@example.com';

    const logId = await addCompletedTrainingLog(validInput, fighterKey, deps);

    expect(logId).toBe(expectedId);
  });

  // ──────────────────────────────────────────────
  // Test 8: Completion does not depend on notes
  // ──────────────────────────────────────────────
  it('marks log as attended/completed regardless of notes presence', async () => {
    const deps = createMockDeps();
    const fighterKey = 'fighter@example.com';

    // Without notes
    await addCompletedTrainingLog(validInput, fighterKey, deps);
    let persistedRecord = deps.persist.mock.calls[0][1];
    expect(persistedRecord.log.attended).toBe(true);
    expect(persistedRecord.occurrence.status).toBe('completed');

    // With notes
    deps.persist.mockClear();
    const inputWithNotes = { ...validInput, notes: 'Session notes' };
    await addCompletedTrainingLog(inputWithNotes, fighterKey, deps);
    persistedRecord = deps.persist.mock.calls[0][1];
    expect(persistedRecord.log.attended).toBe(true);
    expect(persistedRecord.occurrence.status).toBe('completed');
  });

  // ──────────────────────────────────────────────
  // Test 9: Deterministic dependencies
  // ──────────────────────────────────────────────
  it('uses deterministic id/timestamp from optional deps', async () => {
    const deps = createMockDeps({
      generateId: () => 'deterministic-id',
      nowISO: () => '2026-08-14T18:00:00Z',
    });
    const fighterKey = 'fighter@example.com';

    await addCompletedTrainingLog(validInput, fighterKey, deps);

    const persistedRecord = deps.persist.mock.calls[0][1];
    expect(persistedRecord.id).toBe('deterministic-id');
    expect(persistedRecord.createdAt).toBe('2026-08-14T18:00:00Z');
    expect(persistedRecord.updatedAt).toBe('2026-08-14T18:00:00Z');
  });

  // ──────────────────────────────────────────────
  // Test 10: Validates before building/persisting
  // ──────────────────────────────────────────────
  it('validates before attempting to build or persist', async () => {
    const deps = createMockDeps();
    const inputWithNoTime: CompletedSelfPostedTrainingInput = {
      title: 'Training',
      dateISO: '2026-08-14',
      // no end time and no durationMinutes
    };

    await expect(
      addCompletedTrainingLog(inputWithNoTime, 'fighter@example.com', deps),
    ).rejects.toThrow();
    expect(deps.persist).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Test 11: Handles durationMinutes instead of end time
  // ──────────────────────────────────────────────
  it('builds record using durationMinutes when end time is not provided', async () => {
    const deps = createMockDeps();
    const inputWithDuration: CompletedSelfPostedTrainingInput = {
      title: 'Training',
      dateISO: '2026-08-14',
      start: '18:00',
      durationMinutes: 90,
    };

    await addCompletedTrainingLog(inputWithDuration, 'fighter@example.com', deps);

    const persistedRecord = deps.persist.mock.calls[0][1];
    expect(persistedRecord.log.actualStartDateTime).toBeDefined();
    expect(persistedRecord.log.actualEndDateTime).toBeDefined();
    // End time should be 90 minutes after start
  });
});
