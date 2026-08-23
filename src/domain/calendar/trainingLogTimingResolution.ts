/**
 * trainingLogTimingResolution — read-side occurrence-timing resolver.
 *
 * Settled product rule: for a TrainingLog with exactly one exact calendar
 * association, the associated occurrence (a new-model aggregate's
 * occurrence, or an adapted legacy calendar session) is authoritative for
 * start, end, and duration — taking priority over the log's own snapshot.
 * When no exact associated occurrence is supplied, or its timing is not both
 * offset-free local wall-clock values, this falls back to the committed
 * ambiguity-preserving compatibility reader (`buildTrainingLogHistoryItem`).
 * Never used for the `'conflict'` classification state — a data-integrity
 * conflict must not have timing derived on its behalf.
 *
 * Pure — no Firestore, no React, no mutation of `record`.
 */
import { logToHistoryItem } from './selfPostedTraining';
import { buildTrainingLogHistoryItem, computeExactLocalDurationMinutes } from './trainingLogSnapshotCompatibility';
import type { CompletedSelfPostedTrainingLog, TrainingHistoryItem } from './types';

/** Minimal timing shape of the exact associated occurrence. */
export interface AssociatedOccurrenceTiming {
  startDateTime: string;
  endDateTime: string;
}

/**
 * Build the presentation `TrainingHistoryItem` for one TrainingLog,
 * preferring the exact associated occurrence's timing when it is present
 * and safely computable, else falling back to the compatibility reader.
 */
export function resolveTrainingLogHistoryItem(
  record: CompletedSelfPostedTrainingLog,
  associatedOccurrenceTiming?: AssociatedOccurrenceTiming | null,
): TrainingHistoryItem {
  if (associatedOccurrenceTiming) {
    const durationMinutes = computeExactLocalDurationMinutes(
      associatedOccurrenceTiming.startDateTime,
      associatedOccurrenceTiming.endDateTime,
    );
    if (durationMinutes !== null) {
      return {
        ...logToHistoryItem(record),
        startDateTime: associatedOccurrenceTiming.startDateTime,
        endDateTime: associatedOccurrenceTiming.endDateTime,
        durationMinutes,
        durationCertainty: 'exact',
      };
    }
  }
  return buildTrainingLogHistoryItem(record);
}
