/**
 * unplannedTrainingRefreshStatus.test.ts — pure state-transition logic for
 * deciding when a post-creation calendarEntries/eventLogs refresh has
 * settled, and whether it settled with a failure. No React, no Firebase.
 */
import { describe, it, expect } from 'vitest';
import {
  isUnplannedTrainingRefreshSettled,
  didUnplannedTrainingRefreshFail,
  isPendingRefreshOwnedByActiveFighter,
} from './unplannedTrainingRefreshStatus';

describe('isUnplannedTrainingRefreshSettled', () => {
  it('is not settled while either status is loading', () => {
    expect(isUnplannedTrainingRefreshSettled('loading', 'loaded')).toBe(false);
    expect(isUnplannedTrainingRefreshSettled('loaded', 'loading')).toBe(false);
    expect(isUnplannedTrainingRefreshSettled('loading', 'loading')).toBe(false);
  });

  it('is settled once both statuses are out of loading', () => {
    expect(isUnplannedTrainingRefreshSettled('loaded', 'loaded')).toBe(true);
    expect(isUnplannedTrainingRefreshSettled('error', 'loaded')).toBe(true);
    expect(isUnplannedTrainingRefreshSettled('loaded', 'error')).toBe(true);
    expect(isUnplannedTrainingRefreshSettled('error', 'error')).toBe(true);
    expect(isUnplannedTrainingRefreshSettled('idle', 'idle')).toBe(true);
  });
});

describe('didUnplannedTrainingRefreshFail', () => {
  it('reports no failure when both settled successfully', () => {
    expect(didUnplannedTrainingRefreshFail('loaded', 'loaded')).toBe(false);
  });

  it('reports failure when calendarEntries settled with an error', () => {
    expect(didUnplannedTrainingRefreshFail('error', 'loaded')).toBe(true);
  });

  it('reports failure when eventLogs settled with an error', () => {
    expect(didUnplannedTrainingRefreshFail('loaded', 'error')).toBe(true);
  });

  it('reports failure when both settled with an error', () => {
    expect(didUnplannedTrainingRefreshFail('error', 'error')).toBe(true);
  });

  it('does not report failure for idle (never contacted)', () => {
    expect(didUnplannedTrainingRefreshFail('idle', 'idle')).toBe(false);
  });
});

describe('isPendingRefreshOwnedByActiveFighter', () => {
  it('is false when nothing is pending', () => {
    expect(isPendingRefreshOwnedByActiveFighter(null, 'fighterA@example.com')).toBe(false);
  });

  it('is true when the pending fighter matches the active fighter', () => {
    expect(
      isPendingRefreshOwnedByActiveFighter({ fighterKey: 'fighterA@example.com' }, 'fighterA@example.com'),
    ).toBe(true);
  });

  it('is false once the active fighter differs from the pending fighter', () => {
    expect(
      isPendingRefreshOwnedByActiveFighter({ fighterKey: 'fighterA@example.com' }, 'fighterB@example.com'),
    ).toBe(false);
  });

  it('is false for an empty active fighter key, even if pending somehow held one', () => {
    expect(isPendingRefreshOwnedByActiveFighter({ fighterKey: 'fighterA@example.com' }, '')).toBe(false);
  });

  it('does not resurrect a previously invalidated pending value once cleared', () => {
    // Simulates: switch away (invalidated to null) then switch back to the
    // original fighter — ownership must stay false, never reattach.
    expect(isPendingRefreshOwnedByActiveFighter(null, 'fighterA@example.com')).toBe(false);
  });
});
