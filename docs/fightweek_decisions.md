# Fightweek Decisions

_Last updated: 2026-08-23_

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
