# FightWeek — Domain Model

## Terminology

| Dansk | English | Description |
|---|---|---|
| **Hold** | Class | A recurring weekly training class offered by a gym. Stored in the catalogue. |
| **Event** | Event | A one-off activity: tournament (stævne), seminar, social gathering, or other. |
| **Aktivitet** | Activity | Anything scheduled in a fighter's calendar. The generic container. |
| **Træning** | Training | An aktivitet of type *træning* — a training session added from the catalogue or manually. |
| **Fravær** | Absence | An aktivitet of type *fravær* — a period where the fighter is unavailable. |
| **Gym** | Gym | A training venue with address, contact info, and an external schedule link. |

## Entity Overview

```
┌─────────────────────────────────────────────────────────┐
│                    SHARED DATA                          │
│                                                         │
│  Hold (Catalogue)         Event              Gym        │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────┐  │
│  │ title        │    │ title        │   │ name      │  │
│  │ discipline   │    │ type         │   │ address   │  │
│  │ level        │    │ discipline?  │   │ phone?    │  │
│  │ gym ─────────┼────┤ location?    │   │ email?    │  │
│  │ location     │    │ address?     │   │ scheduleUrl│ │
│  │ address?     │    │ date/endDate │   └───────────┘  │
│  │ instructor?  │    │ startTime?   │                   │
│  │ schedules[]  │    │ endTime?     │                   │
│  │ description? │    │ description? │                   │
│  └──────┬───────┘    │ organiser?   │                   │
│         │            │ url?         │                   │
│         │            │ cost?        │                   │
│         │            │ deadline?    │                   │
│         │            │ signups{}    │                   │
│         │            └──────┬───────┘                   │
└─────────┼───────────────────┼───────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│               FIGHTER'S CALENDAR                        │
│                                                         │
│  Aktivitet (per week, per day)                          │
│  ┌─────────────────────────────────────────────┐        │
│  │ type: 'træning' | 'fravær' | 'event'        │        │
│  │ name, category, start, end, location         │        │
│  │ catalogueClassId? ──► links back to Hold     │        │
│  │ eventId? ──────────► links back to Event     │        │
│  │ fraværGroupId? ────► groups multi-day fravær  │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  Stored at: /users/{fighter}/weeks/week_{n}             │
│  Shape: { Mandag: [Aktivitet, ...], Tirsdag: [...] }    │
└─────────────────────────────────────────────────────────┘
```

## Firestore Paths

| Entity | Path | Read | Write |
|---|---|---|---|
| Hold | `artifacts/production/public/data/catalogue/{id}` | Anyone | Admin/Coach |
| Event | `artifacts/production/public/data/events/{id}` | Team | Admin/Coach (create/delete), Team (update sign-up) |
| Gym | `artifacts/production/public/data/gyms/{id}` | Anyone | Admin/Coach |
| Aktivitet | `artifacts/production/users/{fighter}/weeks/week_{n}` | Team | Owner + Admin/Coach |

## Aktivitet Types

### Træning
A training session. Can originate from:
- **Catalogue pick** — linked via `catalogueClassId` to a Hold. Inherits gym, address, instructor, schedule info.
- **Manual entry** — free-form name, category, time, location.

Fields: `id, name, category, start, end, location, status, catalogueClassId?, isRecurring?, recurrenceInterval?`

### Fravær
An absence period spanning one or more days. Grouped by `fraværGroupId`.

Fields: `id, type:'fravær', name, category:'Fravær', start, end, fraværTitel, fraværBeskrivelse, fraværGroupId, fraværStartDate, fraværEndDate, fraværStartTime, fraværEndTime, fraværDayIndex, fraværTotalDays`

### Event
A signed-up event appearing in the calendar. Linked via `eventId` to the shared Event entity.

Fields: `id, type:'event', name, category:'Event', start, end, location, eventId`

## Detail View — Shared Information Blocks

Both Hold and Event detail views follow the same layout pattern:

1. **Header** — Title + category/type badge + discipline
2. **Date & time** — Day/date, start–end time
3. **Location** — Venue name + Google Maps link on address
4. **Description** — Free-text details
5. **Contact** — Phone, email (Hold: from Gym entity; Event: from organiser)
6. **External link** — Hold: gym schedule URL; Event: registration/info page
7. **Actions** — Hold: recurrence settings, delete; Event: sign-up status

## Categories

Training activities use the discipline categories:
`MMA, Brydning, Grappling, Boksning, Kickboxing, Fysisk træning, Andet`

Events use type badges:
`Stævne (tournament), Seminar, Socialt (social), Andet (other)`

## Actors & Roles

| Role | Capabilities |
|---|---|
| **Fighter** | View own + team calendar, add/edit own aktiviteter, sign up for events |
| **Coach** | Everything a fighter can + manage catalogue (hold) and events |
| **Admin** | Everything a coach can + manage backlog, feedback, story map |

> **Tech debt:** Roles are currently hardcoded by email in `firestore.rules` and `constants.ts`. Plan is to move to a Firestore-backed config document at `artifacts/production/public/config/roles`.
