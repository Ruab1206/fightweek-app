import { describe, it, expect } from 'vitest';
import { computeRecurringWeeks } from './useSessionHandlers';

describe('computeRecurringWeeks (#1183 — recurrence horizon)', () => {
  it('weekly "never ends" fills every week up to the horizon (not the loaded window)', () => {
    // The regression: a never-ending weekly series from week 25 used to stop at
    // the loaded scroll edge (~week 30). It must now reach the horizon.
    const weeks = computeRecurringWeeks({ startWeek: 25, interval: 1, endWeek: null, horizonWeek: 77 });
    expect(weeks[0]).toBe(25);
    expect(weeks[weeks.length - 1]).toBe(77);
    expect(weeks).toContain(30);
    expect(weeks).toContain(50);
    expect(weeks).toHaveLength(53); // 25..77 inclusive
  });

  it('respects an explicit end week', () => {
    const weeks = computeRecurringWeeks({ startWeek: 25, interval: 1, endWeek: 28, horizonWeek: 77 });
    expect(weeks).toEqual([25, 26, 27, 28]);
  });

  it('caps the end week at the horizon', () => {
    const weeks = computeRecurringWeeks({ startWeek: 25, interval: 1, endWeek: 200, horizonWeek: 30 });
    expect(weeks[weeks.length - 1]).toBe(30);
  });

  it('steps by the interval for every-N-weeks', () => {
    const weeks = computeRecurringWeeks({ startWeek: 25, interval: 2, endWeek: null, horizonWeek: 33 });
    expect(weeks).toEqual([25, 27, 29, 31, 33]);
  });

  it('returns nothing for interval 0', () => {
    expect(computeRecurringWeeks({ startWeek: 25, interval: 0, endWeek: null, horizonWeek: 77 })).toEqual([]);
  });
});
