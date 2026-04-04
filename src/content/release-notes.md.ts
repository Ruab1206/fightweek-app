// Release Notes content for FightWeek — latest release first
export const RELEASE_NOTES = `# Release Notes

> What's new in each release — told from the perspective of what you can now *do*, not what code changed.
> Releases follow the \`1.x — Outcome Name\` convention. See the Team Charter for how we plan releases using the story map.

---

## 1.4 — Class Catalog
*April 2026*

**Outcome:** Fighters can easily find training offers across gyms. Test users report it easy to find relevant classes both on mobile and desktop.

### What changed

**#1118 — Catalogue entity model & Firestore seed**
- Created \\\`CatalogueClass\\\` + \\\`ClassSchedule\\\` TypeScript interfaces (\\\`src/types/catalogue.ts\\\`)
- Built \\\`scripts/seed-catalogue.cjs\\\` — reads holdoversigt.html prototype, transforms to new model
- Seeded 48 classes across 7 gyms to Firestore

**#1119 — Public catalogue route**
- Installed \\\`react-router-dom\\\` — first routing in the app
- \\\`/catalogue\\\` → public CataloguePage (no auth), \\\`/*\\\` → existing App (auth-gated)
- Created \\\`useCatalogue\\\` hook — \\\`onSnapshot\\\` subscription to catalogue collection

**#830 — Cross-gym training schedule UI**
- Weekday column layout — 7 days side by side on desktop, stacked on mobile
- Classes grouped by day with only that day's time slots
- Compact session cards: discipline colour stripe, title (2-line clamp), time, gym + distance
- Dark/light theme toggle with Lucide Sun/Moon icons

**7 gyms registered with full schedules**
- Burnell MMA & BJJ (13 sessions), Fightworld (13), Rumble Sports, Arte Suave
- FighterZone.dk, Roskilde (8 sessions) — full schedule from FighterZone blogspot
- Big Rock Academy, Hillerød (9 sessions) — renamed from "Hillerød MMA"
- Roskilde Brydeklub (5 sessions) — same address as FighterZone
- All gyms with contact info (phone, email), address, lat/lng coordinates, and schedule URLs

**Smart search & filtering**
- Free-text search across title, discipline, gym, level, location, instructor, description
- Intelligent DA↔EN synonym map (brydning↔wrestling, boksning↔boxing, børn↔kids, begynder↔intro, etc.)
- Collapsible filter panel: discipline chips + gym chips (with distance labels)
- Active filter pills with individual remove + "Ryd alle" clear button
- Compact search row with filter toggle and active filter counter badge

**Distance-based filtering**
- Browser geolocation + haversine distance calculation
- Manual location picker with 7 preset areas (Roskilde, København, Frederiksberg, Valby, Søborg, Hillerød, NV/Nørrebro)
- Falls back to location picker if GPS fails (desktop IP geolocation is often inaccurate)
- Distance shown on cards when active ("Burnell MMA & BJJ · 8 km")
- Location label on "Nær mig" button ("Roskilde · 25 km")

**Mobile day scroll spy**
- Fixed right-edge navigation strip on mobile (hidden on desktop where all 7 columns are visible)
- 2-letter Danish day abbreviations (Ma, Ti, On, To, Fr, Lø, Sø)
- Active day highlighted via IntersectionObserver
- Scroll-to-top button (↑) at the top of the strip
- Smooth scroll on tap with scroll-margin for sticky header clearance

**Gym detail modal**
- Read-only detail view for all users — shows all session fields
- Clickable phone (tel:) and email (mailto:) links
- Google Maps link on gym address
- Gym schedule URL link
- Danish date formatting (dd.mm.yyyy HH:mm) — handles both Firestore Timestamps and ISO strings

**Firestore security rules**
- Catalogue + gyms: public read (\\\`allow read: if true\\\`)
- Backlog, feedback, story-map: admin-only (\\\`allow read, write: if isAdmin()\\\`)
- Deployed via Firebase Rules REST API (no CLI required)

**Design system & layout unification**
- Added App Header, Theme Toggle, Filter Chip, Badge, and public page patterns to design system
- Unified card style across all views (catalogue, personal schedule, team schedule)
- All three views now use the same 7-column weekday grid layout on desktop
- Full-width layout across all pages (removed max-width caps)

**Product discovery**
- Captured unified view vision for #917 (Add class to schedule): personal plan as a filtered view of the catalogue, supporting both catalogue-referenced and manual sessions

### Carry-forward
- **#1123** — Standardised level & age group dropdowns (data exists on sessions, UI filter deferred)

---

## 1.3 — Code Health
*April 2026*

**Outcome:** The codebase is production-grade — no ts-nocheck pragmas, zero TypeScript errors, clean component boundaries, dead code removed.

**Result:** Outcome achieved. We started with 5 planned items targeting 3 files. Mid-release we discovered 31 files still had ts-nocheck. We adapted the plan to reach the goal — removing all 31 pragmas, adding proper types across 60 source files, and landing at zero TypeScript errors.

### What changed

🧹 **Zero ts-nocheck pragmas** — Removed from all 31 files: App.tsx, BacklogPage, StoryMapPage, StoryMapBackbone, StoryMapSliceRow, TeamSchedule, SessionModal, InlineEdit, NavButton, Toast, ConfirmModal, BrowserBlockScreen, FeedbackModal, LoginScreen, MarkdownDocPage, 9 backlog sub-components (TabBar, ListView, BoardView, TaskModal, etc.), 6 hooks (useAuth, useToast, useScheduleData, useStoryMapDrag, etc.), and 2 services (firebaseBacklogService, dataSnapshotService). Every callback, state variable, and prop is now explicitly typed.

🗑️ **Dead code deleted** — AdminDashboard.tsx (954 lines), ShortcutModal.tsx, ImportModal.tsx removed. BacklogPage with extracted sub-components already replaced AdminDashboard.

🌗 **Dark/light mode everywhere** — Extended theme support to SessionModal, ConfirmModal, FeedbackModal, LoginScreen, BrowserBlockScreen, plus the existing fighter pages (App shell, PersonalSchedule, TeamSchedule, NavButton, Toast).

🔧 **Firebase type declarations fixed** — Created bridge declaration to re-export from @firebase/firestore (firebase 10.14.1 compatibility bug).

### Carry-forward

📋 **BacklogPage.tsx at 508 lines** — Was refactored once (9 sub-components extracted). Remaining code is orchestration logic. Carry to 1.4 as low-priority refactoring.

### Retro learnings
- **Added to DoD:** Verify Vite dev server after mechanical type edits (TypeScript and Babel see different things); search all callers when removing interface props
- **Added to agreements:** Stay within product boundary (don't edit other products' files without asking); update release notes incrementally, not just at review
- **Keep:** Systematic batching by complexity, outcome-over-output adaptation, bottom-up principle documentation
- **Bug fix:** TeamSchedule.tsx parse error — type annotation edit accidentally dropped a \`return (\` statement, causing Vite 500 error
- **Lesson:** When adapting mid-release, the backlog items become a historical record of what was *planned*, not what was *done*. Release notes must tell the true story.

---

## 1.2 — Ways of Working
*March–April 2026*

**Outcome:** The app documents its own team process and architecture — the admin area is a self-documenting workspace.

### What's new

📜 **Team Charter page** — Our agreements, ceremonies, quality gates, and ways of working (adopted from Toolbox)
🥊 **Fight Team Description** — Team-specific culture, principles, and roles (separate from generic WoW)
🏗️ **Architectural Blueprint** — Tech stack, data model, and architecture decisions
🗺️ **Story Map page** — Interactive Jeff Patton-style user story map with Firebase persistence
👤 **Personas page** — Interactive sketch personas (CRUD cards, not static markdown)
📋 **Release Notes page** — This page! Latest releases shown first.
🎨 **Design System page** — UI patterns and component standards
🏗️ **Entity Model page** — The data behind the app (what's live today)
🌐 **Domain Model page** — The conceptual big picture (what we're building toward)
📊 **Master Data page** — Organisation structure and configuration
🌗 **Theme toggle** — Light/dark mode with JPD/Atlassian design tokens for admin pages
🎨 **Theme-aware modals** — TaskModal, SearchableDropdown, and all sub-components respect the theme
🔥 **Firestore-first persistence** — Story map and all data now uses Firestore as sole source of truth (no localStorage)
👤 **Persona consolidation** — Single source of truth in Firestore (11 personas, 3 enriched with rich content)
🤖 **AI data access tooling** — Service account JWT auth, CLI read/write scripts for sustainable AI agent access
🏷️ **Backlog hygiene** — 56 items retagged from old release names to 1.x convention

### Retro learnings
- **Added to DoD:** File size check (no file >400 lines without refactoring item) and design system update gate
- **Added to agreements:** "Spike before invest" for infrastructure work; stricter "backlog item before coding" enforcement
- **Keep:** Firestore-only persistence, script-based AI data access, documentation-as-code, 1.x naming convention
- **Bug fix:** AI admin scripts wrote data with wrong field names and Firestore Timestamps — added toISOString() coercion in ensureItemDefaults and fixed 14 malformed items
- **Lesson:** Scripts that bypass the app must match its schema exactly. Firestore Timestamp vs string is a silent killer — always coerce at the boundary.

---

## 1.1 — Admin & Backlog
*February 2026*

**Outcome:** The admin (Rune) can manage the product backlog inside the app — no external tools needed.

### What shipped

📋 **Backlog page (admin 'b' shortcut)**
Full-screen backlog with list view, board view (kanban), and feedback management. Real-time Firestore sync. Keyboard-driven workflow (j/k navigate, o open, f forward status, etc.)

🎯 **Task modal**
Create/edit backlog items with title, description, status, tags, release assignment, and acceptance criteria.

📦 **Release management**
Assign releases to items. Release picker modal. Items must have a release before moving to "done".

💬 **Feedback → Backlog conversion**
Admin can convert user feedback directly into backlog items.

🔀 **Drag & drop reorder**
Reorder items by dragging in list view. Multi-select with shift/ctrl. Batch operations.

📂 **Collapsible sidebar**
Desktop sidebar with navigation items. Toggle with 'm' key. Persisted to localStorage.

---

## 1.0 — Core App
*December 2025 – February 2026*

**Outcome:** Fighters can plan and see their training week — the core loop is live and in fighters' hands.

### What shipped

📱 **Weekly schedule view**
Fighters see their week at a glance — sessions by day with category colour coding, time, and location. Tap to edit. Swipe between weeks.

�️ **Rest day management**
Toggle rest days per day. If sessions exist, confirm cancellation first. Rest days are visually distinct (dimmed card).

� **Standard week template**
Each fighter has a "grundplan" (base template). Edit it once, import it to any week. One-tap "Hent Standard" pulls the template in.

� **Team view**
Read-only view of teammates' schedules. See who's training what, when.

🔐 **Authentication**
Firebase Auth with manual login method selection (Popup vs Redirect) to handle cross-site tracking issues in mobile browsers. In-app browser detection forces users to Safari/Chrome.

📊 **Session modal**
Full CRUD for training sessions — name, category, time, location, notes. Cancel with reason tracking.

💬 **Feedback system**
Context-aware feedback button on every screen. Submissions go to Firestore for admin review.
`;
