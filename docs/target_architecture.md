# FightWeek — Target Architecture

_The architectural direction for FightWeek. This document is the bridge between the conceptual domain model, what we want, and the current Firestore implementation, what is built today. It guides incremental decisions so that today’s work does not create tomorrow’s structural debt._

_Read at planning. Update at review._

_Last updated: 2026-08-25_

---

## Purpose

FightWeek is built incrementally, one release at a time. That is the right approach, but it carries a risk: locally sensible decisions can create global structural problems.

This document prevents that by making the target visible, so every new feature is a step toward the north star, not sideways.

The target architecture should help us:

- Keep the core scheduling model simple and consistent.
- Avoid hard-coding temporary implementation details as domain truths.
- Keep Firestore as the active datastore for now without over-coupling app logic to Firestore document shape.
- Preserve the option to move to Postgres/Supabase later if analytics needs make that worthwhile.
- Protect historical training data and logs.
- Use external calendars only as integrations at the edge, not as FightWeek’s source of truth.

---

## Source of Truth

The current source-of-truth order is:

1. `/docs/fightweek_decisions.md`
2. `/docs/fightweek_domain_model.md`
3. `/docs/fightweek_core_flows.md`
4. `/docs/fightweek_test_scenarios.md`
5. `/docs/fightweek_database_model.dbml`
6. Older documents, including `DOMAIN_MODEL.md`, historical release notes and older architecture documents

If older architecture language conflicts with the newer FightWeek decisions, the newer FightWeek decisions win.

### Normative contract for self-posted lifecycle work

For any change touching the self-posted-training lifecycle — `EventOccurrence`, `CalendarEntry`, `TrainingLog`/`EventLog`, `Participation`, notes, favorites, their persistence, projections, or routing — `/docs/self_posted_lifecycle_and_invariants.md` is the **canonical, normative contract**. It defines the domain concepts, application operations, invariants, transitional-state register, and slice gate. This document (the target architecture) remains the north-star vocabulary; where the two overlap on the self-posted lifecycle, the canonical contract governs. Do not duplicate its content here — reference it.

---

## Design Principles

### 1. EventOccurrence is the scheduled atom; CalendarEntry controls where an occurrence appears

Every concrete scheduled item exists as an `EventOccurrence`, whether it originates from a recurring `EventSeries` or is created as a standalone occurrence.

`CalendarEntry` controls where an occurrence appears and may contain user-specific planning information without changing the occurrence itself.

This replaces the older idea that “Activity” is the universal calendar atom.

### 2. Person = Firebase Auth user

A person is represented by the Firebase Auth user.

Do not create a separate identity system unless a clear need emerges.

If FightWeek needs to reference people without accounts, for example opponents or external contacts, that should be modelled as a different concept.

### 3. Team is independent of Gym

Fighters train across multiple clubs and gyms.

The team is the cross-cutting unit. Gyms are sources of training offerings, venues and organizational contexts, but they are not necessarily the parent of a fighter or team.

### 4. Roles are contextual

A person’s role depends on context.

A user may be:

- Fighter in one team
- Coach in another context
- Instructor for a gym
- Admin for a group or organization

Roles belong on membership relationships, not only on the person.

### 5. Firestore-native design for now

Firestore remains the active datastore.

We design for Firestore’s strengths:

- Documents
- Subcollections
- Real-time listeners
- Firebase Auth integration
- Security rules
- Low operational overhead

The conceptual model may look relational because that helps clarify business concepts and boundaries. The Firestore implementation may embed, denormalize or adapt those concepts where appropriate.

### 6. Fravær is not the same as HealthCondition

`Fravær` blocks calendar time, for example travel, exams, vacation or work.

`HealthCondition` tracks medical or physical state, for example injury, illness or chronic limitation.

They may overlap, but they are separate concepts.

### 7. EventLog is a first-class domain concept

Scheduling describes what was planned.

`EventLog` describes what actually happened.

Firestore may physically embed or denormalize EventLog data where appropriate, but logged history must be protected and remain understandable over time.

This replaces the older idea that “log is annotation, not entity.”

### 8. Make self-posted training frictionless

Fighters must be able to quickly add or log training that was not created by a gym, team or system admin.

Examples:

- Solo run
- Strength session
- Drop-in class
- Sparring session
- Recovery session

The architecture should support creating a self-posted `EventOccurrence` with minimal friction.

### 9. Competition results belong with the logged occurrence

Tournament or competition results are part of the user’s history for that occurrence.

For now, FightWeek does not need a separate Fight entity unless bout-level details become necessary later.

Competition-related data can initially live on `EventLog` or event-specific details connected to the occurrence.

---

## Scheduling Principles

### EventSeries defines recurring intent

`EventSeries` is the source definition for recurring training, classes and other repeating events.

Examples:

- Weekly class
- Recurring team training
- Recurring self-posted training
- Recurring absence

### EventOccurrence is the scheduled atom

Every concrete scheduled event exists as an `EventOccurrence`, whether it belongs to a series or was created as a standalone event.

Examples:

- A specific BJJ class on Monday evening
- A tournament on Saturday
- A seminar next weekend
- A self-posted training session
- A planned absence

### CalendarEntry controls visibility

An occurrence may appear on one or more calendars without changing the occurrence definition itself.

Examples:

- A gym class appears on the gym calendar.
- A fighter adds that class occurrence to a personal calendar.
- A team event appears on a team calendar.
- An invited fighter may get a calendar entry for an occurrence.

CalendarEntry may hold user-specific planning data such as personal focus, note or reminder preference.

### Participation is separate from scheduling

Participation tracks RSVP, enrollment, attendance and participation status without changing event definitions.

Examples:

- Invited
- Needs action
- Accepted
- Tentative
- Declined
- Enrolled
- Waitlisted
- Attended
- No-show
- Cancelled

### EventLog is separate from planning

Scheduling describes what was planned.

Logging describes what actually happened.

Examples of EventLog data:

- Attended
- Actual duration
- Intensity
- Energy
- Discipline/category
- Focus
- Notes
- Injuries or limitations
- Results or reflections

### Logged history is protected

Occurrences with logs or notes must never be hard-deleted.

Enough event context must remain available to understand historical logs later.

### FightWeek owns the scheduling model

External calendar integrations may exist in the future, but FightWeek remains the source of truth for scheduling.

Google Calendar is not the backing engine.

A future integration should be at the edge, for example a one-way iCal feed, not a replacement for FightWeek’s internal model.

### Rolling occurrence generation

Recurring `EventSeries` generate `EventOccurrences` for a rolling 6-month horizon, approximately 26 weeks.

Older/current implementation may still materialize recurring sessions for 52 weeks. Treat that as current implementation behavior to be refactored later, not the target model.

### Conceptual model and storage model are different concerns

The conceptual model defines business concepts and boundaries.

Firestore implementations may embed, denormalize or otherwise adapt those concepts where appropriate.

---

## Target Domain Model

### Organization and Identity

```text
┌───────────────────────────────────────────────────────────────┐
│                         ORGANIZATION                          │
│                                                               │
│   ┌────────┐     ┌────────────┐     ┌───────┐                │
│   │  User  │◄───▶│ Membership │────▶│ Team  │                │
│   │/Person │     │  (role)    │     └───────┘                │
│   └───┬────┘     └────────────┘                              │
│       │                                                       │
│       │           ┌────────────┐     ┌───────┐                │
│       └──────────▶│ Membership │────▶│  Gym  │                │
│                   │  (role)    │     └───────┘                │
│                   └────────────┘                              │
└───────────────────────────────────────────────────────────────┘
```

A person is a Firebase Auth user. A person joins teams and gyms through memberships that carry a contextual role. Teams and gyms are separate organizational contexts; a fighter may belong to several of each.

---

## Scheduling Domain

The scheduling domain is the core of FightWeek. An `EventSeries` generates `EventOccurrences`. Each occurrence is the scheduled atom, and three separate concerns hang off it: where it appears (`CalendarEntry`), who is responding to it (`Participation`), and what actually happened (`EventLog`). `Favorite` is a private bookmark that lives outside scheduling entirely.

```text
                         ┌─────────────────┐
                         │   EventSeries   │
                         └────────┬────────┘
                                  │
                                  │ generates
                                  ▼
                         ┌─────────────────┐
                         │ EventOccurrence │
                         └───┬─────┬─────┬─┘
                             │     │     │
                             │     │     │
                             ▼     ▼     ▼

                    ┌──────────┐ ┌──────────────┐ ┌──────────┐
                    │ Calendar │ │ Participation│ │ EventLog │
                    │  Entry   │ │              │ │          │
                    └──────────┘ └──────────────┘ └──────────┘


┌──────────┐
│ Favorite │
└────┬─────┘
     │ bookmarks
     │
     ├─ EventSeries
     ├─ Organization / Gym
     ├─ EventOccurrence
     └─ Future saved filters
```

---

## Relationship Notes

- An `EventSeries` generates many `EventOccurrences`. A one-off occurrence has no series, so `EventOccurrence.series_id` may be null.
- An `EventOccurrence` may appear on many calendars through `CalendarEntry`. Each `CalendarEntry` links one occurrence to one calendar and may carry user-specific planning data.
- Participation is tracked at two levels: `EventSeriesParticipation` for a whole recurring series, and `EventOccurrenceParticipation` for a single occurrence. A general series response can coexist with a different response for one occurrence.
- An `EventLog` belongs to one user and one occurrence and records what actually happened. An occurrence may have several logs, one per participating user.
- `Favorite` references a target such as an `EventSeries`, an organization/gym, an `EventOccurrence` or, later, a saved filter. A favorite is not a calendar entry and not participation.
- `CalendarEntry`, `Participation` and `EventLog` are independent of each other. An occurrence can appear on a calendar without participation, carry participation without a log, and be logged without a personal planning note.

---

## Entity Definitions

### EventSeries

The recurring source definition for repeated events, for example a weekly gym class, a recurring team training, a recurring self-posted training or a recurring absence. An `EventSeries` describes recurring intent. It is not what the fighter logs; the fighter logs a concrete `EventOccurrence`.

### EventOccurrence

One concrete scheduled event in time, and the scheduled atom of the model. Examples: a specific BJJ class on Monday evening, a tournament on Saturday, a seminar next weekend, a planned absence, or a self-posted training session. `EventOccurrence.series_id` may be null so that one-off events do not need an artificial series parent. Event type is one of `class`, `self_posted_training`, `tournament`, `seminar`, `absence` or `other`.

### CalendarEntry

The appearance of an `EventOccurrence` on a specific calendar. This is where user-specific planning information belongs: personal note, personal focus, reminder preference, a planned/tentative/skipped/completed status, or a private title override. A calendar entry means "this occurrence appears on this calendar"; it is not the event itself.

### EventSeriesParticipation

A user's response or intention for a whole recurring series, for example generally accepting a weekly class. Series-level participation does not prevent a different response for one specific occurrence.

### EventOccurrenceParticipation

A user's response or status for one concrete occurrence. This covers invites, RSVP, enrollment and attendance. Statuses: `needs_action`, `accepted`, `tentative`, `declined`, `enrolled`, `waitlisted`, `attended`, `no_show`, `cancelled`.

### EventLog

The fighter's journal for what actually happened after a training or event. Log data includes attended, actual duration, intensity, energy, discipline/category, focus, notes and injuries/limitations. `EventLog` is a first-class domain concept and must be protected: if a log exists, the linked occurrence must not be hard-deleted.

### Favorite

A private bookmark that helps a user find something again, for example a favorite class series, gym, tournament or seminar, and later a favorite saved filter. A favorite does not mean the user is going, interested, enrolled or participating.

---

## Conceptual Model vs Firestore Implementation

The conceptual model above defines business concepts and boundaries. It looks relational because that clarifies what each concept means and where responsibilities begin and end.

Firestore is the active datastore. The Firestore implementation may embed, denormalize or adapt these concepts where that fits Firestore's strengths:

- A recurring series may materialize its occurrences as stored documents rather than joined rows.
- `CalendarEntry` planning fields and early `EventLog` fields may be embedded on session/occurrence documents instead of living in separate collections.
- Participation may be embedded on the event document today rather than in a dedicated participation collection.

The rule is: keep the conceptual boundaries clear in app code even when the physical Firestore shape combines them. Introduce repository/service boundaries so app logic depends on the domain concepts, not directly on Firestore document shape.

---

## Historical Data Protection

Past training history must never disappear because a source event or series is changed or deleted.

If an `EventOccurrence` has an `EventLog`:

- Do not hard-delete the occurrence.
- Preserve enough core event data to understand the log later: title, type, discipline/category where relevant, start/end time, location/address and calendar/source context.
- Preserve the link between the log and the occurrence.

Deleting or cancelling a series must not remove logged occurrences from a fighter's calendar or history. Future occurrences without logs may be cancelled or removed according to the chosen flow. This rule must be protected by automated tests.

This is why deletion is a decision, not a direct operation: a logged occurrence is soft-cancelled, an unlogged one may be removed, and any occurrence whose log status cannot be resolved is treated as if it were logged.

---

## Recurring Series Behavior

Recurring events use `EventSeries` as the recurring source and `EventOccurrence` as generated concrete instances. FightWeek stores generated occurrences for a rolling 6-month window, approximately 26 weeks.

> **Current implementation note:** the current implementation may still materialize recurring sessions for 52 weeks. Treat that as current implementation behavior to be refactored later, not the target model.

When editing an occurrence that belongs to a series, FightWeek offers three choices:

1. **This event only** — update only the selected occurrence and mark it as an exception.
2. **This and following events** — end the old series before the selected occurrence and create a new series from that occurrence forward, preserving past occurrences and logs.
3. **All events in the series** — update the series and all non-exception occurrences.

Individual occurrence changes must not be silently overwritten by later series changes. Series-level updates apply to non-exception occurrences only; exception occurrences keep their overrides unless the user explicitly chooses to overwrite them.

---

## Firestore Path Map — Target Direction

The table maps current Firestore paths to target domain concepts. It documents direction, not a migration to Postgres. Firestore remains the active datastore.

| Current Firestore path | Target concept | State |
|------------------------|----------------|-------|
| `public/data/catalogue/{id}` | `EventSeries` of type `class` | ✅ Live |
| `public/data/events/{id}` | `EventOccurrence` (one-off, series_id null) | ✅ Live |
| `users/{userId}/weeks/week_{n}` (session objects) | `EventOccurrence` + `CalendarEntry` | ✅ Live |
| `users/{userId}/templates/standard` | Personal planning defaults (planning layer) | ✅ Live |
| `users/{userId}/meta/notes` (activity notes) | Early/simple `EventLog` | ✅ Live |
| Absence sessions in weekly plan | `EventOccurrence` of type `absence` + `CalendarEntry` | ✅ Live |
| Event signups (`interested`/`signed-up`/`declined`) | Transitional source-native status — future target splits into `CalendarEntry` inclusion (`signed-up`) and `Favorite` (`interested`); `declined` has no approved durable target (decision §27) | 🚧 Transitional |
| Invitation invitees | `EventOccurrenceParticipation` or `EventSeriesParticipation` | ✅ Live |
| `public/data/gyms/{id}` | Organization of type `gym` | ✅ Live |
| Favorites | `Favorite` | 📐 Target |
| Dedicated calendars | `Calendar` (owner: user / organization / system) | 📐 Target |

> **Note:** Today, `CalendarEntry` planning fields and early `EventLog` fields are embedded on session documents rather than stored in separate collections. That is an accepted Firestore-native implementation detail, not a change to the conceptual boundaries.

---

## Migration Sequence

The refactor moves toward the target gradually, without changing the whole Firestore backend at once. Preferred order:

1. **Domain types and adapters** — introduce target domain types and pure adapters that translate current data shapes into domain concepts, with no Firestore or React coupling. *(Done in Phase 1.)*
2. **Protection layer** — add a pure, well-tested log-protection decision layer before wiring it into any handler. *(Done in Phase 2a.)*
3. **Guarded deletion** — route existing delete paths through the protection layer so logged occurrences are soft-cancelled rather than hard-deleted.
4. **Participation normalization** — read current signups and invitation invitees through a shared participation vocabulary, without migrating identity keys.
5. **Recurrence preparation** — introduce deterministic occurrence identity and prepare series/occurrence separation.

Each step is small and reversible, favors domain types and adapters before persistence changes, and adds tests before risky behavior changes.

---

## What Not to Build Yet

These are valid future concepts but must not be implemented now unless explicitly requested:

- `EventTemplate`
- `TrainingProgram` and `TrainingProgramItem`
- `PrivateLesson` as its own event type
- `Fight` as a separate bout-level entity
- Saved-filter favorites
- A separate identity system beyond Firebase Auth users
- A migration to Postgres/Supabase

Recovery and strength/conditioning are training categories, not event types. Open mat is treated as a class for now. Competition results initially live on the logged occurrence rather than a separate entity.

---

## Platform and Integration Decisions

### Own the scheduling model

FightWeek is the source of truth for scheduling. External calendar integrations may exist in the future, but Google Calendar is not the backing engine. A future integration should live at the edge, for example a one-way per-fighter iCal feed, not a replacement for FightWeek's internal model.

### Firestore now, with a data-store tripwire

FightWeek stays on Firestore for now and does not migrate immediately. The decision is revisited before the first analytics-focused release. The tripwire is serious analytics needs such as joins, aggregations, full-text search, or training volume per fighter per discipline per camp. To keep the option open, the domain model stays clean in app code, app logic avoids tight coupling to Firestore document shape, and repository/service boundaries are introduced before any migration.

### Media and file storage

Media is stored as URL references, not blobs. Native file upload is deferred until a data-store migration brings its own object storage. This was a conscious choice made when native upload would have required a paid storage plan.

### Calendar UI library

Whether a calendar UI component such as FullCalendar should replace or strengthen the current calendar UI is a spike, not a decision. No adoption has been made.

---

## How This Document Is Used

| Ceremony | What we do with it |
|----------|--------------------|
| **Release Planning** | Consult the target architecture before selecting items. Ask: does this slice align with the direction, or will we need to rework it later? |
| **Release Review** | Review against the target. Ask: did we move toward or away from the north star, and did we learn something that changes the target? Update the document if understanding evolved. |
| **Implementation** | When a design decision comes up mid-item, check the design and scheduling principles here before choosing. |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-18 | Initial version. Synthesised from the PO's conceptual DBML proposal and the AI Agent's critical analysis. Key decisions: Activity as universal calendar atom, Person = Auth user, Team independent of Gym, Firestore-native physical model. |
| 1.1 | 2026-04-19 | Updated for Release 1.9 (Roles & Security). Recorded contextual roles on membership, dynamic security rules and the roles config document. |
| 1.2 | 2026-06-05 | Added Platform and Integration Decisions: own the domain model rather than rebuild on Google Calendar (integrate via a read-only per-fighter iCal feed); keep Firestore now with a tripwire to revisit the data store when analytics land. |
| 1.3 | 2026-06-23 | Recorded the media/file storage decision: store media as URL references, not blobs; defer native upload until a data-store migration brings its own object storage. |
| 1.4 | 2026-07-20 | Rewrote around the calendar-first scheduling model: EventSeries, EventOccurrence, CalendarEntry, EventSeriesParticipation, EventOccurrenceParticipation, EventLog and Favorite. EventOccurrence is now the scheduled atom and CalendarEntry controls where an occurrence appears; EventLog is a first-class, protected domain concept. This replaces the older idea that "Activity" is the universal calendar atom and that "log is annotation, not entity." Added the Scheduling Domain diagram, entity definitions, historical data protection, rolling 6-month recurrence behavior, the target-direction Firestore path map and the migration sequence. |