import { describe, it, expect } from 'vitest';
import { stripEvents } from './useScheduleData';

describe('stripEvents', () => {
  it('removes sessions with type "event"', () => {
    const weekData = {
      Mandag: [
        { id: 1, name: 'MMA', type: 'training' },
        { id: 2, name: 'Gustav Cup', type: 'event' },
        { id: 3, name: 'Boksning', start: '18:00' },
      ],
      Tirsdag: [
        { id: 4, name: 'Open Mat', type: 'event' },
      ],
      lastUpdated: '2026-04-18T10:00:00Z',
    };

    const result = stripEvents(weekData);

    expect(result.Mandag).toHaveLength(2);
    expect(result.Mandag.map((s: any) => s.name)).toEqual(['MMA', 'Boksning']);
    expect(result.Tirsdag).toHaveLength(0);
    expect(result.lastUpdated).toBe('2026-04-18T10:00:00Z');
  });

  it('does not mutate the original data', () => {
    const weekData = {
      Mandag: [
        { id: 1, name: 'MMA', type: 'training' },
        { id: 2, name: 'Fight Night', type: 'event' },
      ],
    };

    stripEvents(weekData);

    expect(weekData.Mandag).toHaveLength(2);
  });

  it('handles empty week data', () => {
    const result = stripEvents({});
    expect(result).toEqual({});
  });

  it('preserves non-array fields', () => {
    const weekData = {
      lastUpdated: '2026-04-18T10:00:00Z',
      Mandag: [{ id: 1, type: 'event' }],
      notes: 'some text',
    };

    const result = stripEvents(weekData);
    expect(result.notes).toBe('some text');
    expect(result.lastUpdated).toBe('2026-04-18T10:00:00Z');
    expect(result.Mandag).toHaveLength(0);
  });
});
