import { describe, it, expect } from 'vitest';
import { shouldApplyRecurrence } from './SessionModal';

describe('shouldApplyRecurrence (#1183)', () => {
  it('applies recurrence for a new session with an interval', () => {
    expect(shouldApplyRecurrence({ interval: 1, isNew: true, recurrenceTouched: false })).toBe(true);
  });

  it('does NOT apply recurrence when editing/cancelling an existing recurring instance', () => {
    // The regression: opening an existing recurring session defaults interval to 1.
    // Cancelling that one instance must update only it, not rebuild the series.
    expect(shouldApplyRecurrence({ interval: 1, isNew: false, recurrenceTouched: false })).toBe(false);
  });

  it('re-applies recurrence when the user explicitly changes the selector on an existing session', () => {
    expect(shouldApplyRecurrence({ interval: 2, isNew: false, recurrenceTouched: true })).toBe(true);
  });

  it('never applies recurrence when interval is 0 (no repeat)', () => {
    expect(shouldApplyRecurrence({ interval: 0, isNew: true, recurrenceTouched: true })).toBe(false);
    expect(shouldApplyRecurrence({ interval: 0, isNew: false, recurrenceTouched: false })).toBe(false);
  });
});
