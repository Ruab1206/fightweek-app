/**
 * logCoordinator.ts — Pure coordinator for creating completed training logs.
 *
 * A thin orchestrator that:
 * 1. Validates input (using existing validator).
 * 2. Builds a complete log record (using existing builder).
 * 3. Calls injected persistence (never direct Firestore).
 * 4. Returns the log id or propagates errors.
 *
 * No Firebase, React, or hooks. The future React hook will inject the
 * real eventLogService.addCompletedSelfPostedTrainingLog function.
 *
 * Domain flow: User chooses "log completed training" flow with structured
 * input (title, date, time, optional notes) → validates → builds record
 * (with occurrence snapshot + calendar entry reference + log data) →
 * persists → returns id.
 *
 * Completion is established by the explicit "log completed training" flow
 * (structured fields), not by the presence of a note. Notes are optional
 * context only.
 */
import {
  validateCompletedSelfPostedTrainingInput,
  buildCompletedSelfPostedTrainingLog,
  type CompletedSelfPostedTrainingInput,
} from './selfPostedTraining';
import type { CompletedSelfPostedTrainingLog } from './types';

/**
 * Injectable persistence function and optional id/clock.
 *
 * `persist`: Takes (fighterKey, record) and returns the persisted log id.
 * `generateId` and `nowISO`: Optional deterministic id/timestamp generators
 * for testing (passed through to the builder).
 */
export interface AddCompletedTrainingLogDeps {
  /** Persist the completed log and return its id. */
  persist: (
    fighterKey: string,
    record: CompletedSelfPostedTrainingLog,
  ) => Promise<string>;
  /** Optional deterministic id generator for testing. */
  generateId?: () => string;
  /** Optional deterministic clock for testing. */
  nowISO?: () => string;
  /** Optional deterministic current-instant clock for the future-date/time validation rule. */
  now?: () => Date;
}

/**
 * Create and persist a completed self-posted training log.
 *
 * Pure orchestrator: validates input, builds a complete record, calls
 * injected persistence, returns the log id.
 *
 * @param input Structured training log input (title, date, time, notes, etc.).
 * @param fighterKey Already-resolved fighter email/key.
 * @param dependencies Injected persistence and optional deterministic deps.
 * @returns The persisted log id.
 * @throws Validation error if input is invalid, or persistence error if write fails.
 */
export async function addCompletedTrainingLog(
  input: CompletedSelfPostedTrainingInput,
  fighterKey: string,
  dependencies: AddCompletedTrainingLogDeps,
): Promise<string> {
  // Guard: fighterKey required
  if (!fighterKey) {
    throw new Error('addCompletedTrainingLog: fighterKey is required');
  }

  // Step 1: Validate input
  const validationErrors = validateCompletedSelfPostedTrainingInput(input, {
    now: dependencies.now,
  });
  if (validationErrors.length > 0) {
    throw new Error(
      `addCompletedTrainingLog: validation failed:\n${validationErrors.join('\n')}`,
    );
  }

  // Step 2: Build the complete record (occurrence snapshot + calendar entry + log)
  const record = buildCompletedSelfPostedTrainingLog(input, {
    generateId: dependencies.generateId,
    nowISO: dependencies.nowISO,
  });

  // Step 3: Persist and return id
  const logId = await dependencies.persist(fighterKey, record);

  return logId;
}
