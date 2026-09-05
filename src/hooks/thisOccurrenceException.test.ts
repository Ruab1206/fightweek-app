import { describe, it, expect } from 'vitest';
import { mergeThisOccurrenceEdit } from './useSessionHandlers';

// Slice 2a — this-occurrence edit marks a series member as an explicit
// exception while preserving series identity + occurrence identity. Pure.

describe('mergeThisOccurrenceEdit', () => {
  it('marks a series occurrence as an explicit exception and preserves its seriesId', () => {
    const existing = { id: 'occ-1', seriesId: 'S1', name: 'MMA Sparring', start: '17:00', isRecurring: true };
    const submitted = { id: 'occ-1', name: 'MMA Sparring (edited)', start: '18:00' };
    const merged = mergeThisOccurrenceEdit(existing, submitted);
    expect(merged.seriesId).toBe('S1');
    expect(merged.isSeriesException).toBe(true);
    expect(merged.id).toBe('occ-1');          // occurrence identity preserved
    expect(merged.name).toBe('MMA Sparring (edited)'); // submitted fields applied
    expect(merged.start).toBe('18:00');
  });

  it('a repeated edit of an already-exception occurrence stays an exception', () => {
    const existing = { id: 'occ-1', seriesId: 'S1', isSeriesException: true, name: 'X', start: '17:00' };
    const submitted = { id: 'occ-1', name: 'X2', start: '17:00' };
    const merged = mergeThisOccurrenceEdit(existing, submitted);
    expect(merged.seriesId).toBe('S1');
    expect(merged.isSeriesException).toBe(true);
  });

  it('a legacy occurrence without seriesId is returned unchanged (no seriesId, no exception flag)', () => {
    const existing = { id: 'legacy-1', name: 'Old', start: '17:00', isRecurring: true };
    const submitted = { id: 'legacy-1', name: 'Old edited', start: '17:00' };
    const merged = mergeThisOccurrenceEdit(existing, submitted);
    expect('seriesId' in merged).toBe(false);
    expect('isSeriesException' in merged).toBe(false);
    expect(merged).toBe(submitted);
  });

  it('does not infer an exception from field differences alone (no seriesId → no flag even when fields differ)', () => {
    const existing = { id: 'x', name: 'A', start: '10:00', location: 'Old' };
    const submitted = { id: 'x', name: 'B', start: '11:00', location: 'New' };
    const merged = mergeThisOccurrenceEdit(existing, submitted);
    expect('isSeriesException' in merged).toBe(false);
  });
});
