// Architectural Blueprint — tech stack, data model, and architecture decisions
export const ARCHITECTURAL_BLUEPRINT = `# Architectural Blueprint

> The technical foundation of FightWeek — how the system is built, where data lives, and the decisions that shaped the architecture.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | Component-based UI with type safety |
| **Styling** | Tailwind CSS | Utility-first, dark/light theme support |
| **Backend** | Firebase (Firestore + Auth) | Real-time NoSQL database + authentication |
| **Hosting** | Vercel | Production deployment with automatic previews |
| **Build Tool** | Vite 5 | Fast dev server with HMR |
| **E2E Tests** | Playwright | Cross-browser automated testing |

---

## System Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    Vercel (CDN)                          │
│                  fightweek-app.vercel.app                │
└─────────────────────┬───────────────────────────────────┘
                      │ serves
                      ▼
┌─────────────────────────────────────────────────────────┐
│              React SPA (Vite build)                      │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Schedule │ │ Team View│ │  Admin   │ │  Backlog   │  │
│  │  (main)  │ │(readonly)│ │ (admin)  │ │ (admin)    │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
│       └─────────────┴────────────┴─────────────┘         │
│                         │                                │
│              Firebase SDK (client-side)                   │
└─────────────────────────┬───────────────────────────────┘
                          │ Firestore SDK
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Firebase Project                        │
│  ┌──────────────────┐  ┌────────────────────────────┐   │
│  │  Firebase Auth    │  │       Firestore            │   │
│  │  (Google OAuth)   │  │  /artifacts/production/... │   │
│  └──────────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
\`\`\`

---

## Data Model

### Database Structure

\`\`\`
Firebase Firestore
└── artifacts/
    └── production/
        ├── users/{userId}/
        │   ├── weeks/week_{isoWeekNum}     → Weekly schedule
        │   └── templates/standard           → Standard week template
        └── public/data/
            ├── backlog/items/{itemId}        → Backlog items
            ├── backlog/feedback/{feedbackId} → User feedback
            └── story-map/main               → Story map data
\`\`\`

### Core Entities

#### User (Firebase Auth)

| Field | Type | Description |
|-------|------|-------------|
| uid | string | Firebase Auth UID |
| email | string | Login email, maps to USER_MAPPING |
| role | admin \\| coach \\| fighter | Derived from config |

#### Week Schedule

**Path:** \`/artifacts/production/users/{userId}/weeks/week_{isoWeekNum}\`

Each day (Mandag–Søndag) contains an array of Session objects.

#### Session

| Field | Type | Description |
|-------|------|-------------|
| id | number | Timestamp-based unique ID |
| name | string | Session name |
| category | string | MMA, Brydning, Striking, Styrke, Cardio, Mobilitet, Andet |
| start / end | string | Time (HH:MM) |
| location | string | Training location |
| status | planned \\| cancelled | Current status |
| isRestDay | boolean | Rest-day marker |
| cancellationReason | string? | Why it was cancelled |

#### Backlog Item

**Path:** \`/artifacts/production/public/data/backlog/items/{itemId}\`

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| number | number | Sequential display number |
| title | string | Short title |
| desc | string | Full description |
| acceptance | string | Acceptance criteria |
| status | backlog \\| ready \\| doing \\| done | Kanban status |
| tag | string | Label/category |
| release | string? | Release assignment |
| order | number | Sort order (priority) |

---

## Authentication & Access Control

| Method | Detail |
|--------|--------|
| **Provider** | Firebase Auth — Google OAuth |
| **Browser check** | In-app browsers (Messenger, Instagram) are blocked; users forced to Safari/Chrome |
| **Mobile auth** | Manual login method selection (Popup vs Redirect) to handle cross-site tracking |
| **Role mapping** | \`USER_MAPPING\` in constants.ts maps email → fighter name + role |

### Access Levels

| Level | Who | Capabilities |
|-------|-----|-------------|
| **Admin** | Rune, Frodi | Full CRUD, backlog access, process docs |
| **Coach** | Frodi | View all fighters, manage team schedules |
| **Fighter** | Karl + others | Own schedule, team view (read-only), feedback |

---

## Key Architecture Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **TypeScript from day 1** | Prevents "change corner A, break corner B" cascading bugs |
| 2 | **Firebase Firestore** | Real-time sync, offline support, no server to manage |
| 3 | **Vite + React** | Fast DX, broad ecosystem, component model fits the UI |
| 4 | **Tailwind CSS** | Utility-first matches the rapid iteration pace; dark/light theme via class strategy |
| 5 | **Mobile-first design** | Primary users (fighters) use phones exclusively |
| 6 | **localStorage-first persistence** | Story map uses localStorage with optional Firestore background sync — resilient to permission errors |
| 7 | **Phased refactoring** | Structure → Components → State management — low-risk incremental approach |
| 8 | **Self-documenting app** | Team charter, release notes, design system all live inside the admin area |

---

## Folder Structure

\`\`\`
src/
├── components/          → Reusable UI components
│   ├── backlog/         → Backlog-specific components
│   └── story-map/       → Story map sub-components
├── content/             → Markdown content for doc pages
├── hooks/               → Custom React hooks
├── pages/               → Top-level page components
├── services/            → Firebase service layer
├── types/               → TypeScript type definitions
├── config/              → Constants and Firebase setup
└── utils/               → Date, CSV, device utilities
\`\`\`

---

## Browser Constraints

| Constraint | Solution |
|-----------|---------|
| In-app browsers break Firebase Auth | Detect and redirect to Safari/Chrome |
| Cross-site tracking blocks mobile auth | Manual Popup vs Redirect chooser |
| iOS Safe Area | Bottom nav respects \`pb-safe\` |
| PWA considerations | Not currently a PWA — standard web app |

---

## Deployment

| Environment | URL | Branch |
|-------------|-----|--------|
| **Production** | fightweek-app.vercel.app | main |
| **Preview** | Auto-generated per PR | feature/* |

Vercel auto-deploys on push to main. Preview deployments created for pull requests.
`;
