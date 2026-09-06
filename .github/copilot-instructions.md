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

## Collaboration model (roles, autonomy, gates)

**Roles.** Rune = Product Owner (user value, UX, business rules, priority, privacy, major complexity trade-offs). M365 Copilot = solution architect (architectural coherence, domain-model guardrails, environment/migration gates, technical sequencing, translating PO outcomes into builder delegations). GitHub Copilot (you) = repository-informed builder (repository inspection, technical dissent, internal design, implementation, tests, diff review, logical commit composition). For material domain/lifecycle analysis, surface repository evidence and classify each construct as durable / transitional / accidental — do not decide product meaning yourself.

**Builder autonomy — Level 1 is the default for category-A technical work.** You choose files, module boundaries, helper names, signatures, test organization, refactoring mechanics, focused verification, and commit composition, and may replace a proposed mechanism with a safer repository-informed one while preserving the approved outcome. Do not request approval for internal technical mechanics.

**Category A (do silently; report in one line):** internal technical mechanics. **Category B (STOP first):** changed product outcome; changed lifecycle / recurrence / deletion meaning; changed canonical identity; changed authorization or privacy; changed TST/PRD behavior; migration; destructive shared-data behavior; a user-visible change to an explicitly excluded surface.

**Three universal hard gates (the only universal gates):**
1. Reconcile the live checkpoint and approved outcome before implementing.
2. Stop before any unapproved product, identity, lifecycle, authorization, privacy, environment, or migration change.
3. Require explicit approval + the relevant fast-forward / allow-list / cleanup control for push, PRD, shared Firebase/rules, or destructive operations.

**Builder dissent.** State one short repository-evidenced dissent, then continue immediately if it stays inside category A; emit one concise `STOP — category B` line if a category-B decision is required. Don't add a separate pre-read round-trip for routine category-A work.

**Workflow.** Prefer outcome-based delegation over prescribed mechanics. Reuse evidence already established this session; avoid repeated broad discovery and re-verification. Verify proportionate to risk. Commit at green, coherent sub-slice checkpoints. Update normative docs once per shipped outcome, not per slice. Keep final reports short and delta-oriented (changed files, verification results, open decisions, next action).

**Session switches.** Recommend a fresh session at meaningful boundaries — context compaction, a completed milestone, a material domain change, a prompt that contradicts session history, unresolved uncommitted work from another outcome, or stale-todo / task-context contamination. Not every slice needs one; never start one yourself.

**Model guidance.** Claude Sonnet 5 by default. Claude Opus 4.8 only for novel domain/lifecycle ambiguity or high-blast-radius safety design — not merely because a task is large.


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