# Fightweek Copilot Instructions

Fightweek is a React 18 + TypeScript + Firebase/Firestore app for MMA fighters to schedule, participate in and log training and martial arts events.

## Current technical context

- Frontend: React 18 + TypeScript
- Styling: Tailwind CSS
- Backend/data: Firebase Firestore + Firebase Auth
- Hosting: Vercel
- Build: Vite
- E2E direction: Playwright

The current backend remains Firestore. Do not migrate to Postgres/Supabase unless explicitly requested.

## Core domain terms

Use the new scheduling domain language:

- EventSeries: recurring/source definition for repeated events.
- EventOccurrence: one concrete scheduled event in time.
- CalendarEntry: occurrence shown on a user, organization or system calendar.
- EventSeriesParticipation: user response/intention for a recurring series.
- EventOccurrenceParticipation: user response/status for one occurrence.
- EventLog: fighter journal/log after an occurrence.
- Favorite: private bookmark, separate from participation.

## Fightweek canonical data-model gate

Before changing calendar, occurrence, participation, notes, TrainingLog/EventLog, favorites, persistence, projection, or routing:

- Read `/docs/self_posted_lifecycle_and_invariants.md` (the **normative** canonical contract) plus the linked `/docs/target_architecture.md` and `/docs/fightweek_decisions.md`.
- Treat the lifecycle-and-invariants document as normative; it governs where it overlaps the target architecture.
- Do **not** create use-case-specific domain or persisted types from a UI entry point.
- Do **not** make CalendarEntry depend on TrainingLog.
- Do **not** infer Participation from CalendarEntry, TrainingLog, or Note.
- Do **not** introduce a new CalendarEntry source until the documented lifecycle gate permits it (invariants I2/I18).
- Every implementation plan must list the affected invariants and classify any new construct as durable or TRANSITIONAL.
- Business rules must be identical across desktop, mobile, and SearchOverlay.
- Stop and report a guardrail concern **before** implementation if the plan violates or cannot satisfy the contract. For a full pre-implementation review, use `/.github/prompts/fightweek-architecture-check.prompt.md`.

## Architecture decisions: PO, architect, and builder roles

Material domain/lifecycle architecture decisions combine three inputs: PO product/user-journey guidance, solution-architect lifecycle/invariant assessment, and builder repository evidence. The builder role is not purely implementation — for material domain or lifecycle analysis, state explicitly: the product assumptions visible in the repository; whether each appears durable, transitional, or accidental; whether repository evidence supports or contradicts current PO guidance; and whether a PO clarification could materially change the architecture. Do not decide product meaning yourself — surface the evidence so the PO and architect can decide.


## Core rules

- Logged occurrences must never be hard-deleted.
- If an EventLog exists, preserve enough event data to understand the log later.
- Series-level changes must not silently overwrite occurrence-level exceptions.
- EventOccurrence.series_id may be null.
- Event type and discipline/category are separate.
- Favorites are separate from CalendarEntries and Participation.
- Planning data belongs on CalendarEntry.
- Invite/RSVP/enrollment/attendance belongs on Participation.
- Training reflection belongs on EventLog.

## Refactoring principles

Prefer:

- Small, reversible changes.
- Domain types and adapters before persistence changes.
- Tests before risky behavior changes.
- Firestore-compatible refactoring for now.
- Clear file-specific summaries.

Avoid:

- Broad rewrites.
- Silent Firestore data-shape changes.
- Introducing future concepts before requested.
- Mixing EventOccurrence, CalendarEntry, Participation and EventLog.
- Deleting or hiding historical logged training data.

## Important docs

Use these when relevant, but do not read all of them by default:

- /docs/self_posted_lifecycle_and_invariants.md (normative for self-posted lifecycle work — see the data-model gate above)
- /docs/fightweek_decisions.md
- /docs/fightweek_domain_model.md
- /docs/fightweek_core_flows.md
- /docs/fightweek_test_scenarios.md
- /docs/fightweek_database_model.dbml

For risky or unclear implementation tasks, use:

- /.github/prompts/grill-me.prompt.md