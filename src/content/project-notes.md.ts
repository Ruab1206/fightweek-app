// Project Notes content for FightWeek
export const PROJECT_NOTES = `# FightWeek App — Project Charter & Development Notes

**Last Updated:** February 13, 2026
**Current Branch:** \`feature/bedre-design\`
**Team:** Rune (Product Owner) + Claude (Technical Architect/Developer)

---

## 🥊 The Fighter Team Charter

**Core Purpose:** At få de bedst mulige kæmpere ud af dem, der bliver coachet af Frodi.

### Principper
- **Et stærkt fællesskab:** Når vi hjælper hinanden, gavner det os selv. Vi stoler på hinanden og overholder fælles aftaler.
- **Vi bruger omgivelserne:** Vi trækker på ressourcer i Rumble, netværk og eksperter. Vi er altid de gode gæster og værter.
- **Målsætning & Opfølgning:** Kæmpere committer til egne mål med konkrete handlingsplaner. Vi bruger data (og video) til læring.
- **Medindflydelse & Feedback:** Alle har taleret, men mandatet er klart. Vi opsøger løbende ærlig feedback.

### "Standarden" (Regelsæt)
- Vi overholder ugeplanen.
- **Deadline:** Ændringer til ugeplan aftales med Frodi senest lørdag kl. 18.
- **Mødepligt:** Vi kommer mandag og fredag (også hvis man er skadet).
- Vi er klar til tiden.
- Vi holder hinanden op på standarden.

### Roller
| Role | Person | Responsibility |
|------|--------|---------------|
| **Coach** | Frodi | Definerer mål/plan, analyserer resultater, skaffer kampe |
| **Kæmper** | Karl m.fl. | Følger planen, hjælper de andre, giver feedback |
| **Assistent** | Rune | Hjælper med og forbedrer processen (RTE) |

---

## 🎯 Product Vision (Elevator Pitch)

> **For** teamets ambitiøse kæmpere,
> **Who** ønsker at optimere deres træning, overholde "Standarden" og realisere deres fulde potentiale,
> **The** FightWeek App
> **Is a** specialiseret mål-, planlægnings- og feedback-platform
> **That** fjerner logistisk støj, synliggør træningsindsatsen i realtid og sikrer datadrevet opfølgning,
> **Unlike** generiske kalendere, regneark eller Messenger-tråde,
> **Our product** er designet 100 % til at understøtte teamets unikke kultur, værdier og hverdag, hvor fokus på mål og disciplin til at arbejde efter disse er i centrum.

---

## 👥 Development Team

### Rune (RTE & Product Owner)
- **Vision & Retning:** Sætter kursen baseret på outcome-validation og værdier.
- **Prioritering:** Ejer backloggen og beslutter "hvad" og "hvorfor".
- **User Proxy:** Indsamler feedback fra Karl og Frodi og oversætter det til krav.
- **Flow Master:** Sikrer at vi ikke drukner i processer, men leverer værdi hurtigt.

### AI (The Cross-Functional Team)
- **Roller:** Agerer som samlet team inden for Business Analysis, Arkitektur, UX/UI, Frontend/Backend udvikling og QA.
- **Tech Lead:** Ansvarlig for kodekvalitet, sikkerhed (Poka-Yoke) og skalerbarhed.
- **Sparringspartner:** Udfordrer løsninger, hvis de bliver for komplekse eller ikke understøtter visionen.
- **Hukommelse:** Vedligeholder teknisk dokumentation og kontekst.

---

## ✅ Definition of Done

En feature eller opgave betragtes først som færdig ("Done"), når:

1. Koden er implementeret og testet i produktionsmiljøet.
2. Funktionaliteten virker på både desktop og mobil (responsivt).
3. Feedback-loop er etableret: Der er indbygget mulighed for, at brugerne kan give feedback direkte på den nye funktionalitet.
4. Data gemmes korrekt i databasen (ingen hardcoded "lappe-løsninger").

---

## 🧑‍🤝‍🧑 Key Personas

| Persona | Role | Needs |
|---------|------|-------|
| **Frodi** (Coach) | Coach med stærk teoretisk og praktisk forståelse for MMA. Kandidatgrad i idræt. | Overblik, nem styring og sikring af kæmpernes mål. |
| **Karl** (Fighter) | Seriøs kæmper, som ønsker at komme i UFC. Stærk baggrund i brydning og grappling. | Struktur, kampforberedelse og let overblik over mål, træning og kampe. |
| **Rune** (Admin/RTE) | Faciliterer rammerne i teamet. | Flow, simple processer og "Poka-Yoke" (fejlsikrede) løsninger. |

---

## 🚀 Tech Stack & Constraints

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript |
| Styling | Tailwind CSS |
| Backend | Firebase (Firestore + Auth) |
| Hosting | Vercel |
| E2E Tests | Playwright |

### Browser Constraints
- **Messenger/In-App Browsers:** SKAL blokeres. Brugeren tvinges til Safari/Chrome.
- **Mobile Auth:** Håndterer Cross-Site Tracking issues med manuel "Vælg Login Metode" (Popup vs. Redirect).

### Database Structure
\`\`\`
Firebase Firestore (NoSQL)
/artifacts/production/users/{userId}/{collection}/{docId}

Collections:
├── weeks        → Den faktiske plan for en given uge
│   └── week_{isoWeekNum}: { Mandag: [{id, name, category, start, end, ...}] }
└── templates    → Kæmperens "Grundplan" (kan importeres til en uge)
    └── standard
\`\`\`

---

## 📋 Current Priorities

### TIER 1: Core Weekly Planning
1. **Alle ugedage i bredden for teamet** — All 7 days visible at once, no horizontal scroll
2. **Custom feedback confirmation** — Custom popup instead of browser confirm
3. **Split code into smaller files** — Max 1,200 lines/file, proper folder structure, TypeScript
4. **Auto-update current date** — "Uge 6 (Aktuel)" with today's date auto-selected
5. **Weekly planning workflow** — State machine: fighter_editing → fighter_submitted → coach_reviewing → approved

### TIER 2: Admin & Backlog
- Backlog list view as default
- Keyboard shortcuts to navigate between app ↔ backlog
- Admin interface for managing standard sessions

### TIER 3: Advanced
- Activity calendar, goal tracking, user profiles, email notifications, etc.

---

## 🏗️ Architecture Decisions

### Phase 1 Refactor — Foundation (✅ Complete)
\`\`\`
src/
├── config/       → Constants and Firebase setup
├── utils/        → Date, CSV, and device utilities
├── types/        → TypeScript type definitions
├── hooks/        → Custom React hooks
└── components/   → Extracted UI components
\`\`\`

### Design Principles
- **Poka-Yoke:** If a user can do something wrong, it's a design flaw. Remove the possibility.
- **Single Source of Truth:** Project Notes updated at every major change.
- **Outcome Focus:** We don't build features for features' sake. We solve problems for the team.

---

## 📝 Decision Log

| # | Date | Decision | Rationale |
|---|------|----------|-----------|
| 1 | Feb 13, 2026 | Adopt TypeScript | Prevents "change corner A, break corner B" bugs |
| 2 | Feb 13, 2026 | Phased refactoring (structure → components → state) | Low-risk incremental approach preserves production stability |
| 3 | Feb 13, 2026 | Simplified weekly flow first | Observe behavior before complex approval workflow |

---

## 🔄 Session History

### Session 1: Codebase Audit & Planning (Feb 13, 2026)
- Analyzed full 2,158-line App.jsx
- Identified root cause: monolithic structure → cascading bugs
- Reviewed backlog (45+ stories across 3 tiers)
- Clarified priorities: code splitting > feature addition

### Session 2: Phase 1 Refactor — Foundation Complete (Feb 13, 2026)
- ✅ Folder structure created (\`config/\`, \`utils/\`, \`types/\`, \`hooks/\`, \`components/\`)
- ✅ Constants extracted (~150 lines)
- ✅ Utilities extracted & typed (~400 lines)
- ✅ TypeScript support added
- ✅ Documentation created

---

## ✅ Completed Features
These are stable and should remain unchanged during refactor:
- ✅ Login (Google OAuth)
- ✅ Create weekly plan (core)
- ✅ Handle cancellations (sick, injured, prevented)
- ✅ Mark rest days
- ✅ Team view with date selection
- ✅ Admin backlog dashboard
- ✅ CSV import/export
- ✅ Keyboard shortcuts
- ✅ Feedback system

---

## 🐛 Known Issues

| Issue | Severity | Root Cause |
|-------|----------|-----------|
| App turns black in feedback inbox | 🔴 High | Modal/overlay bug |
| Weekdays overflow in team view | 🔴 High | Responsive layout |
| Features break when corners change | 🔴 High | Monolithic state management |
| Hard to find bugs | 🟠 Medium | No separation of concerns |

---

*End of Project Charter*
`;
