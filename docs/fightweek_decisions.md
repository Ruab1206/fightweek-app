# Fightweek Decisions

_Last updated: 2026-08-25_

This document captures current product and architecture decisions for the Fightweek scheduling, participation and logging domain.

## 1. Use a Google Calendar-like scheduling foundation

Fightweek will use a calendar-first scheduling model inspired by Google Calendar and Outlook-style flows.

The domain will distinguish between:

- **EventSeries**: the recurring/source definition for repeated events.
- **EventOccurrence**: one concrete scheduled instance in time.
- **CalendarEntry**: the appearance of an occurrence on a user, organization or system calendar.
- **SeriesParticipation**: a user's response/intention for a recurring series.
- **OccurrenceParticipation**: a user's response/status for one concrete occurrence.
- **EventLog**: the user's training journal/log after the occurrence.

## 2. EventOccurrence.series_id is nullable

`EventOccurrence.series_id` may be null.

This means:

- Recurring classes and recurring training are created from an `EventSeries`.
- One-off tournaments, seminars, absences and self-posted training can exist directly as `EventOccurrence` records without an artificial parent series.

## 3. Store generated occurrences for a rolling 6-month window

For recurring series, Fightweek will store generated occurrences instead of only generating them dynamically at display time.

Recurring series generate EventOccurrences for a rolling 6-month window, approximately 26 weeks.

Reasoning:

- 6 months (≈26 weeks) is enough for near-term training planning.
- Stored occurrences make it easier to edit, cancel, invite, enroll, log and audit individual occurrences.
- The generation window can later be changed through configuration.

Note: Older/current implementation may still materialize recurring sessions for 52 weeks. Treat this as current implementation behavior to be refactored later, not the target model.

## 4. Protect logs and historical training records

Past training history must never disappear because a source event or series is changed or deleted.

Rules:

- If an occurrence has an `EventLog`, the occurrence must not be hard-deleted.
- If an occurrence has an `EventLog`, core event data needed to understand the log must remain available.
- Core preserved data includes title, type, discipline/category where relevant, start/end time, location/address, calendar/source context, and relevant details.
- Deleting or cancelling a series must not remove logged occurrences from a fighter's calendar/history.
- Future occurrences without logs may be cancelled or removed according to the chosen flow.

This rule must be protected by automated tests.

## 5. Adopt recurring-event edit choices

When editing an occurrence that belongs to a series, Fightweek should offer:

1. **This event only**
2. **This and following events**
3. **All events in the series**

Expected behavior:

### This event only

Update only the selected `EventOccurrence` and mark it as an exception.

### This and following events

End the old series before the selected occurrence and create a new series from the selected occurrence forward. Preserve past occurrences and logs.

### All events in the series

Update the `EventSeries` and all non-exception occurrences. Do not overwrite individually changed occurrences unless the user explicitly chooses to do so.

## 6. Individual occurrence changes should be preserved by default

If a user has changed a single occurrence in a recurring series, later changes to the full series should not silently overwrite that individual occurrence change.

Default rule:

- Series-level updates apply to non-exception occurrences only.
- Exception occurrences keep their occurrence-level overrides.
- If the app later supports overwriting exceptions, this must be an explicit user choice.

## 7. Separate planning, participation and logging

Fightweek will not mix planning data, response data and training log data.

- **CalendarEntry** stores that an occurrence appears on a calendar and may contain personal planning data.
- **Participation** stores invite/enrollment/RSVP/attendance state.
- **EventLog** stores what actually happened and the user's journal/reflection.

## 8. Use two participation tables

Fightweek will use two participation concepts:

- **EventSeriesParticipation** for recurring/source-level participation.
- **EventOccurrenceParticipation** for one concrete occurrence.

This supports flows such as:

- A fighter accepts a weekly class series generally.
- A fighter declines one specific occurrence.
- A coach invites a team to a recurring session and receives general responses.
- A fighter invites a friend to one specific class occurrence.

## 9. Keep Google Calendar response wording where useful

Use familiar RSVP wording where possible.

Recommended internal statuses:

- `needs_action`
- `accepted`
- `tentative`
- `declined`
- `enrolled`
- `waitlisted`
- `attended`
- `no_show`
- `cancelled`

Recommended UI labels:

- No answer yet
- Coming
- Maybe
- Not coming
- Enrolled
- Waitlisted
- Attended
- No-show
- Cancelled

## 10. Support both invite and open enrollment

Events can have different participation modes:

- `none`: no response needed.
- `open_signup`: users can enroll/respond from the calendar.
- `invite_only`: only invited users can participate.
- `invite_with_response`: selected users or groups are invited and expected to respond.

This supports both coach/team flows and fighter-to-fighter suggestions.

## 11. Fighter-to-fighter suggestions have two modes

When a fighter wants to suggest a class to another fighter, the app should distinguish between:

- **Share**: "Look at this class". No response tracking required.
- **Invite**: "I plan to attend this class. Do you want to join me?" Response tracking required.

If the fighter chooses Invite, the app should create participation records and optionally calendar entries according to user preferences.

## 12. Favorites are separate from calendar entries

Favorites help users find reusable things again. Favorites do not mean that something is scheduled.

Initial favorite targets:

- Event series, especially recurring classes.
- Organizations/gyms.

Future possible favorite targets:

- Saved filters, for example "BJJ beginner classes near Copenhagen".
- Disciplines.
- Locations.

## 13. Event type and discipline/category are separate

Event type describes the scheduling flow. Discipline/category describes the training content.

Recommended event types for now:

- `class`
- `self_posted_training`
- `tournament`
- `seminar`
- `absence`
- `other`

Not separate event types for now:

- Recovery, use training category/discipline.
- Strength/conditioning, use training category/discipline.
- Open mat, treat as a class for now.
- Private lesson, consider later.
- Fight, consider later if bout-level data becomes necessary.
- Program item, postpone until programs are implemented.

## 14. EventTemplate and TrainingProgram are future concepts

`EventTemplate`, `TrainingProgram` and `TrainingProgramItem` are valid future domain concepts, but they should not be implemented now.

Document them in the conceptual domain model, but keep them out of the MVP database/schema until needed.

## 15. Calendar UI library decision is a spike, not a decision yet

Fightweek should investigate whether a calendar UI component can replace or strengthen the current calendar UI.

The first candidate to investigate is FullCalendar.

This is not a decision to adopt it yet. The next step is a small technical spike.

## 16. Data store decision remains Firestore for now, with a Postgres/Supabase tripwire

Current decision from the backlog remains valid:

- Stay on Firestore for now.
- Do not migrate immediately.
- Revisit the decision before the first analytics-focused release.

Tripwire:

- When Fightweek needs serious analytics such as joins, aggregations, full-text search, or training volume per fighter per discipline per camp, revisit Postgres/Supabase.

Hedge:

- Keep the domain model clean in app code.
- Avoid coupling app logic too tightly to Firestore document shape.
- Introduce repository/service boundaries before any migration.

## 17. One TrainingLog per fighter and concrete calendar occurrence

For one fighter and one concrete calendar occurrence, the intended cardinality is zero or one `TrainingLog`.

- Two or more calendar-originated logs for the same fighter and occurrence are a data-integrity conflict, not normal behavior.
- There is no automatic conflict resolution: existing conflicts are never automatically merged, deleted, overwritten, hidden, ranked, or resolved.
- Standalone logs without calendar provenance remain outside this invariant — calendar-occurrence uniqueness does not apply to them.

## 18. TrainingLog consistency direction for standalone/unplanned training

Every `TrainingLog` conceptually belongs to a training occurrence. The historical log itself remains self-contained and snapshot-based; provenance remains optional for historical readability and standalone backward compatibility.

The current standalone "Log tr\u00e6ning" flow is a transitional secondary flow for unplanned training, not the permanent conceptual end state. The final model must either:

- consistently create the required `EventOccurrence` + `CalendarEntry` + `TrainingLog`, so unplanned training also participates in the calendar model; or
- remove the standalone creation entry point once the calendar-originated flow can fully replace it.

New coupling to the legacy week-document model must not be added merely to satisfy this direction. This decision records the direction only; it does not select or implement either option.

## 19. Enforcement staging: UI mitigation vs atomic persistence enforcement

UI mitigation (loading/error/none/one/conflict classification and visible creation gating) and atomic persistence-level enforcement are distinct and must not be conflated.

- The verified UI mitigation must not be described as atomic enforcement.
- A concurrent two-client race remains technically possible; the risk is currently assessed as low.
- Concurrency-safe atomic reservation and persistence-level uniqueness are deferred hardening, not automatically the next active slice.
- Any future reservation, rule, inventory, or backfill work to close this gap requires separate approval.

## 20. Verification terminology: responsive mobile view vs physical mobile device

"Responsive mobile view verified" means the mobile layout was manually tested by resizing the desktop browser until the application rendered its mobile layout. This is not the same as physical mobile-device testing, and documentation must preserve that distinction — neither claiming physical-device verification that did not happen, nor describing mobile as entirely unverified.

## 21. Canonical self-posted lifecycle contract and CalendarEntry-independence gate

**Decision.** The normative contract for the self-posted-training lifecycle — its domain concepts, application operations, invariants, transitional-state register, slice gate, and stop conditions — lives in a single source of truth, `/docs/self_posted_lifecycle_and_invariants.md`. Repository-wide and path-specific Copilot instructions, the target architecture, and this refactoring plan reference that contract rather than restating it. Until the canonical `CalendarEntry` lifecycle is independent of `TrainingLog` (invariants I2 and I18), **no new `CalendarEntry` source may be implemented**.

**Rationale.** The completed-unplanned-training slice atomically creates `EventOccurrence` + `CalendarEntry` + `TrainingLog`. That transaction is useful and valid, but its current implementation log-gates the new-model `CalendarEntry` (it cannot exist without the paired `TrainingLog`) and routes the projected entry's primary detail to the log. Left ungoverned, this would let different UI entry points create different persisted models and business rules — the opposite of the strangler's objective. A single canonical contract with enforced invariants prevents that drift.

**Consequences.**
- The canonical contract is normative; conflicting or older language is reconciled to point at it (this decision does not rewrite decisions §17, §18, or §19 — it is consistent with them).
- New CalendarEntry sources are paused behind the lifecycle-separation gate (I18).
- Every domain/persistence implementation plan must list affected invariants and classify new constructs as durable or transitional.

**Deferred work.** Introducing a shared `CalendarEntry` read/detail contract, independently usable new-model occurrence/`CalendarEntry` creation, recomposing completed-unplanned logging from general operations, and logging an existing new-model `CalendarEntry` — sequenced in the canonical contract's "Current next architectural sequence". Persistence-technology evaluation remains after the canonical model is sufficiently defined (does not change decision §16: Firestore remains the active datastore now).

**Relationship to existing decisions.** Extends and does not override §17 (one calendar-originated TrainingLog per occurrence), §18 (standalone flow is transitional), §19 (UI mitigation vs atomic enforcement), and §16 (Firestore-for-now with a tripwire). Existing verified commits remain valid and are not reverted.

## 22. Pure canonical operation extraction precedes presentation convergence

**Decision.** Pure canonical operation extraction (`CreateSelfPostedOccurrence`, `AddOccurrenceToFighterCalendar`, `LogOccurrence`) is sequenced **before** the shared `CalendarEntry` read/detail contract in `/docs/self_posted_lifecycle_and_invariants.md` Section I.

**Rationale.** A first application of the committed architecture gate to a proposed combined correction returned "reject or split the slice." Presentation convergence, if implemented first, risks masking the still-fused application boundary (the new-model `CalendarEntry` remains obligatorily paired with `TrainingLog`) behind a unified read view before the underlying operations are actually separated. Establishing the reusable, independently testable lifecycle operations first keeps the correction honest about what is and is not yet fixed.

**Consequences.**
- No persistence, Firestore-rule, or UI behaviour changes occur in the extraction slice.
- Persisted `CalendarEntry` independence from `TrainingLog` remains a known transitional gap after this slice (I2 improves only at the domain/application-builder level).
- Presentation convergence (the shared read/detail contract) follows operation extraction, not the reverse.
- No new `CalendarEntry` source may proceed until persisted I2 separation is approved and implemented (I18 unchanged).

**Limitation.** This decision does not itself make persisted `CalendarEntry` independent of `TrainingLog`; Firestore rules and the `calendarEntries`/`eventLogs` bilateral pairing are unchanged by it.

**Next gates.** (1) shared `CalendarEntry` read/detail contract, (2) independently persistable self-posted `EventOccurrence`/`CalendarEntry` support (where persisted I2 is corrected).

**Relationship to existing decisions.** Refines the sequencing recorded in decision §21's "Deferred work" and the canonical contract's Section I; does not override §21 or any earlier decision.

## 23. Completed-unplanned aggregate and TrainingLog snapshots currently diverge (TRANSITIONAL)

**Decision.** During pure canonical operation extraction it was discovered that, for one completed-unplanned save, the persisted `NewModelCalendarAggregate` and the persisted `TrainingLog` represent occurrence/calendar context **differently**, and this slice deliberately **preserves both forms** rather than silently normalizing them. Normalization is a separately gated architecture decision (Section I step 3a of the canonical contract).

**The divergence (factual).**
- Occurrence `endDateTime`: the aggregate uses a local-safe datetime; the TrainingLog snapshot uses the existing `buildLogContext` representation, including the current UTC/ISO form for a duration-derived end.
- `occurrence.hasLogs`: present on the TrainingLog snapshot, absent on the aggregate occurrence.
- Embedded `calendarEntry.userId`: present on the aggregate's CalendarEntry, omitted on the TrainingLog's embedded CalendarEntry.

**Rationale.** Making the TrainingLog consume the aggregate's canonical occurrence/CalendarEntry would change the persisted `eventLogs` shape (out of scope for a behaviour-preserving slice) and the aggregate cannot adopt the log's UTC end form (the calendar projection's strict local-datetime parser rejects it, which would drop the calendar card). The canonical operations therefore feed the aggregate, while the TrainingLog uses a clearly-named TRANSITIONAL current-snapshot adapter (`buildTransitionalSelfPostedTrainingLog`).

**Consequences.**
- Current aggregate and TrainingLog persisted output are unchanged; the divergence is pinned by explicit parity tests.
- One semantic occurrence record does not yet feed both persisted snapshots.
- This is a documented transitional gap, **not data corruption**.

**Deferred work (separately gated).** Snapshot normalization must decide the canonical datetime representation, `hasLogs` ownership, embedded-CalendarEntry snapshot fields, backward compatibility for existing logs, and whether schema versioning/read adapters are required. No migration decision is made here. No new `CalendarEntry` source may proceed as a consequence of this documentation.

**Relationship to existing decisions.** Refines decision §22 and the canonical contract's Section E/Section I; does not override §21 or §22.

## 24. TrainingLog legacy duration-derived end is not deterministically recoverable; read adapter preserves ambiguity

**Decision.** A read-only recoverability investigation established that a duration-derived legacy `TrainingLog` end (persisted as a UTC-Z or offset-bearing instant) **cannot be reconstructed deterministically** to an original local end time or duration: no writer timezone, IANA zone, offset, or independent duration was ever persisted, and reconstruction was proven reader-runtime-timezone-dependent and DST-fragile across UTC, Europe/Copenhagen, and America/New York. Accordingly, the compatibility read adapter **preserves this ambiguity** rather than inventing a writer timezone or converting via the current runtime timezone.

**Established facts.**
- Offset-free local `startDateTime` is a deterministic wall-clock value.
- An offset-free local explicit `endDateTime` is likewise deterministic; duration between two local values is timezone-independent wall-clock arithmetic.
- A UTC-Z/offset-bearing legacy end is ambiguous for historical local end and duration — it is not deterministically recoverable.
- No Europe/Copenhagen (or any other) writer-timezone assumption is introduced.
- Interpretation is based on the persisted datetime's own format and, for future writes, explicit version metadata — **never** on `origin`/provenance (I11).
- Existing records are not classified as corrupted; persisted bytes are unchanged; no migration or write normalization is approved by this decision.

**Consequences.**
- The future canonical write format (local wall-clock only, and whether an explicit persisted snapshot/schema version is introduced) is a **separately gated** decision (3a-write).
- The read-side compatibility adapter (3a-read) is safe to implement now: deterministic where recoverability is proven, honestly ambiguous otherwise.

**Relationship to existing decisions.** Refines decision §23 (which first documented the aggregate/TrainingLog snapshot divergence) with the recoverability finding; does not override §21, §22, or §23.

## 25. Future-write occurrence-timing convergence (3a-write, timing dimension only)

**Decision.** For newly created new-model unplanned-training writes, the paired `TrainingLog`'s historical occurrence snapshot now consumes the **same constructed `EventOccurrence`** that feeds the calendar aggregate. There is one occurrence construction path (`createSelfPostedOccurrence`); the coordinator passes that occurrence to the transitional log builder, which forms the log's occurrence snapshot directly from it (adding only the TrainingLog-snapshot `hasLogs` marker) instead of independently recomputing an end time from form input/duration. This opens and closes the **timing dimension only** of the previously gated 3a-write step, consistent with decision §24's established direction ("local wall-clock only").

**Scope (deliberately narrow).**
- Converges Section E divergence **item A** (occurrence `endDateTime` representation) for **future writes only**: a duration-derived end is now the local-safe wall-clock value shared with the aggregate, not a UTC-`Z` instant.
- Section E divergence **items B and C remain untouched and gated**: the TrainingLog snapshot keeps `hasLogs: true` and its embedded `calendarEntry` still omits `userId`. `hasLogs` ownership, embedded-CalendarEntry snapshot fields, and any persisted snapshot/schema version are **not** decided here.
- No migration, no change to existing persisted logs, no read-adapter change, no Firestore-rule change, no persisted `CalendarEntry` shape change. The bilateral atomic persistence composition is unchanged. Standalone and calendar-originated flows are unchanged (they do not inject an occurrence and still rebuild via `buildLogContext`).

**Rationale.** §24 already established that a duration-derived UTC-`Z` end is not deterministically recoverable to a local end/duration, and named local wall-clock as the future direction. Sourcing the log's occurrence timing from the one already-constructed canonical occurrence removes the parallel calculation at its root (the values are identical by construction, not by coincidence) without entering the still-gated `hasLogs`/embedded-CalendarEntry/versioning sub-decisions.

**Consequences.**
- One semantic occurrence record now feeds both persisted snapshots for the **timing** dimension; the aggregate and TrainingLog can no longer drift on occurrence start/end for a new write.
- The remaining Section E divergences (B/C) and the persisted-schema-version question stay in the separately gated 3a-write remainder.

**Relationship to existing decisions.** Advances the 3a-write step named in §23/§24 and the canonical contract Section E/I for the timing dimension only; does not override §21, §22, §23, or §24, and does not lift the I18 new-`CalendarEntry`-source gate.

## 26. Product clarification: CalendarEntry primary, TrainingLog optional; independent CalendarEntry capability status consolidated

**Decision.** Records a PO product clarification and consolidates, as one dated checkpoint, the current status of the persisted-CalendarEntry-independence work (`fedca70`, `3d7b833`, `b156edd`, `cee40b0`, `b57fefb`). Authorizes the corresponding Section D/E/I wording corrections in `/docs/self_posted_lifecycle_and_invariants.md`, which under the contract's own amendment rule may only change through a decision recorded here.

**PO product clarification.** Calendar planning is a primary product capability; `CalendarEntry` has independent value regardless of whether training is ever logged. `TrainingLog` is optional and primarily a deeper reflection/history capability. The intended primary journey is goals → planning → `CalendarEntry` → completed training → optional `TrainingLog`. A user opens a planned `CalendarEntry` and optionally adds a `TrainingLog` from it. Logged/not-logged status must be visible, but visibility does not require `CalendarEntry` to own a durable reverse reference to `TrainingLog`.

**Target durable association.** Unidirectional: `TrainingLog.origin -> CalendarEntry`. Logged/not-logged status is derived through provenance and read models (already how the existing association read models work), never through a `CalendarEntry`-owned reference.

**Capability status achieved in production code at this checkpoint:**
- Type/assembler contract: `logRecordId` is optional (`fedca70`).
- Read model: `calendarEntryService` tolerates its absence (`3d7b833`).
- Firestore rules: independent, log-less `CalendarEntry` create is permitted (`b156edd`).
- Persistence: `persistIndependentCalendarEntry` writes an already-assembled, log-less aggregate (`cee40b0`) — no production application/UI caller wired.
- Firestore rules: a `TrainingLog` may reference an already-existing independent `CalendarEntry` via unidirectional provenance (`b57fefb`) — **rules-layer only**; no application composition or UI source exists yet.

**Remains transitional and load-bearing (not retired by this decision).** `logRecordId` and the bilateral same-commit pairing (`aggregatePairsWithLog`/`logPairsWithAggregate`) remain required for the existing completed-unplanned "Log træning" flow, unchanged. No migration of existing persisted records is approved or required.

**Retirement gate (all required; none satisfied yet):**
1. A thin application composition that logs against an existing independent `CalendarEntry`, reusing the existing `TrainingLog` builders and `addCompletedSelfPostedTrainingLog` — no new persistence service.
2. Its own focused verification.
3. Recomposition of completed-unplanned onto the independent operations.
4. The separately gated PO atomicity/UX decision recomposition requires (an entry-without-log partial state becomes possible).
5. Manual TST verification of the recomposed flow.

**Unchanged by this decision.** I7/I8 enforcement remains deferred (§17/§19, UI-mitigation only). No new `CalendarEntry` source is approved — I18 remains gated until an approved application operation uses the independent-write capability and its persisted behaviour is manually verified (still outstanding).

**Relationship to existing decisions.** Advances the direction set by §21–§25 and the canonical contract's Section I; does not override them. Corrects Section E of the canonical contract, which must stop stating, as a general claim, that `CalendarEntry` cannot persist without `TrainingLog` — that constraint now applies only to the still-fused completed-unplanned use case, not to the envelope/type/rules/persistence layer generally.
