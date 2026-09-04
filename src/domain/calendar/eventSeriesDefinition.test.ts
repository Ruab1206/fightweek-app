import { describe, it, expect } from 'vitest';
import { buildEventSeriesDefinition } from './eventSeriesDefinition';

describe('buildEventSeriesDefinition', () => {
  const base = {
    seriesId: 'series-1',
    ownerKey: 'rune@x',
    title: 'MMA Sparring',
    discipline: 'MMA',
    location: 'Klub A',
    dayOfWeek: 1,
    startTime: '17:00',
    endTime: '18:30',
    startDate: '2026-09-07',
    intervalWeeks: 1,
    endDate: null as string | null,
    now: '2026-09-04T10:00:00.000Z',
  };

  it('sets id to the seriesId and type to self_posted_training', () => {
    const def = buildEventSeriesDefinition(base);
    expect(def.id).toBe('series-1');
    expect(def.type).toBe('self_posted_training');
  });

  it('preserves endDate: null verbatim as open-ended (never the horizon)', () => {
    const def = buildEventSeriesDefinition(base);
    expect(def.endDate).toBeNull();
  });

  it('persists an explicit end date when provided', () => {
    const def = buildEventSeriesDefinition({ ...base, endDate: '2026-12-31' });
    expect(def.endDate).toBe('2026-12-31');
  });

  it('carries owner, anchor, times, start, interval and active status', () => {
    const def = buildEventSeriesDefinition(base);
    expect(def).toMatchObject({
      ownerKey: 'rune@x',
      dayOfWeek: 1,
      startTime: '17:00',
      endTime: '18:30',
      startDate: '2026-09-07',
      intervalWeeks: 1,
      status: 'active',
      createdAt: '2026-09-04T10:00:00.000Z',
      updatedAt: '2026-09-04T10:00:00.000Z',
    });
  });

  it('omits discipline and location when absent (no empty placeholders)', () => {
    const def = buildEventSeriesDefinition({ ...base, discipline: undefined, location: undefined });
    expect('discipline' in def).toBe(false);
    expect('location' in def).toBe(false);
  });
});
