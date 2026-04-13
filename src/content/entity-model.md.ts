// Entity Model — what's actually implemented in code and Firestore right now
// For the full conceptual model (including envisioned concepts), see domain-model.md.ts
// Updated 2026-04-13: Added FightweekEvent entity (1.7), updated Session fields, updated diagram
export const ENTITY_MODEL = `# Entity Model — What's Built

> The data structures that exist in code and Firestore **right now**. For the full conceptual picture (goals, fights, impediments, catalogue, etc.), see the **Domain Model**.

---

## How Everything Connects (Current)

\`\`\`
┌──────────────┐
│     User     │
│  (Firebase)  │
└──────┬───────┘
       │ userId
       ├──────────────────────────┐
       ▼                          ▼
┌─────────────┐            ┌──────────────┐
│    Week     │            │   Template   │
│ (schedule)  │            │  (standard)  │
└──────┬──────┘            └──────────────┘
       │ contains
       ▼
┌─────────────┐            ┌──────────────────┐
│   Session   │◀──merge────│ FightweekEvent   │
│ (training)  │            │ (stævne/seminar) │
└─────────────┘            └──────────────────┘

Public:                          Admin-only:
┌─────────────────┐              ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ CatalogueClass  │              │   Backlog   │────▶│   Feedback   │     │  Story Map   │
│ (training offer)│              │   Items     │     │  (from users)│     │  (dev tool)  │
└─────────────────┘              └─────────────┘     └──────────────┘     └──────────────┘
\`\`\`

---

## Core Entities

### User (Firebase Auth) ✅

| Field | Type | Description |
|-------|------|-------------|
| uid | string | Firebase Auth UID |
| email | string | Login email, maps to USER_MAPPING |
| role | 'admin' \\| 'coach' \\| 'fighter' | Derived from USER_MAPPING config |

### Week Schedule ✅

**Firestore path:** \`/artifacts/production/users/{userId}/weeks/week_{isoWeekNum}\`

Each day (Mandag–Søndag) contains an array of Session objects.

### Session ✅

| Field | Type | Description |
|-------|------|-------------|
| id | number \\| string | Timestamp-based unique ID (or \`event_{eventId}_{date}\` for event sessions) |
| name | string | Session name (e.g. "Morgen MMA") |
| category | string | One of: MMA, Brydning, Grappling, Boksning, Kickboxing, Fysisk træning, Andet |
| start | string | Start time (HH:MM) |
| end | string | End time (HH:MM) |
| location | string | Training location |
| status | 'planned' \\| 'active' \\| 'cancelled' | Current status |
| isRestDay | boolean | Whether this is a rest-day marker |
| cancellationReason | string? | Why it was cancelled |
| cancellationTime | string? | ISO timestamp of cancellation |
| catalogueClassId | string? | Link to CatalogueClass when added from catalogue |
| type | 'event'? | Set when session represents an event sign-up |
| eventId | string? | Links to FightweekEvent.id (when type='event') |
| eventSignupStatus | string? | Fighter's signup status for the event |
| fraværGroupId | string? | Groups multi-day fravær sessions together |
| fraværTitel | string? | Fravær title |
| fraværBeskrivelse | string? | Fravær description |
| fraværStartDate | string? | ISO date — first day of fravær |
| fraværEndDate | string? | ISO date — last day of fravær |
| fraværStartTime | string? | HH:MM — start time on each fravær day |
| fraværEndTime | string? | HH:MM — end time on each fravær day |

**Planned additions (from Domain Model):**
- \`status: 'completed'\` — enables attendance tracking
- \`intensity: 1–5\` — post-session self-reported load

### Standard Template ✅

**Firestore path:** \`/artifacts/production/users/{userId}/templates/standard\`

Same shape as Week Schedule — a reusable base plan that can be imported into any week.

---

## FightweekEvent (1.7) ✅

A one-off event the team can discover and sign up for — tournament, seminar, social gathering, etc.

**Firestore path:** \`/artifacts/production/public/data/events/{eventId}\`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Firestore document ID |
| title | string | "DM i Brydning 2026" |
| type | EventType | 'tournament' \\| 'seminar' \\| 'social' \\| 'other' |
| discipline | string? | "Brydning", "MMA", "BJJ" etc. |
| date | string | ISO date "2026-05-16" |
| endDate | string? | ISO date — for multi-day events |
| startTime | string? | "09:00" (HH:mm) |
| endTime | string? | "18:00" (HH:mm) |
| location | string? | Venue name |
| address | string? | Street address |
| latitude | number? | GPS latitude for distance filtering |
| longitude | number? | GPS longitude for distance filtering |
| description | string? | Free-text info |
| organiser | string? | Organising body / club |
| url | string? | External registration / info page |
| cost | string? | "250 kr" — free text |
| contactName | string? | Contact person name |
| contactEmail | string? | Contact email |
| contactPhone | string? | Contact phone number |
| registrationDeadline | string? | ISO date |
| signups | Record<string, EventSignupStatus> | Fighter name → 'interested' \\| 'signed-up' \\| 'declined' |
| createdBy | string | Email of creator |
| createdAt | string | ISO 8601 |
| updatedAt | string | ISO 8601 |

**Event ↔ Calendar merge:** The \`useEventMerge\` hook creates virtual Session objects (with \`type:'event'\`) for each day of events a fighter has signed up for. These are merged into the personal calendar and team schedule at render time — nothing persisted per-fighter.

---

## Admin Entities

### Backlog Item ✅

**Firestore path:** \`/artifacts/production/public/data/backlog/items/{itemId}\`

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| number | number | Sequential display number |
| title | string | Short title |
| desc | string | Full description / acceptance criteria |
| acceptance | string | Acceptance criteria |
| notes | string | Working notes |
| status | 'backlog' \\| 'ready' \\| 'doing' \\| 'done' | Kanban status |
| tag | string | Label/category tag |
| priority | 'Low' \\| 'Medium' \\| 'High' \\| 'Critical' | Priority |
| release | string? | Release assignment |
| order | number | Sort order (priority) |
| createdAt | string | ISO timestamp |
| updatedAt | string | ISO timestamp |

### Feedback ✅

**Firestore path:** \`/artifacts/production/public/data/backlog/feedback/{fbId}\`

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| text | string | Feedback content |
| context | string | Where in the app it was submitted |
| user | string | Email |
| userName | string | Display name |
| timestamp | string | ISO timestamp |
| status | 'new' \\| 'converted' \\| 'dismissed' | Processing status |

---

## 6. CatalogueClass (1.4)

A recurring training class offered by a gym.

**Firestore path:** \`/artifacts/production/public/data/catalogue/{classId}\`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID (e.g. \`class-1775146891668-0\`) |
| title | string | "Thaiboksning Elite" |
| discipline | string | "Muay Thai", "MMA", "BJJ", "S&C", "Boxing", "Wrestling" |
| subDiscipline | string? | Technique/format: "No-Gi", "Sparring", "Pads", "Wall Wrestling" |
| level | string | "Beginner", "Advanced", "Kamphold", "Elite", "Pro", "All" |
| ageGroup | string? | "6-12 år" — separate from level |
| gym | string | "Fightworld", "BurnellMMA" |
| location | string | Display name for the venue |
| address | string? | Street address (maps to Google Calendar location) |
| schedules | ClassSchedule[] | Recurring weekly timeslots |
| instructor | string? | Instructor name |
| description | string? | Free-text details, prerequisites |
| showRatings | boolean | When true, aggregated fighter ratings are shown |
| source | string | "holdoversigt-import" or "manual" |
| createdAt | string | ISO timestamp |
| updatedAt | string | ISO timestamp |

**ClassSchedule:**

| Field | Type | Description |
|-------|------|-------------|
| dayOfWeek | number | 1=Mon … 7=Sun (ISO 8601, maps to Google Calendar BYDAY) |
| startTime | string | "17:00" (HH:mm) |
| endTime | string | "18:30" (HH:mm) |

---

## Where Data Lives (Current)

| Entity | Location | Access |
|--------|----------|--------|
| Users | Firebase Auth | Read: app, Write: Auth only |
| Weeks | Firestore \`users/{uid}/weeks/\` | Read/Write: own user |
| Templates | Firestore \`users/{uid}/templates/\` | Read/Write: own user |
| Events | Firestore \`public/data/events/{eventId}\` | Read: all users, Write: admin only |
| Backlog | Firestore \`public/data/backlog/items/\` | Read: all admin, Write: admin only |
| Feedback | Firestore \`public/data/backlog/feedback/\` | Write: all users, Read: admin only |
| Story Map | Firestore \`public/data/story-map/main\` | Read/Write: admin only |
| Catalogue | Firestore \`public/data/catalogue/{classId}\` | Read: public (no auth), Write: admin only |
`;
