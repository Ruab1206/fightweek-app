// Conceptual Domain Model — the shared language of FightWeek
// This is our "think big" document: the full picture of the domain.
// We build incrementally from here — each release picks a slice.
// Version history at the bottom.
export const DOMAIN_MODEL = `# Conceptual Domain Model

> The shared language of FightWeek — every concept, how they connect, and why they exist.
> We think big here so we can act small with confidence.

---

## How to Read This Document

This document describes the **full conceptual model** — the world as we want it to be. Not everything here is built yet. Each concept is marked with its current implementation status:

| Status | Meaning |
|--------|---------|
| ✅ Live | In production today |
| 🔨 Building | Being implemented in the current release |
| 📐 Designed | Agreed on, not yet built |
| 💭 Envisioned | Part of the big picture, details TBD |

---

## The Big Picture

\`\`\`
                        ┌──────────────┐
                        │    Team      │  The performance unit
                        └──────┬───────┘
                               │ has members
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────────┐
        │  Coach   │    │  Fighter │    │ Coordinator  │
        └────┬─────┘    └────┬─────┘    └──────────────┘
             │               │
     curates │        owns   │
             ▼               ▼
    ┌─────────────┐   ┌──────────────┐
    │  Curated    │   │  Weekly Plan │──── Standarduge (template)
    │  Catalogue  │   │  (committed) │──── Faktisk Uge (instance)
    └──────┬──────┘   └──────┬───────┘
           │                 │ contains
           │                 ▼
           │          ┌──────────────┐        ┌──────────────┐
           └─────────▶│   Session    │───────▶│  Intensity   │
                      │  (planned    │        │  Rating 1–5  │
                      │   activity)  │        └──────────────┘
                      └──────┬───────┘
                             │ can be blocked by
                             ▼
                      ┌──────────────┐
                      │  Impediment  │
                      │  (injury,    │
                      │   illness)   │
                      └──────────────┘

    External world:
    ┌──────────┐     ┌───────────────┐     ┌───────────────┐
    │  Source   │────▶│   Catalogue   │────▶│   Curated     │
    │  (Klub)  │     │   Item (raw)  │     │   Catalogue   │
    └──────────┘     └───────────────┘     └───────────────┘

    Goals & Outcomes:
    ┌───────────────┐    ┌────────────────┐    ┌─────────────┐
    │  Long-term    │───▶│  Quarterly     │───▶│   Weekly    │
    │  Goal         │    │  Goal          │    │   Focus     │
    └───────────────┘    └────────────────┘    └─────────────┘

    Fights & Events:
    ┌───────────────┐    ┌────────────────┐
    │  Fight/Event  │───▶│  Fight Camp    │
    │  (Tournament) │    │  (preparation) │
    └───────────────┘    └────────────────┘
\`\`\`

---

## 1. Actors & Roles

### Profile (Person) 📐

A person in the system. Has one login (Firebase Auth) but can hold **different roles in different contexts** — Coach for Team A, member at Club B.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Firebase Auth UID |
| email | string | Login identity |
| displayName | string | How they appear in the app |
| avatarUrl | string? | Profile picture |
| createdAt | string | ISO timestamp |

> **Current state ✅:** \`USER_MAPPING\` in constants maps email → name + single role. No separate Profile entity.

### Roles 📐

Roles are contextual — assigned per team membership, not globally.

| Role | Danish | Responsibility | Current mapping |
|------|--------|----------------|-----------------|
| **Head Coach** | Cheftræner | Overall team direction, goal hierarchy, fight procurement | \`coach\` |
| **Coach** | Coach | Fighter progression, curates catalogue, reviews weekly plans | \`coach\` |
| **Coordinator** | Teamkoordinator | Logistics, process, impediment removal (our "Scrum Master") | \`admin\` |
| **Instructor** | Træner/Instruktør | Delivers specific technical training (often external, club-linked) | 💭 Not mapped |
| **Fighter** | Kæmper/Udøver | Primary athlete. Owns their plan, executes, gives feedback | \`fighter\` |
| **Stakeholder** | Interessent | Read-only access to relevant parts (manager, family) | 💭 Not mapped |

> **Current state ✅:** Three roles: \`fighter | coach | admin\`. Sufficient for now but will need expansion.

---

## 2. Organisation

### Team 📐

The performance unit. A group of people working toward shared goals. Independent of any single club — the team trains across multiple locations.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Team name |
| description | string | Purpose and context |
| createdAt | string | ISO timestamp |

> **Current state ✅:** Implicit — one hardcoded team. The \`FIGHTERS\` array and \`USER_MAPPING\` define membership.
> **Why model it:** Even with one team, having the concept allows us to scope data correctly and opens the door to training communities later.

### Source (Klub / Promoter) 📐

An external entity that provides activities — a gym offering classes, or a promoter staging a tournament.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | e.g. "Rumble Sports", "Rødovre BK", "DM Brydning" |
| type | 'gym' \\| 'promoter' \\| 'federation' | What kind of source |
| location | string | Physical address or area |
| website | string? | For scraping schedule data |
| notes | string? | Coach's notes about this source |

> **Current state:** Locations exist as free-text strings on sessions ("Rumble", "Burnell", "Rødovre"). Not a separate entity.

---

## 3. The Catalogue

This is the pipeline from the external world into the team's training options.

### Catalogue Item (Aktivitetsudbud) 🔨

A raw training or event offering. Scraped from a club website or entered manually. Exists independently of any team.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| sourceId | string | Which Source offers this |
| name | string | e.g. "Nogi All", "Wall Wrestling" |
| discipline | string | Primary discipline (see Disciplines below) |
| focusArea | string? | Sub-category tag: "Parterre", "Sparring", "Clinch" |
| dayOfWeek | string? | Recurrence day (null for one-off events) |
| startTime | string? | HH:MM (null if TBD) |
| endTime | string? | HH:MM |
| location | string | Where it happens |
| recurrence | 'weekly' \\| 'biweekly' \\| 'monthly' \\| 'one-off' | How often |
| level | 'all' \\| 'advanced' \\| 'beginner'? | Skill requirement |
| instructor | string? | Who teaches |
| validFrom | string? | When this offering starts |
| validUntil | string? | When it expires (semester end, etc.) |

> **Current state ✅:** \`GLOBAL_TEMPLATES\` in constants.ts is a hardcoded version of this — 30 items with day, name, category, time, location.
> **Next step 🔨:** Promote to a Firestore-backed entity. This is one of the first things to build.

### Curated Catalogue (Team Bruttoliste) 📐

The Coach's filter. From the full catalogue, the coach selects which items are relevant for the team (or specific fighters). Only curated items appear as choices when building a weekly plan.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| catalogueItemId | string | Reference to the raw offering |
| teamId | string | Which team this is curated for |
| approvedBy | string | Coach who approved it |
| approvedAt | string | When |
| availableTo | 'team' \\| string[] | Whole team or specific fighter IDs |
| supportedGoals | string[]? | Which goals this training supports |
| coachNotes | string? | Why this was selected |

> **Current state:** Not modelled. All templates are visible to everyone.

---

## 4. Disciplines & Categories

A two-level classification of training activities.

### Discipline (top level)

| Discipline | Danish | Colour | Description |
|-----------|--------|--------|-------------|
| MMA | MMA | Red | Mixed martial arts |
| Brydning | Brydning | Emerald | Wrestling (freestyle, Greco-Roman) |
| Grappling | Grappling | Purple | BJJ, NoGi, submission grappling |
| Boksning | Boksning | Yellow | Boxing |
| Kickboxing | Kickboxing | Orange | Kickboxing, Muay Thai |
| Fysisk træning | Fysisk træning | Stone | Strength, cardio, mobility |
| Andet | Andet | Slate | Other / miscellaneous |

### Focus Area (sub-tag) 📐

Optional tag on any session for more specificity: \`Sparring\`, \`Parterre\`, \`Wall Wrestling\`, \`Clinch\`, \`Padwork\`, \`Conditioning\`, \`Technique\`, etc.

> **Current state ✅:** The discipline list in \`constants.ts\` matches what's above. Focus areas are not yet modelled.

---

## 5. Goal Hierarchy

Goals cascade from long-term vision down to weekly focus. Each level provides context for the one below it.

### Long-term Goal 💭

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| fighterId | string | Whose goal |
| title | string | e.g. "Compete in the UFC" |
| description | string | Context and motivation |
| primaryDisciplines | string[] | What to focus on over years |
| timeHorizon | string | e.g. "2026–2030" |

### Quarterly Goal 💭

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| fighterId | string | Whose goal |
| longTermGoalId | string? | Links up to the parent goal |
| type | 'result' \\| 'competence' | Win a tournament vs. improve a skill |
| title | string | e.g. "Solid parterre defence" |
| targetMetric | string? | How we measure success |
| quarter | string | e.g. "2026-Q2" |
| trainingMix | object? | Desired sessions/week per discipline |

### Weekly Focus 💭

| Field | Type | Description |
|-------|------|-------------|
| fighterId | string | Whose focus |
| weekId | string | e.g. "week_14" |
| focusAreas | string[] | What to pay extra attention to this week |
| coachNote | string? | Coach's guidance for the week |

> **Current state:** None of the goal hierarchy is built. This is an important long-term concept but not required for the first releases.

---

## 6. Planning & Execution

This is the core of what FightWeek does today, and where we'll evolve most.

### Standard Week (Template) ✅

The baseline plan for a typical week. Co-built by coach and fighter based on quarterly goals and the curated catalogue.

| Field | Type | Description |
|-------|------|-------------|
| fighterId | string | Whose template |
| sessions | Session[] | The recurring sessions per day |
| lastUpdated | string | ISO timestamp |
| version | number | Tracks changes |

> **Firestore path:** \`/artifacts/production/users/{userId}/templates/standard\`

### Weekly Plan (Committed Week) ✅

A concrete week. Generated from the template, then adjusted by the fighter in the weekend ("inspect & adapt"), reviewed by coach, and locked when the week starts.

| Field | Type | Description |
|-------|------|-------------|
| fighterId | string | Whose week |
| weekNumber | number | ISO week |
| year | number | Year |
| sessions | Session[] | Per-day sessions |
| restDays | string[] | Days marked as rest |
| weeklyFocus | string[]? | 💭 What to focus on |
| status | enum | See Weekly Plan Workflow below |
| lastUpdated | string | ISO timestamp |

> **Firestore path:** \`/artifacts/production/users/{userId}/weeks/week_{isoWeekNum}\`

### Weekly Plan Workflow 📐

The lifecycle of a weekly plan — from draft to approved.

\`\`\`
  ┌─────────┐     submit      ┌───────────┐    approve    ┌──────────┐
  │  DRAFT  │ ──────────────▶ │ SUBMITTED │ ────────────▶ │ APPROVED │
  └─────────┘                 └─────┬─────┘               └──────────┘
       ▲                            │ reject                    │
       │                            ▼                           │
       │                     ┌───────────┐                      │
       └──────────────────── │ REJECTED  │                      │
          resubmit           └───────────┘                      │
                                                                │
                             ┌───────────┐    auto-approve      │
                             │ (timeout)  │ ────────────────────┘
                             └───────────┘
\`\`\`

**Rules:**
- Monday: Next week becomes available (DRAFT)
- Fighter submits by Saturday 18:00
- Coach reviews by Sunday 18:00
- If no response by Sunday 18:00 → auto-approved
- Once approved: only cancellations allowed (no new sessions)

> **Current state ✅:** Weeks exist and work. The workflow (submit/review/approve) is designed but not implemented.

### Session ✅

A specific training activity in the calendar. The atomic unit of planning and execution.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Session name (e.g. "Nogi Adv") |
| discipline | string | Primary discipline |
| focusArea | string? | 📐 Sub-tag (e.g. "Sparring") |
| start | string | Start time (HH:MM) |
| end | string | End time (HH:MM) |
| location | string | Where |
| sourceId | string? | 📐 Link to Catalogue Item |
| day | string | Day of week (Danish) |
| status | 'planned' \\| 'completed' \\| 'cancelled' | 📐 Was: planned/cancelled only |
| isRestDay | boolean | Rest-day marker |
| cancellationReason | string? | Why cancelled |
| cancellationTime | string? | When cancelled |
| intensity | 1 \\| 2 \\| 3 \\| 4 \\| 5 \\| null | 📐 Post-session self-reported rating |
| completedAt | string? | 📐 When marked as completed |
| sessionNote | string? | 💭 Fighter's note after training |

> **Current state ✅:** Core entity, works well. Status is \`planned | cancelled\` only. No intensity, no completed state, no focus area.
> **Next steps:** Add \`completed\` status + \`intensity\` rating. This unlocks attendance tracking and training load data.

---

## 7. Fights & Events

### Fight / Tournament 💭

A competitive event. Fundamentally different from a training session — it has opponents, weight classes, results, and drives the goal hierarchy.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| fighterId | string | Who is competing |
| eventName | string | e.g. "DM i Brydning 2026" |
| date | string? | Specific date (null if TBD) |
| estimatedPeriod | string? | e.g. "2026-Q4" when date unknown |
| location | string? | Where |
| discipline | string | Which discipline |
| weightClass | string? | Weight class |
| opponent | string? | If known |
| result | 'win' \\| 'loss' \\| 'draw' \\| 'nc' \\| null | Post-fight |
| resultMethod | string? | "Submission", "Decision", "KO", etc. |
| status | 'targeted' \\| 'confirmed' \\| 'completed' \\| 'cancelled' | Lifecycle |

### Fight Camp 💭

A preparation period leading up to a fight. Adjusts the training plan to peak for the event.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| fightId | string | Which fight this prepares for |
| fighterId | string | Who |
| startWeek | number | Camp start (ISO week) |
| endWeek | number | Fight week |
| focusDisciplines | string[] | What to emphasise |
| notes | string | Camp strategy |

> **Current state:** Not modelled. Fights are mentioned in the team charter but not tracked in the app.

---

## 8. Impediments

### Impediment 📐

Anything that limits a fighter's capacity — injury, illness, personal logistics. Designed to prevent scheduling conflicts and enable data tracking.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| fighterId | string | Who is affected |
| type | 'injury' \\| 'illness' \\| 'logistics' \\| 'other' | Category |
| description | string | What happened |
| startDate | string | When it started |
| endDate | string? | When it ended (null = ongoing) |
| maxIntensity | number? | Cap on intensity (1–5, null = no training) |
| blockedDisciplines | string[]? | Which disciplines are off-limits |
| relatedSessionId | string? | If caused during a session |
| status | 'active' \\| 'resolved' | Current state |

> **Current state:** Not modelled. Only \`cancellationReason\` on sessions exists (free text: "Sygdom, Skade, Andet").

---

## 9. Admin & Development Entities

These support the product development process, not the fighter domain. They live in the same app because FightWeek is self-documenting.

### Backlog Item ✅

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| number | number | Sequential display number |
| title | string | Short title |
| desc | string | Full description |
| acceptance | string | Acceptance criteria |
| notes | string | Working notes |
| status | 'backlog' \\| 'ready' \\| 'doing' \\| 'done' | Kanban status |
| tag | string | Label/category |
| priority | 'Low' \\| 'Medium' \\| 'High' \\| 'Critical' | Priority |
| release | string | Release assignment |
| order | number | Sort order |
| userTaskId | string? | Story map placement |
| releaseSliceId | string? | Story map placement |
| createdAt / updatedAt | string | ISO timestamps |

### Feedback ✅

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| text | string | Feedback content |
| context | string | Where in the app |
| user | string | Email |
| userName | string | Display name |
| timestamp | string | ISO timestamp |
| status | 'new' \\| 'converted' \\| 'dismissed' | Processing status |

### Story Map ✅

Jeff Patton-style story map for development coordination and shared understanding of user needs. Contains Activities, User Tasks, Release Slices, and Sketch Personas.

> **Note:** The Story Map \`Activity\` concept is a *development planning* term (user activity = epic-level grouping). It's different from the fighter-domain \`Catalogue Item\` / \`Session\`. Same word, different bounded contexts.

---

## 10. Where Data Lives

| Entity | Firestore Path | Status |
|--------|---------------|--------|
| User auth | Firebase Auth | ✅ |
| User mapping | \`constants.ts\` (code) | ✅ (move to Firestore later) |
| Weekly plans | \`users/{uid}/weeks/week_{n}\` | ✅ |
| Standard template | \`users/{uid}/templates/standard\` | ✅ |
| Backlog items | \`public/data/backlog/items/{id}\` | ✅ |
| Feedback | \`public/data/backlog/feedback/{id}\` | ✅ |
| Story map | \`public/data/story-map/main\` | ✅ |
| Catalogue items | \`public/data/catalogue/items/{id}\` | 📐 Next |
| Sources (clubs) | \`public/data/catalogue/sources/{id}\` | 📐 Next |
| Goals | \`users/{uid}/goals/{id}\` | 💭 Later |
| Impediments | \`users/{uid}/impediments/{id}\` | 💭 Later |
| Fights | \`users/{uid}/fights/{id}\` | 💭 Later |
| Team | \`public/data/team/main\` | 💭 Later |

---

## 11. Key Domain Rules

These are the business rules that make FightWeek what it is:

1. **"Standarden" governs the week.** The weekly plan is a commitment. Changes after Saturday 18:00 require coach approval.
2. **Template → Instance.** Every week starts as a copy of the standard week. The fighter adjusts, coach reviews.
3. **Catalogue → Curated → Session.** External offerings are filtered by the coach before fighters can select them.
4. **Impediments block sessions.** An active injury on "Boksning" should warn if the fighter adds a boxing session.
5. **Sessions have a lifecycle.** Planned → Completed (with intensity) or Cancelled (with reason). This drives all data tracking.
6. **Goals cascade downward.** Long-term → Quarterly → Weekly focus. Each level informs the choices at the next.
7. **Fights shape the plan.** An upcoming fight creates a camp period that adjusts training priorities.
8. **The team trains across clubs.** There is no single "home gym." The catalogue aggregates offerings from multiple sources.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-02 | Initial version. Captures full conceptual model from domain conversations between PO and AI Agent. |
`;
