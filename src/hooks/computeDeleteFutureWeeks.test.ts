import { describe, it, expect } from 'vitest';
import { computeDeleteFutureWeeks } from './useSessionHandlers';

// RECURRENCE_HORIZON_WEEKS = 52
describe('computeDeleteFutureWeeks (#1183 follow-up — delete reaches the horizon)', () => {
  it('extends to the 1-year horizon, not just the loaded scroll window', () => {
    // Regression: with systemWeek 25 the loaded window ended ~week 31, so future
    // occurrences of a year-long series survived "delete this and all future".
    const weeks = computeDeleteFutureWeeks({
      fromWeek: 30,
      systemWeek: 25,
      loadedWeeks: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
    });
    expect(weeks[0]).toBe(30);
    expect(weeks[weeks.length - 1]).toBe(25 + 52); // 77
    expect(weeks).toContain(40);
    expect(weeks).toContain(60);
  });

  it('covers loaded weeks that extend beyond the horizon', () => {
    const weeks = computeDeleteFutureWeeks({
      fromWeek: 30,
      systemWeek: 25,
      loadedWeeks: [30, 90],
    });
    expect(weeks[weeks.length - 1]).toBe(90);
  });

  it('returns just fromWeek..horizon when no loaded weeks given', () => {
    const weeks = computeDeleteFutureWeeks({ fromWeek: 77, systemWeek: 25, loadedWeeks: [] });
    expect(weeks).toEqual([77]); // fromWeek equals horizon
  });

  it('every week is contiguous from fromWeek', () => {
    const weeks = computeDeleteFutureWeeks({ fromWeek: 50, systemWeek: 40, loadedWeeks: [] });
    expect(weeks[0]).toBe(50);
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i]).toBe(weeks[i - 1] + 1);
    }
    expect(weeks[weeks.length - 1]).toBe(92); // 40 + 52
  });
});
