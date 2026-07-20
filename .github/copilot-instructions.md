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

- /docs/fightweek_decisions.md
- /docs/fightweek_domain_model.md
- /docs/fightweek_core_flows.md
- /docs/fightweek_test_scenarios.md
- /docs/fightweek_database_model.dbml

For risky or unclear implementation tasks, use:

- /.github/prompts/grill-me.prompt.md