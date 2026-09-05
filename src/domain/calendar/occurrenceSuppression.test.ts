import { describe, it, expect } from 'vitest';
import { buildOccurrenceSuppression, suppressionDocId } from './occurrenceSuppression';

describe('suppressionDocId', () => {
  it('uses a plain local YYYY-MM-DD date verbatim (safe, unique-per-weekly-occurrence doc id)', () => {
    expect(suppressionDocId('2026-09-07')).toBe('2026-09-07');
  });

  it('is deterministic — the same occurrence date always yields the same id (idempotent retry)', () => {
    expect(suppressionDocId('2026-09-07')).toBe(suppressionDocId('2026-09-07'));
  });

  it('encodes a non-plain-date string and never leaves a forbidden "/"', () => {
    const id = suppressionDocId('weird/value');
    expect(id).not.toContain('/');
  });
});

describe('buildOccurrenceSuppression', () => {
  it('builds identity from (seriesId, occurrenceDateISO) with reason "deleted"', () => {
    const s = buildOccurrenceSuppression({ seriesId: 'S1', occurrenceDateISO: '2026-09-07', now: '2026-09-05T10:00:00.000Z' });
    expect(s).toEqual({
      seriesId: 'S1',
      occurrenceDateISO: '2026-09-07',
      reason: 'deleted',
      createdAt: '2026-09-05T10:00:00.000Z',
    });
  });

  it('carries no title/time/category/location — identity is date-only', () => {
    const s = buildOccurrenceSuppression({ seriesId: 'S1', occurrenceDateISO: '2026-09-07' });
    expect(Object.keys(s).sort()).toEqual(['createdAt', 'occurrenceDateISO', 'reason', 'seriesId']);
  });
});
