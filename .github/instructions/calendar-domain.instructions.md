---
applyTo: "src/domain/calendar/**,src/services/calendarEntryService*,src/services/eventLogService*,src/services/unplannedTrainingService*,src/hooks/useCalendarEntries*,src/hooks/useCalendarEntryMerge*,src/hooks/useEventLogs*,src/hooks/unplannedTrainingRefreshStatus*,src/components/SessionModal*,src/components/TrainingLogDetailSheet*,src/components/ProjectedCalendarEntryStatusSheet*,src/pages/TrainingLogPage*,src/App.tsx,firestore.rules"
---

# Calendar / self-posted domain instructions

These rules apply automatically when working on the self-posted calendar/occurrence/log
domain, its services, hooks, presentation/routing, Firestore rules, and their tests.
They do not restate the contract — they enforce it.

## Mandatory before editing

- Read `/docs/self_posted_lifecycle_and_invariants.md` (the **normative** contract) first.
- In your plan, **list the affected invariants** (I1–I18) before making changes.
- Classify any new record, envelope, projection, or discriminator as **durable** or **TRANSITIONAL**;
  for transitional constructs, state why they exist, which invariant they cannot yet satisfy,
  their replacement direction, and their retirement condition (I17).

## Hard constraints

- Do **not** introduce a UI-entry-specific persisted type (I15).
- Do **not** make `CalendarEntry` obligatorily depend on `TrainingLog` (I2); do **not** add a new
  `CalendarEntry` source while that coupling exists (I18).
- Do **not** infer `Participation` from `CalendarEntry`, `TrainingLog`, or `Note` (I5).
- Do **not** route primary domain behaviour by persistence collection or UI origin; capability
  differences must be explicit application decisions, not inferred in presentation (I11, I16).
- Business rules must be implemented **once** and used identically across desktop, mobile, and
  SearchOverlay (I13) — one shared application operation, not per-surface logic.

## Stop condition

If contract compliance is uncertain, or the change would violate any stop condition in the
canonical contract (Section G), **stop and report a guardrail concern before implementing**.
For a full pre-implementation review, run `/.github/prompts/fightweek-architecture-check.prompt.md`.
