# FightWeek App - Project Charter & Development Notes

**Last Updated:** February 13, 2026  
**Current Branch:** `feature/bedre-design`  
**Team:** Rune (Product Owner) + Claude (Technical Architect/Developer)

----------------------
Added by Rune (in Danish):

The Fighter Team Charter
Core Purpose: At få de bedst mulige kæmpere ud af dem, der bliver coachet af Frodi. 

Principper:
Et stærkt fællesskab: Når vi hjælper hinanden, gavner det os selv. Vi stoler på hinanden og overholder fælles aftaler.
Vi bruger omgivelserne: Vi trækker på ressourcer i Rumble, netværk og eksperter. Vi er altid de gode gæster og værter.
Målsætning & Opfølgning: Kæmpere committer til egne mål med konkrete handlingsplaner. Vi bruger data (og video) til læring.
Medindflydelse & Feedback: Alle har taleret, men mandatet er klart. Vi opsøger løbende ærlig feedback.

"Standarden" (Regelsæt):
Vi overholder ugeplanen.
Deadline: Ændringer til ugeplan aftales med Frodi senest lørdag kl. 18.
Mødepligt: Vi kommer mandag og fredag (også hvis man er skadet).
Vi er klar til tiden.
Vi holder hinanden op på standarden.

Roller:
Coach (Frodi): Definerer mål/plan, analyserer resultater, skaffer kampe.
Kæmper (Karl, m.fl.): Følger planen, hjælper de andre, giver feedback.
Assistent (Rune): Hjælper med og forbedrer processen (RTE).

Principper for udvikling af FightWeek App
Før vi bygger software, forstår vi kulturen og vi er skarpe på det ønskede og opnåede outcome (ændring i brugeradfærd og brugeroplevelse). Dette er fundamentet for "High Performance Teamet" - Rune som PO og Gemini AI som udviklingsteam.

The Product Vision (Elevator Pitch)
Hvordan understøtter softwaren ovenstående team?

For teamets ambitiøse kæmpere,
Who der ønsker at optimere deres træning, overholde "Standarden" og realisere deres fulde potentiale,
The FightWeek App
Is a specialiseret mål-, planlægnings- og feedback-platform
That fjerner logistisk støj, synliggør træningsindsatsen i realtid og sikrer datadrevet opfølgning,
Unlike generiske kalendere, regneark eller Messenger-tråde,
Our product er designet 100% til at understøtte teamets unikke kultur, værdier og hverdag, hvor fokus på mål og disciplin til at arbejde efter disse er i centrum.

The Development Team (Roles & Responsibilities)
Vi arbejder som et agilt makkerpar med klare ansvarsområder:
Rune (RTE & Product Owner):
Vision & Retning: Sætter kursen baseret på outcome-validation og værdier.
Prioritering: Ejer backloggen (backlog.html) og beslutter "hvad" og "hvorfor".
User Proxy: Indsamler feedback fra Karl og Frodi og oversætter det til krav.
Flow Master: Sikrer at vi ikke drukner i processer, men leverer værdi hurtigt.

AI (The Cross-Functional Team):
Roller: Agerer som samlet team inden for Business Analysis, Arkitektur, UX/UI, Frontend/Backend udvikling og QA.
Tech Lead: Ansvarlig for kodekvalitet, sikkerhed (Poka-Yoke) og skalerbarhed.
Sparringspartner: Udfordrer løsninger, hvis de bliver for komplekse eller ikke understøtter visionen.
Hukommelse: Vedligeholder teknisk dokumentation og kontekst.

Definition of Done (DoD)
En feature eller opgave betragtes først som færdig ("Done"), når:
Koden er implementeret og testet i produktionsmiljøet.
Funktionaliteten virker på både desktop og mobil (responsivt).
Feedback-loop er etableret: Der er indbygget mulighed for, at brugerne kan give feedback direkte på den nye funktionalitet (fx via kontekst-knap).
Data gemmes korrekt i databasen (ingen hardcoded "lappe-løsninger").

Key Personas (Users)
Frodi (Coach): Coach med stærk teoretisk og praktisk forståelse for MMA og træningsprincipper generelt. Kandidatgrad i idræt. Har brug for overblik, nem styring og sikring af kæmpernes mål.
Karl (Fighter): Seriøs kæmper, som ønsker at komme i UFC. Stærk baggrund i brydning og grappling men også en habil striker. Har brug for struktur, kampforberedelse og en let måde at skabe overblik over sine mål, træning og kampe.
Rune (Admin/RTE): Faciliterer rammerne i teamet. Ønsker flow, simple processer og "Poka-Yoke" (fejlsikrede) løsninger som en støtte til at teamet fungerer optimalt.

-This is up for change - AI decides
-----------------------------------------------
Tech Stack & Constraints
Frontend: React 
Styling: Tailwind CSS (via CDN/Classes).
Backend: Firebase (Firestore + Auth).
Hosting: Vercel (Production URL: https://fightweek-app.vercel.app/).
Browser Constraints:
Messenger/In-App Browsers: SKAL blokeres. Brugeren tvinges til Safari/Chrome.
Mobile Auth: Skal håndtere Cross-Site Tracking issues. Vi bruger en manuel "Vælg Login Metode" (Popup vs. Redirect) tilgang (v23).
Architecture & Data Model
Database: Firebase Firestore (NoSQL). Structure Rule: /artifacts/production/users/{userId}/{collection}/{docId}
---------------------------------------

Collections:
weeks (Data):
ID: week_{isoWeekNum}
Indhold: Den faktiske plan for en given uge.
Felter: Mandag: [{id, name, category, start, end, location, status, isRestDay...}]
templates (Stamdata):
ID: standard
Indhold: Kæmperens "Grundplan" som kan importeres til en uge.
Current State (Status: Prototype v23)
Login: Implementeret med Browser-check og manuelt valg (Popup vs Redirect).
Core Loop: Kæmper kan se uge, markere hviledage, oprette pas.
Standard Uge: Kan redigeres og importeres.
Team View: Read-only visning af andres træning.

Development Guidelines 
Poka-Yoke: Hvis en bruger kan gøre noget forkert, er det en designfejl. Fjern muligheden.
Single Source of Truth: Dette dokument opdateres ved større ændringer.
Outcome Focus: Vi bygger ikke features for featurens skyld. Vi løser problemer for drengene.

Samarbejdsmodel:
Backlog styres i backlog.html.
Rune uploader backlog - csv - og beder AI læse denne charter ved start af hver session.


---


---

## 📋 Project Vision

FightWeek is a **training scheduler and team management app for professional fighters**. The app helps fighters plan their weekly training, track cancellations/reasons, and allows coaches to manage team schedules and feedback.

**Status:** In production (6 fighters + coaches using daily)  
**Approach:** Phased refactoring with zero production disruption + incremental feature delivery

---

## 🎯 Current Priorities (By User Story Status)

### TIER 1: Core Weekly Planning (This Session + Next)
These are the "doing" and "todo" items that unlock everything else.

1. **[DOING] Alle ugedage i bredden for teamet (All weekdays visible in team view)**
   - Issue: Horizontal overflow - can't see all days without scrolling
   - Impact: Team schedule view is hard to use
   - Acceptance: All 7 days visible at once, no horizontal scroll

2. **[DOING] Custom konfirmering af sendt feedback (Custom feedback confirmation)**
   - Issue: App turns ALL BLACK when entering feedback inbox
   - Impact: Can't use feedback feature (critical bug)
   - Acceptance: Custom popup instead of browser confirm

3. **[TODO] Splitte kode op i mindre filer (Split code into smaller files)**
   - Issue: 2,158 lines in single component = bugs spread, features break corners
   - Impact: BLOCKER for all other work
   - Acceptance: Max 1,200 lines/file, proper folder structure, TypeScript
   - **THIS IS THE HIGHEST PRIORITY ENABLER**

4. **[DONE - VERIFY] Automatisk opdatering af dato (Auto-update current date)**
   - Intended: App shows "Uge 6 (Aktuel)" with today's date auto-selected
   - Enhancement: Show current vs. next week differently in UI (behavioral distinction)

5. **[BACKLOG] Flow for ugeplan (Weekly planning submission/review workflow)**
   - Epic-level refactor: State machine for week approval process
   - States: fighter_editing → fighter_submitted → coach_reviewing → approved
   - Hero feature: Coach knows if fighters have looked at their week

### TIER 2: Admin & Backlog (Week 3+)
- Backlog list view as default
- Keyboard shortcuts to navigate between app ↔ backlog
- Admin interface for managing standard sessions (no code edits)

### TIER 3: Advanced (Month 2+)
- Activity calendar, goal tracking, user profiles, email notifications, etc.

---

## 🏗️ Architecture Decisions

### Why TypeScript?
- **Problem:** Single change breaks unrelated features ("corner A affects corner B")
- **Solution:** Type safety catches bugs at edit time, before runtime
- **Benefit:** Prevents the cascade failures you're experiencing now

### Phase 1 Refactor (This Session)
Extract & reorganize WITHOUT changing behavior:
```
src/
├── config/
│   ├── constants.ts       (DAYS, CATEGORIES, GLOBAL_TEMPLATES, USER_MAPPING)
│   └── firebase.ts        (Firebase config & init)
├── lib/
│   └── firebase.db.ts     (Firestore operations)
├── utils/
│   ├── dateUtils.ts       (getISOWeek, getDateForWeekDay, etc.)
│   ├── csvUtils.ts        (parseCSV, generateCSV)
│   └── deviceUtils.ts     (isMobileDevice, checkInAppBrowser, etc.)
├── hooks/
│   ├── useAuth.ts         (Authentication state)
│   ├── useScheduleData.ts (Fetch & manage schedule from Firestore)
│   └── useAdminBacklog.ts (Admin dashboard state)
├── types/
│   ├── common.ts          (User, Fighter, Session, etc.)
│   └── workflow.ts        (WeeklyPlanState enum for phase 2)
├── App.tsx                (Orchestration only, clear structure)
└── Components/
    ├── LoginScreen.tsx
    ├── PersonalSchedule.tsx
    ├── TeamSchedule.tsx
    ├── AdminDashboard.tsx
    └── Modals/
        ├── FeedbackModal.tsx
        ├── ConfirmModal.tsx
        └── SessionModal.tsx
```

**Why this matters:**
- Each file has ONE responsibility
- Bugs are isolated (change in `dateUtils` won't break modal logic)
- Easy to test, onboard new devs, add features
- TypeScript catches mistakes before they're deployed

---

## 📝 Collaboration Framework

### Division of Responsibility
- **Frodi (PO):** Requirements, design feedback, user priorities, business logic questions
- **Claude (Tech):** Architecture, implementation, code quality, bug fixes, UI/UX suggestions

### Code Ownership
- Claude owns all architecture decisions and implementation
- Frodi reviews and provides feedback async (doesn't need to understand code)
- Any tech decision can be questioned/refined in next session

### Chat Continuity (If Session Drops)
1. Copy this file into new session
2. Include the "Current Session Summary" section below
3. Say: "Continue from [date]. Here's the status: [paste summary]"
4. Chat will resume without losing progress

---

## 🔄 Session History

### Session 1: Codebase Audit & Planning (Feb 13, 2026)
**What We Did:**
- Analyzed full 2,158-line App.jsx
- Identified root cause: monolithic structure → cascading bugs
- Reviewed your backlog (45+ stories across 3 tiers)
- Clarified priorities: code splitting > feature addition right now

**Current Status:**
- On branch: `feature/bedre-design` ✅
- About to start: Phase 1 refactor (extract constants, utils, hooks, TypeScript)

**Next Session Should:**
- Validate Phase 1 refactor didn't break anything
- Fix the "feedback inbox turns app black" bug
- Implement the "all weekdays visible" layout fix
- Plan Phase 2: Component extraction + weekly planning workflow

---

### Session 2: Phase 1 Refactor - Foundation Complete (Feb 13, 2026)
**What We Completed:**
✅ **Folder Structure Created**
- `src/config/` - Constants and Firebase setup
- `src/utils/` - Date, CSV, and device utilities
- `src/types/` - TypeScript type definitions
- `src/hooks/` - Prepared for custom hooks
- `src/components/` - Prepared for component extraction

✅ **Constants Extracted**
- Moved DAYS, CATEGORIES, GLOBAL_TEMPLATES, USER_MAPPING to `src/config/constants.ts`
- Moved Firebase initialization to `src/config/firebase.ts`

✅ **Utilities Extracted & Typed**
- `dateUtils.ts` - 7 functions (getISOWeek, formatCancellationTime, etc.)
- `csvUtils.ts` - 3 functions (parseCSV, generateCSV, generateFeedbackCSV)
- `deviceUtils.ts` - 3 functions (checkInAppBrowser, isMobileDevice, getDeviceInfo)

✅ **TypeScript Support Added**
- `tsconfig.json` - Main TypeScript config with path aliases
- `tsconfig.node.json` - Build tools config
- Added TypeScript ^5.3.3 to devDependencies
- Created type definitions:
  - `types/common.ts` - User, Session, Feedback, Backlog types
  - `types/workflow.ts` - Weekly planning workflow states (ready for Phase 2)

✅ **Documentation Created**
- `PROJECT_NOTES.md` - This file (project charter)
- `REFACTORING_GUIDE.md` - How to use new structure

**Lines Extracted:**
- Constants: ~150 lines
- Utilities: ~400 lines
- Total: ~550 lines from monolithic App.jsx

**What's Next:**
1. Install new dependencies: `npm install`
2. Update App.jsx imports to use new paths
3. Rename App.jsx → App.tsx
4. Test that nothing broke
5. Phase 2: Extract modal components and create custom hooks

**Key Achievement:**
Foundation is solid. We can now gradually extract components without risk. Each utility is tested & isolated. Types prevent future bugs.

---



## 🐛 Known Issues to Address

| Issue | Severity | Root Cause | Fix in Phase |
|-------|----------|-----------|--------------|
| App turns black in feedback inbox | 🔴 High | Modal/overlay bug, hard to trace in monolith | Phase 1 + Phase 2 |
| Weekdays overflow in team view | 🔴 High | Responsive layout needs refactor | Phase 2 |
| Features break when corners change | 🔴 High | Monolithic state management | Phase 1 (TypeScript prevention) |
| Hard to find bugs | 🟠 Medium | No separation of concerns | Phase 1 |

---

## ✅ Completed Features (From Backlog)
These are stable and should remain unchanged during refactor:
- ✅ Login (Google OAuth)
- ✅ Create weekly plan (core)
- ✅ Handle cancellations (sick, injured, prevented)
- ✅ Mark rest days
- ✅ Team view with date selection
- ✅ Admin backlog dashboard
- ✅ CSV import/export
- ✅ Keyboard shortcuts
- ✅ Feedback system (feature works, just UI bug)

---

## 🚀 Technical Stack

**Current:**
- React 18.2
- Firebase (Auth + Firestore)
- Tailwind CSS
- Vite
- Playwright (E2E tests)

**Planned Additions:**
- TypeScript (this session)
- Custom hooks pattern
- Better module organization

---

## 📌 Decision Log

### Decision 1: TypeScript Adoption
- **Date:** Feb 13, 2026
- **Decision:** Adopt TypeScript from day 1 of refactor
- **Rationale:** Prevents "change corner A, break corner B" bugs you're experiencing
- **Alternative:** Stay in JS, refactor carefully
- **Chosen:** TypeScript (Frodi: "You're the technical boss")

### Decision 2: Refactoring Strategy
- **Decision:** Phase 1 (structure) → Phase 2 (components) → Phase 3 (state mgmt)
- **Rationale:** Low-risk incremental approach preserves production stability
- **Alternative:** Full rewrite (too risky, too slow)

### Decision 3: Weekly Planning Workflow
- **Decision:** Implement simplified flow first (current week vs. next week distinction)
- **Rationale:** Gives time to observe behavior before complex approval workflow
- **Design Doc:** See "Flow for ugeplan" in backlog (detailed in story notes)

---

## 📚 Resources & References

**Backlog (Source of Truth):** In Firebase (admin dashboard)  
**This Session's Chat:** [Will be bookmarkable after session ends]  
**App Repository:** `/workspaces/fightweek-app`

---

## 🎓 Notes for Future Dev

If someone else ever picks this up:
- The app is polished and works well for its 6 daily users
- Code is functional but monolithic (a common React pattern that scales poorly)
- Team is small + async (dev on one person's schedule)
- High trust environment (no complex approval processes for code)
- Production = live gym, so changes need testing

---

*End of Project Charter*
