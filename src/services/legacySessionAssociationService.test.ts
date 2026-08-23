/**
 * legacySessionAssociationService.test.ts — TRANSITIONAL legacy week-document
 * loader (one Firestore call, no cache, no session matching). Mocked
 * Firestore (same pattern as calendarEntryService.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.fn();
const mockDoc = vi.fn((..._args: unknown[]) => ({ __doc: _args.join('/') }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));
vi.mock('../config/firebase', () => ({ db: {} }));

import { loadLegacyWeekDocument } from './legacySessionAssociationService';

function fakeSnap(exists: boolean, data?: unknown) {
  return { exists: () => exists, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadLegacyWeekDocument', () => {
  it('returns the week document data when it exists', async () => {
    mockGetDoc.mockResolvedValueOnce(fakeSnap(true, {
      Torsdag: [{ id: 'sess-1', name: 'MMA Sparring', start: '17:00', end: '18:30' }],
    }));

    const weekData = await loadLegacyWeekDocument('fighter@example.com', 31);

    expect(weekData).toEqual({ Torsdag: [{ id: 'sess-1', name: 'MMA Sparring', start: '17:00', end: '18:30' }] });
    expect(mockDoc).toHaveBeenCalledWith({}, 'artifacts/production/users', 'fighter@example.com', 'weeks', 'week_31');
  });

  it('returns null when the week document does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce(fakeSnap(false));

    const weekData = await loadLegacyWeekDocument('fighter@example.com', 31);

    expect(weekData).toBeNull();
  });

  it('performs exactly one getDoc call per invocation', async () => {
    mockGetDoc.mockResolvedValueOnce(fakeSnap(false));

    await loadLegacyWeekDocument('fighter@example.com', 31);

    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  it('propagates a rejected read (caller decides fallback behaviour)', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('network error'));

    await expect(loadLegacyWeekDocument('fighter@example.com', 31)).rejects.toThrow('network error');
  });
});

