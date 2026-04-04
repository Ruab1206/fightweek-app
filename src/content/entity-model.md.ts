// Entity Model — what's actually implemented in code and Firestore right now
// For the full conceptual model (including envisioned concepts), see domain-model.md.ts
// Updated 2026-04-02: Aligned with Domain Model v1.0. Clarified scope as "what's live today."
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
┌─────────────┐
│   Session   │
│ (training)  │
└─────────────┘

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
| id | number | Timestamp-based unique ID |
| name | string | Session name (e.g. "Morgen MMA") |
| category | string | One of the configured disciplines |
| start | string | Start time (HH:MM) |
| end | string | End time (HH:MM) |
| location | string | Training location |
| status | 'planned' \\| 'cancelled' | Current status |
| isRestDay | boolean | Whether this is a rest-day marker |
| cancellationReason | string? | Why it was cancelled |
| cancellationTime | string? | ISO timestamp of cancellation |

**Planned additions (from Domain Model):**
- \`status: 'completed'\` — enables attendance tracking
- \`intensity: 1–5\` — post-session self-reported load
- \`focusArea: string\` — sub-discipline tag
- \`sourceId: string\` — link to catalogue item

### Standard Template ✅

**Firestore path:** \`/artifacts/production/users/{userId}/templates/standard\`

Same shape as Week Schedule — a reusable base plan that can be imported into any week.

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
| Backlog | Firestore \`public/data/backlog/items/\` | Read: all admin, Write: admin only |
| Feedback | Firestore \`public/data/backlog/feedback/\` | Write: all users, Read: admin only |
| Story Map | Firestore \`public/data/story-map/main\` | Read/Write: admin only |
| Catalogue | Firestore \`public/data/catalogue/{classId}\` | Read: public (no auth), Write: admin only |

For planned Firestore paths (goals, impediments, fights, events), see the **Domain Model**.
`;
