# Fightweek Domain Model

_Last updated: 2026-08-25_

This document explains the core Fightweek scheduling, participation and logging concepts in plain language.

The DBML file `/docs/fightweek_database_model.dbml` describes the database-shaped model. This document explains what the concepts mean and how they should be used in the app.

## Source of truth

If older documents contradict this model, the newer Fightweek documents win:

1. `/docs/fightweek_decisions.md`
2. `/docs/fightweek_domain_model.md`
3. `/docs/fightweek_core_flows.md`
4. `/docs/fightweek_test_scenarios.md`
5. `/docs/fightweek_database_model.dbml`
6. Older documents, including `DOMAIN_MODEL.md`, architectural notes and historical release notes

## Product context

Fightweek helps MMA fighters schedule, participate in and log training and martial arts events.

The scheduling model should be similar to Google Calendar/Outlook where useful, but Fightweek adds MMA-specific value through training metadata, participation, team/gym context, journaling/logging and later analytics.

## Core concepts

### User

A person using Fightweek.

A user can act in different roles depending on context, for example:

- Fighter
- Coach
- Instructor
- Gym admin
- System admin

Roles should generally be contextual through organization membership, not stored as one global user role only.

### Organization

A group or owner context.

Examples:

- Gym
- Team
- Training group
- Event organizer
- Fightweek system organization

Organizations can own calendars and have users as members.

### Calendar

A schedule container.

Calendars can belong to:

- A user
- An organization
- The system

Examples:

- A fighter’s personal calendar
- A gym’s class calendar
- A team calendar
- A public Fightweek event calendar

A calendar is both a viewing context and an ownership/sharing boundary.

### EventSeries

The recurring/source definition for repeated events.

Examples:

- A weekly class offered by a gym
- A recurring team training session
- A recurring self-posted training session
- A recurring absence

An EventSeries is not what the fighter logs. The fighter logs a concrete EventOccurrence.

### EventOccurrence

One concrete scheduled event in time.

Examples:

- BJJ Beginner class on Monday 18:00 to 19:30
- Tournament on Saturday
- Seminar from Friday to Sunday
- Absence next Thursday evening
- Self-posted training on Wednesday morning

`EventOccurrence.series_id` may be null.

This means one-off events do not need an artificial EventSeries parent.

### CalendarEntry

The appearance of an EventOccurrence on a specific calendar.

This is where user-specific planning information belongs.

Examples:

- personal note
- personal focus
- reminder preference
- skipped/completed/planned status
- private title override

CalendarEntry is not the event itself. It means the event is shown on a calendar.

### EventSeriesParticipation

A user’s response or intention for a whole recurring series.

Example:

A fighter accepts a weekly class series generally, but may still decline one specific occurrence.

### EventOccurrenceParticipation

A user’s response/status for one concrete occurrence.

Examples:

- needs action
- accepted
- tentative
- declined
- enrolled
- waitlisted
- attended
- no-show

This covers invites, RSVP, enrollment and attendance status.

### EventLog

The fighter’s journal/log for what actually happened.

Used after training or an event.

Examples of log data:

- attended
- actual duration
- intensity
- energy
- discipline/category
- focus
- notes
- injuries/limitations

EventLog must be protected. If an EventLog exists, the linked occurrence must not be hard-deleted.

### Favorite

A private bookmark.

Examples:

- favorite class series
- favorite gym
- favorite tournament
- favorite seminar
- later: favorite saved filter

Favorite does not mean the user is going, interested, enrolled or participating.

## Important distinctions

### Favorite vs Interested

Favorite means:

> I want to find this again.

Interested means:

> I may want to participate, and this may be visible as a response/signal.

These should remain separate concepts.

> Note: the current event-native `interested` signup status is intended to converge toward `Favorite`, not toward this general "Interested" response concept (decision §27).

### CalendarEntry vs Participation

CalendarEntry means:

> This occurrence appears on this calendar.

Participation means:

> This user has a response/status related to the occurrence or series.

### CalendarEntry vs EventLog

CalendarEntry is planning.

EventLog is what actually happened.

### Event type vs discipline/category

Event type describes the scheduling flow.

Examples:

- class
- self_posted_training
- tournament
- seminar
- absence
- other

Discipline/category describes the training content.

Examples:

- MMA
- BJJ
- Wrestling
- Boxing
- Kickboxing
- Strength/conditioning
- Recovery
- Other

Recovery and strength/conditioning are training categories, not event types.

## Recurring events

Recurring events should use:

- EventSeries as the recurring source
- EventOccurrence as generated concrete instances

Fightweek stores generated occurrences for a rolling 6-month window.

When editing an occurrence from a series, the app should support:

1. This event only
2. This and following events
3. All events in the series

Individual occurrence changes must not be silently overwritten by later series changes.

## Historical/log protection rule

Past training history must never disappear because a source event or series is changed or deleted.

If an EventOccurrence has an EventLog:

- do not hard-delete the occurrence
- preserve enough event data to understand the log
- preserve title, type, date/time, location/address and relevant details
- preserve the link between the log and the occurrence

This rule must be protected by automated tests.

## Current implementation mapping

The current implementation may still use older concepts.

Approximate mapping:

- Current `CatalogueClass` / Hold -> EventSeries of type `class`
- Current generated class session -> EventOccurrence + CalendarEntry
- Current `FightweekEvent` -> EventOccurrence
- Current weekly schedule session -> CalendarEntry mixed with EventOccurrence
- Current event signup (`interested`/`signed-up`/`declined`) -> transitional source-native status; future target splits into `CalendarEntry` (`signed-up`) and `Favorite` (`interested`), not `EventOccurrenceParticipation`; `declined` has no approved durable target (decision §27)
- Current invitation invitee -> EventOccurrenceParticipation or EventSeriesParticipation
- Current activity note -> early/simple EventLog
- Current absence session -> EventOccurrence of type `absence` + CalendarEntry

The refactor should gradually separate these concepts without changing the whole Firestore backend at once.

## Future concepts, not implemented now

These are valid future concepts but should not be implemented yet:

- EventTemplate
- TrainingProgram
- TrainingProgramItem
- PrivateLesson as its own event type
- Fight as a separate bout-level entity
- Saved filter favorites

Do not introduce these into implementation unless explicitly requested.