import { describe, it, expect, vi } from 'vitest';
import { resolveWeekSourceData } from './useSessionHandlers';

describe('resolveWeekSourceData (A3 / #1187)', () => {
  it('returns scheduleData for the current week (no editingWeek)', async () => {
    const scheduleData = { Mandag: [{ id: 'a' }] };
    const fetchWeekData = vi.fn();
    const result = await resolveWeekSourceData({
      editingWeek: null,
      weekNum: 25,
      scheduleData,
      multiWeekData: {},
      fetchWeekData,
    });
    expect(result).toBe(scheduleData);
    expect(fetchWeekData).not.toHaveBeenCalled();
  });

  it('uses the in-memory week when it is loaded', async () => {
    const weekData = { Tirsdag: [{ id: 'b' }] };
    const fetchWeekData = vi.fn();
    const result = await resolveWeekSourceData({
      editingWeek: 24,
      weekNum: 24,
      scheduleData: {},
      multiWeekData: { 24: weekData },
      fetchWeekData,
    });
    expect(result).toBe(weekData);
    expect(fetchWeekData).not.toHaveBeenCalled();
  });

  it('does NOT wipe an unloaded week — fetches the real doc instead of using {}', async () => {
    // The regression: editing a past week that isn't in multiWeekData must not
    // resolve to {} (which would overwrite the stored week on save).
    const storedWeek = { Onsdag: [{ id: 'c', name: 'MMA' }] };
    const fetchWeekData = vi.fn().mockResolvedValue(storedWeek);
    const result = await resolveWeekSourceData({
      editingWeek: 12,
      weekNum: 12,
      scheduleData: {},
      multiWeekData: {}, // week 12 not loaded
      fetchWeekData,
    });
    expect(fetchWeekData).toHaveBeenCalledWith(12);
    expect(result).toBe(storedWeek);
    expect(result.Onsdag).toHaveLength(1);
  });

  it('resolves to {} only when the week genuinely does not exist in Firestore', async () => {
    const fetchWeekData = vi.fn().mockResolvedValue(null);
    const result = await resolveWeekSourceData({
      editingWeek: 99,
      weekNum: 99,
      scheduleData: {},
      multiWeekData: {},
      fetchWeekData,
    });
    expect(fetchWeekData).toHaveBeenCalledWith(99);
    expect(result).toEqual({});
  });
});
