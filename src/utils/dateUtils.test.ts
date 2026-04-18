import { describe, it, expect } from 'vitest';
import { getDateForWeekDay, addMinutes, getISOWeekForDate, getWeekDateMap, getCompactWeekDateMap } from './dateUtils';

describe('getDateForWeekDay', () => {
  it('returns a Monday for Mandag', () => {
    const date = getDateForWeekDay(1, 'Mandag');
    expect(date).not.toBeNull();
    expect(date!.getDay()).toBe(1); // Monday
  });

  it('returns null for invalid day name', () => {
    expect(getDateForWeekDay(1, 'Foobar')).toBeNull();
  });

  it('returns Friday for Fredag', () => {
    const date = getDateForWeekDay(16, 'Fredag');
    expect(date).not.toBeNull();
    expect(date!.getDay()).toBe(5); // Friday
  });

  it('Sunday is day index 6 (Søndag)', () => {
    const date = getDateForWeekDay(10, 'Søndag');
    expect(date).not.toBeNull();
    expect(date!.getDay()).toBe(0); // Sunday
  });
});

describe('addMinutes', () => {
  it('adds 30 minutes to 09:00', () => {
    expect(addMinutes('09:00', 30)).toBe('09:30');
  });

  it('wraps across hour boundary', () => {
    expect(addMinutes('09:45', 30)).toBe('10:15');
  });

  it('returns empty string for empty input', () => {
    expect(addMinutes('', 30)).toBe('');
  });

  it('adds 90 minutes', () => {
    expect(addMinutes('14:00', 90)).toBe('15:30');
  });
});

describe('getISOWeekForDate', () => {
  it('returns week 1 for Jan 1 2024 (Monday)', () => {
    expect(getISOWeekForDate(new Date(2024, 0, 1))).toBe(1);
  });

  it('returns week 52 or 1 for Dec 31 depending on year', () => {
    // Dec 31, 2024 is a Tuesday → ISO week 1 of 2025
    expect(getISOWeekForDate(new Date(2024, 11, 31))).toBe(1);
  });

  it('April 14 2026 is week 16', () => {
    expect(getISOWeekForDate(new Date(2026, 3, 14))).toBe(16);
  });
});

describe('getWeekDateMap', () => {
  it('returns 7 entries', () => {
    const map = getWeekDateMap(16);
    expect(Object.keys(map)).toHaveLength(7);
    expect(map['Mandag']).toBeDefined();
    expect(map['Søndag']).toBeDefined();
  });
});

describe('getCompactWeekDateMap', () => {
  it('returns compact format like "14/4"', () => {
    const map = getCompactWeekDateMap(16);
    expect(Object.keys(map)).toHaveLength(7);
    // Compact format should contain a slash
    expect(map['Mandag']).toMatch(/\d+\/\d+/);
  });
});
