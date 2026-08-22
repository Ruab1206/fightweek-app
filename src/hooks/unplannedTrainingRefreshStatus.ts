/**
 * unplannedTrainingRefreshStatus — small application-orchestration helper:
 * pure decision logic for when a post-creation calendarEntries/eventLogs
 * refresh (triggered after a successful atomic unplanned-training save) has
 * settled, and whether it settled with a failure.
 *
 * Extracted so App.tsx's refresh-after-create wiring can be unit-tested
 * without mounting the whole App component. Contains no domain or
 * persistence behaviour — only the timing/status decision itself.
 */
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** True once neither status is still `'loading'`. */
export function isUnplannedTrainingRefreshSettled(
  calendarEntriesStatus: LoadStatus,
  eventLogsStatus: LoadStatus,
): boolean {
  return calendarEntriesStatus !== 'loading' && eventLogsStatus !== 'loading';
}

/** True if either refresh settled with `'error'`. Call only once settled. */
export function didUnplannedTrainingRefreshFail(
  calendarEntriesStatus: LoadStatus,
  eventLogsStatus: LoadStatus,
): boolean {
  return calendarEntriesStatus === 'error' || eventLogsStatus === 'error';
}

/** `null` when no post-create refresh is pending; otherwise the fighter it was started for. */
export type PendingUnplannedTrainingRefresh = { fighterKey: string } | null;

/**
 * True only when a refresh is pending AND it was started for the fighter
 * that is currently active. Once the active fighter changes, that fighter's
 * own status changes must never be read as this refresh's outcome.
 */
export function isPendingRefreshOwnedByActiveFighter(
  pending: PendingUnplannedTrainingRefresh,
  activeFighterKey: string,
): boolean {
  return pending !== null && pending.fighterKey === activeFighterKey;
}
