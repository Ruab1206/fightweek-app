import { describe, it, expect } from 'vitest';
import { computeSeriesOccurrenceDates, recurrenceHorizonEndDate } from './computeSeriesOccurrences';

// RECURRENCE_HORIZON_WEEKS = 52
describe('computeSeriesOccurrenceDates (#1213 — series invite fans out across the full horizon)', () => {
  it('weekly series stops at the explicit end date (inclusive)', () => {
    const dates = computeSeriesOccurrenceDates({
      startDate: '2026-07-04', // a Saturday
      intervalWeeks: 1,
      endDate: '2026-07-25',
      horizonEndDate: '2027-07-04',
    });
    expect(dates).toEqual(['2026-07-04', '2026-07-11', '2026-07-18', '2026-07-25']);
  });

  it('open-ended weekly series materialises to the horizon, not infinitely', () => {
    const dates = computeSeriesOccurrenceDates({
      startDate: '2026-07-04',
      intervalWeeks: 1,
      endDate: null,
      horizonEndDate: '2027-07-03', // ~52 weeks later
    });
    // Every step keeps the same weekday and stays within the horizon cap.
    expect(dates[0]).toBe('2026-07-04');
    expect(dates.length).toBeGreaterThanOrEqual(51);
    expect(dates.length).toBeLessThanOrEqual(53);
    expect(dates[dates.length - 1] <= '2027-07-03').toBe(true);
    for (const d of dates) expect(new Date(d + 'T00:00:00').getDay()).toBe(6); // all Saturdays
  });

  it('bi-weekly series steps by 14 days', () => {
    const dates = computeSeriesOccurrenceDates({
      startDate: '2026-07-04',
      intervalWeeks: 2,
      endDate: '2026-08-15',
      horizonEndDate: '2027-07-04',
    });
    expect(dates).toEqual(['2026-07-04', '2026-07-18', '2026-08-01', '2026-08-15']);
  });

  it('horizon caps before the end date when the end date is further out', () => {
    const dates = computeSeriesOccurrenceDates({
      startDate: '2026-07-04',
      intervalWeeks: 1,
      endDate: '2030-01-01',
      horizonEndDate: '2026-07-25',
    });
    expect(dates).toEqual(['2026-07-04', '2026-07-11', '2026-07-18', '2026-07-25']);
  });

  it('returns [] for a non-recurring (interval 0) request', () => {
    expect(computeSeriesOccurrenceDates({
      startDate: '2026-07-04', intervalWeeks: 0, endDate: null, horizonEndDate: '2027-07-04',
    })).toEqual([]);
  });

  it('returns [] when the start is past the cap', () => {
    expect(computeSeriesOccurrenceDates({
      startDate: '2027-08-01', intervalWeeks: 1, endDate: null, horizonEndDate: '2027-07-04',
    })).toEqual([]);
  });

  it('does not roll a day back across DK summer time (local dates, not UTC)', () => {
    // A late-March start in UTC+1→+2 transition week must keep the same weekday.
    const dates = computeSeriesOccurrenceDates({
      startDate: '2026-03-21', intervalWeeks: 1, endDate: '2026-04-11', horizonEndDate: '2027-03-21',
    });
    expect(dates).toEqual(['2026-03-21', '2026-03-28', '2026-04-04', '2026-04-11']);
  });
});

describe('recurrenceHorizonEndDate', () => {
  it('is 52 weeks (364 days) ahead of the given date', () => {
    const end = recurrenceHorizonEndDate(new Date(2026, 6, 4)); // 2026-07-04
    expect(end).toBe('2027-07-03'); // +364 days
  });
});
