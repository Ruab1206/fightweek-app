/**
 * seriesEditScopeEligibility.test.ts — characterizes the future this-and-
 * following UI-wiring contract (foundation only; SessionModal/App.tsx are
 * NOT wired to this in this slice). The no-change-Save-is-a-no-op and
 * non-recurring-Save-is-unchanged behaviors already have direct coverage in
 * SessionModalEditScope.test.tsx and are not duplicated here.
 */
import { describe, it, expect } from 'vitest';
import { evaluateThisAndFollowingEligibility } from './seriesEditScopeEligibility';

const TODAY = '2026-06-15';

describe('evaluateThisAndFollowingEligibility', () => {
  it('is eligible for a durable-series occurrence dated today', () => {
    expect(evaluateThisAndFollowingEligibility({ isRecurring: true, seriesId: 's1', occurrenceDateISO: TODAY, todayISO: TODAY }))
      .toEqual({ eligible: true });
  });

  it('is eligible for a durable-series occurrence dated in the future', () => {
    expect(evaluateThisAndFollowingEligibility({ isRecurring: true, seriesId: 's1', occurrenceDateISO: '2026-06-22', todayISO: TODAY }))
      .toEqual({ eligible: true });
  });

  it('is ineligible (historical) for a durable-series occurrence dated in the past', () => {
    expect(evaluateThisAndFollowingEligibility({ isRecurring: true, seriesId: 's1', occurrenceDateISO: '2026-06-14', todayISO: TODAY }))
      .toEqual({ eligible: false, reason: 'historical' });
  });

  it('is ineligible (no_durable_series) for a legacy recurring occurrence dated today or later', () => {
    expect(evaluateThisAndFollowingEligibility({ isRecurring: true, occurrenceDateISO: TODAY, todayISO: TODAY }))
      .toEqual({ eligible: false, reason: 'no_durable_series' });
    expect(evaluateThisAndFollowingEligibility({ isRecurring: true, occurrenceDateISO: '2026-06-22', todayISO: TODAY }))
      .toEqual({ eligible: false, reason: 'no_durable_series' });
  });

  it('reports historical (not no_durable_series) for a past legacy recurring occurrence — historical takes precedence', () => {
    expect(evaluateThisAndFollowingEligibility({ isRecurring: true, occurrenceDateISO: '2026-06-14', todayISO: TODAY }))
      .toEqual({ eligible: false, reason: 'historical' });
  });

  it('is ineligible (not_recurring) for a non-recurring session regardless of seriesId or date', () => {
    expect(evaluateThisAndFollowingEligibility({ isRecurring: false, seriesId: 's1', occurrenceDateISO: '2026-06-22', todayISO: TODAY }))
      .toEqual({ eligible: false, reason: 'not_recurring' });
  });
});
