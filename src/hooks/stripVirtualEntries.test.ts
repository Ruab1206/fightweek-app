import { describe, it, expect } from 'vitest';
import { stripVirtualEntries } from './useScheduleData';

describe('stripVirtualEntries', () => {
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

    const result = stripVirtualEntries(weekData);

    expect(result.Mandag).toHaveLength(2);
    expect(result.Mandag.map((s: any) => s.name)).toEqual(['MMA', 'Boksning']);
    expect(result.Tirsdag).toHaveLength(0);
    expect(result.lastUpdated).toBe('2026-04-18T10:00:00Z');
  });

  it('removes sessions with type "calendar_entry" (Checkpoint B projected new-model entries)', () => {
    const weekData = {
      Mandag: [
        { id: 1, name: 'MMA', type: 'training' },
        { id: 2, name: 'Solo run', type: 'calendar_entry', readOnly: true },
      ],
    };

    const result = stripVirtualEntries(weekData);

    expect(result.Mandag).toHaveLength(1);
    expect(result.Mandag[0].name).toBe('MMA');
  });

  it('does not remove "invitation" entries (unrelated behavior, unchanged)', () => {
    const weekData = {
      Mandag: [
        { id: 1, name: 'MMA', type: 'training' },
        { id: 2, name: 'Invited class', type: 'invitation' },
      ],
    };

    const result = stripVirtualEntries(weekData);

    expect(result.Mandag).toHaveLength(2);
    expect(result.Mandag.map((s: any) => s.type)).toEqual(['training', 'invitation']);
  });

  it('does not mutate the original data', () => {
    const weekData = {
      Mandag: [
        { id: 1, name: 'MMA', type: 'training' },
        { id: 2, name: 'Fight Night', type: 'event' },
        { id: 3, name: 'Solo run', type: 'calendar_entry' },
      ],
    };

    stripVirtualEntries(weekData);

    expect(weekData.Mandag).toHaveLength(3);
  });

  it('handles empty week data', () => {
    const result = stripVirtualEntries({});
    expect(result).toEqual({});
  });

  it('preserves non-array fields', () => {
    const weekData = {
      lastUpdated: '2026-04-18T10:00:00Z',
      Mandag: [{ id: 1, type: 'event' }],
      notes: 'some text',
    };

    const result = stripVirtualEntries(weekData);
    expect(result.notes).toBe('some text');
    expect(result.lastUpdated).toBe('2026-04-18T10:00:00Z');
    expect(result.Mandag).toHaveLength(0);
  });
});
