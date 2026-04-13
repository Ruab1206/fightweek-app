// Release Notes content for FightWeek — latest release first
export const RELEASE_NOTES = `# Release Notes

> What's new in each release — told from the perspective of what you can now *do*, not what code changed.
> Releases follow the \`1.x — Outcome Name\` convention. See the Team Charter for how we plan releases using the story map.

---
## 1.7 — Events
*April 2026*

**Outcome:** The team can discover, sign up for, and track upcoming events — tournaments, seminars, and social gatherings — all within FightWeek.

### What changed

**Event entity model and Firestore collection (#1151)**
- \\\`FightweekEvent\\\` type with full field set: title, type, discipline, date/endDate, times, location, address, lat/lng, contact info, registration deadline, signups
- \\\`useEvents\\\` hook with live Firestore \\\`onSnapshot\\\` subscription
- 16+ real events seeded (MMA Galla Vol. 31, Danish Open 2026, seminars, etc.)

**Event list view (#1152)**
- Events page accessible from the left drawer menu
- Upcoming events shown chronologically with card layout
- Past events hidden by default — toggle "Vis tidligere" in search mode
- Event type shown as colour-coded badge (stævne, seminar, social, andet)
- Team participation visible — who has signed up / is interested
- Filter bar in search mode: discipline, distance (GPS + haversine), participants
- Dark/light theme support throughout

**Event detail view and sign-up (#1153)**
- Full detail view shows all event fields including contact info (mailto/tel links)
- Three-state sign-up: Interesseret / Tilmeldt / Ikke interesseret
- Team members' status visible on each event
- Google Maps link on address
- External URL link for registration page
- Registration deadline shown with red warning when ≤ 3 days away

**Events in schedule view (#1154)**
- Signed-up events appear on the correct day(s) in the personal schedule as virtual sessions
- Event cards are visually distinct from training sessions (indigo highlight + "EVENT" badge)
- Multi-day events show on each day within the range
- Events visible in team view for all signed-up fighters
- Click event-session in calendar to navigate directly to event detail

**Maintain events (#1148)**
- Admin CRUD: create, edit, delete events via EventForm
- Geocoding via OpenStreetMap Nominatim for lat/lng from address
- All event fields editable including contact name, email, phone

**Extract inline components from App.tsx (#1150)**
- Session handlers extracted to \\\`useSessionHandlers\\\` hook
- Search overlay extracted to \\\`SearchOverlay\\\` component
- Catalogue filter logic extracted to \\\`useCatalogueFilter\\\` hook
- Month picker extracted to \\\`MonthPicker\\\` component
- EventsPage extracted: event list, detail, form, and filters moved to \\\`EventsPage.tsx\\\` (942 \u2192 454 lines)
- Event merge logic extracted to \\\`useEventMerge\\\` hook
- Scroll/month-picker logic extracted to \\\`useScrollController\\\` hook
- Event form and detail extracted to \\\`EventForm\\\` and \\\`EventDetail\\\` components
- Shared event helpers moved to \\\`eventHelpers.tsx\\\`
- App.tsx reduced from 1,126 \u2192 608 lines across two refactoring passes

### Bug fixes
- Fixed calendar showing March instead of today when returning from events view
- Fixed scroll alignment with header (scrollMarginTop on event cards)
- Fixed return-to-viewed-event scroll position after closing detail view
- Fixed filters not resetting when closing search mode
- Fixed double vertical scroll on Events page (nested overflow containers)
- Fixed garbled search placeholder encoding (UTF-8 mojibake)
- Fixed month picker not navigating to far-future dates (ISO week wrap-around across year boundaries)
- Fixed FAB (+) button not using the currently visible date when adding training/frav\u00e6r- Fixed delete dialog showing "Slet denne og følgende" for non-recurring sessions
- Fixed calendar jumping back to today when scrolling into the future
- Fixed duplicate events appearing on the same day (virtual event sessions leaking into Firestore saves)
- Fixed events not appearing in Karl's calendar after signup (Firestore listener dying before auth resolved)
- Fixed calendar not scrolling to today on login (progressive DOM height changes from 15 independent Firestore listeners)

### Robustness improvements
- \\\`useEvents\\\` now waits for Firebase auth before subscribing — prevents permission-denied errors and dead listeners
- \\\`useEvents\\\` auto-retries with 2 s delay if the Firestore listener is terminated by a transient error
- Scroll-to-today re-fires during a 3 s settling window while week data loads progressively
- \\\`cloneWithoutEvents()\\\` exported and applied to all remaining save paths (desktop catalogue add, onDeleteThisAndFuture)
- All 8+ Firestore save paths now strip virtual event sessions before persisting
### Carry-forward
- **#1128** — Open class details (tap a catalogue class to see full info)
- **#1129** — Add class from catalog (inline add flow from schedule)
- **#1136** — Mark recurring catalogue classes in catalogue view
- **#1137** — Search mode (header-driven, distinct from browse)
- **#1138** — Change program for recurring training sessions
- **#1145** — Header month picker

### Retro learnings
- **Keep:** Extraction-first approach — pulling hooks out of App.tsx (useSessionHandlers, useScrollController, useEventMerge, useCatalogueFilter) before building new features kept the events work clean. App.tsx went from 1,126 → 608 lines.
- **Keep:** Event merge as virtual sessions — designing events as render-time virtual sessions (not persisted per-fighter) was the right architectural call. No per-fighter data duplication, no sync issues.
- **Keep:** Documentation-as-code — having entity model, domain model, and design system inside the app caught real issues during release review (wrong signup status values, missing entity section, stale catalogue path).
- **Keep:** Seeding scripts — the \\\`firestore-admin.cjs\\\` pattern made it easy to populate events and backlog stories without manual Firestore console work.
- **Lesson:** Auth-race conditions are silent killers. \\\`useEvents\\\` subscribed before auth resolved, killing the Firestore listener permanently. All hooks reading auth-protected collections must gate on \\\`onAuthStateChanged\\\`. (Added to DoD #14)
- **Lesson:** Virtual-session leaking was hard to diagnose. \\\`cloneWithoutEvents\\\` needed to be applied at 8+ separate save paths — each new save path is a potential leak. Centralize into a single save wrapper (backlogged as #1160).
- **Lesson:** When static code analysis says "should work", add a console.log and check the actual runtime data before spending time on exhaustive code tracing. (Added to agreements)
- **Lesson:** Progressive Firestore loading (15 independent \\\`onSnapshot\\\` listeners) shifts DOM heights unpredictably. Scroll-to-today needs a settling window, not a one-shot call.

---
## 1.6 — Easier Class Scheduling
*April 2026*

**Outcome:** Fighters get a cleaner, simpler weekly view — focused on what matters. Program and rest-day features removed in favour of a streamlined personal schedule. Fravær (absence) tracking added with multi-day calendar picker.

### What changed

**Continuous day scroll (#1133)**
- Replaced week-by-week navigation with a continuous vertical scroll on mobile
- Days flow naturally across week boundaries — no more tapping week arrows
- Sticky date rail on the left with day abbreviation and date number
- Week divider labels appear automatically between Søndag and Mandag
- Multi-week data loaded in a rolling window (current ± 4 weeks) with auto-expansion on scroll

**Today button (#1146)**
- Calendar icon in the header with today's date number
- Tap to jump directly to today's row — exits search mode if active
- Visual anchor so you always know where "now" is

**Fravær (absence) tracking**
- New "Fravær" add type in the AddScreen with MonthCalendarPicker for date range selection
- Yellow absence cards appear on each day within the range, showing title, description, and day count
- Clickable cards open the edit view — update title, description, dates, or delete
- Multi-day absences show "dag X/Y" labels and time bounds (start on first day, end on last)
- Data stored as individual session entries per day with shared \\\`fraværGroupId\\\`

**Program & Hvile removal (code cleanup)**
- Removed "Program" (Standarduge) from the left menu and all code paths
- Removed \\\`isStandardMode\\\` state, \\\`useStandardTemplate\\\` hook, and \\\`programKeys\\\` tracking
- Removed rest-day (Hvile) toggle button and HVILE badge from the desktop schedule
- Removed \\\`handleToggleRestDay\\\` function and Bed icon import
- Simplified view type from \\\`'personal' | 'program' | 'team'\\\` to \\\`'personal' | 'team'\\\`
- Auto-feed from template preserved — new weeks still seed from the standard template in Firestore
- Legacy \\\`isRestDay\\\` data filters kept to safely ignore old rest-day markers in existing data

**User menu replaces footer nav (#1147)**
- Drawer menu with fighter avatar, name, and team role
- Settings, theme toggle, and logout moved into the drawer
- Cleaner mobile footer with just the FAB

**Encoding fix**
- Fixed 24 mojibake sequences in source files caused by PowerShell \\\`Set-Content\\\` encoding corruption (e.g. â€" → —, Â· → ·)
- Added \\\`.gitattributes\\\` to enforce UTF-8 with LF line endings for all source files

**Refactoring**
- Merged \\\`handleFravær\\\` and \\\`handleEditFravær\\\` into a single function
- Replaced \\\`JSON.parse(JSON.stringify())\\\` with \\\`structuredClone()\\\`
- Replaced inline ISO week calculations with \\\`getISOWeekForDate()\\\` utility
- Deduplicated constants (\\\`DAY_NAMES\\\`, \\\`RECURRENCE_OPTIONS\\\`, \\\`googleMapsUrl\\\`) into constants.ts
- Updated type definitions in common.ts (\\\`DayName\\\`, \\\`FraværSession\\\`, \\\`SessionEntry\\\`, \\\`WeekSchedule\\\`)
- Removed dead imports and fixed duplicate props in MobileScrollView

### Bug fixes
- Fixed date off-by-one error in Fravær date range calculation
- Fixed same-week overwrite bug when editing Fravær across week boundaries
- Fixed edit race condition where old data could briefly flash before update
- Fixed duplicate Fravær cards appearing after rapid edits
- Fixed click handler scope issue on Fravær cards in mobile scroll view

### Carry-forward
- **#1128** — Open class details (tap a catalogue class to see full info in the schedule context)
- **#1129** — Add class from catalog (inline add flow from the schedule view)
- **#1136** — Mark recurring catalogue classes in catalogue view
- **#1137** — Search mode (header-driven, distinct from browse)
- **#1138** — Change program for recurring training sessions
- **#1145** — Header month picker

### Retro learnings
- **Keep:** Removing dead features early — Program and Hvile were adding complexity for no user value. Clean removal is better than carrying dead code.
- **Keep:** Encoding vigilance — PowerShell \\\`Set-Content\\\` silently re-encodes UTF-8 files. Use Node.js scripts for file mutations, and \\\`.gitattributes\\\` as a safety net.
- **Keep:** Legacy data filters — when removing a feature from UI, keep server-side/data-layer guards so old documents don't cause runtime errors.
- **Added to DoD:** After any bulk refactoring, run \\\`npx vite build\\\` before committing — TypeScript and Vite can disagree on what compiles.
- **Lesson:** God components (App.tsx at 1700+ lines) make feature removal painful. Each removal touches dozens of locations in the same file. This is the strongest signal yet that we need to extract PersonalSchedule, MobileScrollView, and SessionDetailSheet into separate component files.
- **Lesson:** \\\`structuredClone()\\\` is a drop-in replacement for \\\`JSON.parse(JSON.stringify())\\\` in all modern browsers — simpler, faster, and handles more edge cases.

---

## 1.5 — Build Your Program
*April 2026*

**Outcome:** Fighters can build their weekly training program from the catalogue — replacing hardcoded templates with real, up-to-date class data.

### What changed

**#917 — Add class to program**
- Fighters can add any catalogue class to their personal weekly schedule
- Two entry points: tap [+] on a day to see catalogue classes for that day, or browse the desktop week catalogue overlay
- Session cards show discipline colour, time, gym, and "recurring" badge for template sessions

**#1124 — Add custom class**
- Manual session creation alongside catalogue-based adds
- Fighters can type in a custom name, pick category, set time and location

**#1126 — Add catalogue class to program**
- Replaced \\\`GLOBAL_TEMPLATES\\\` (hardcoded session presets) with live catalogue data
- Slide-up panel shows filtered catalogue classes matching the selected day's gym schedules
- Desktop shows a collapsible weekly catalogue overlay alongside the schedule

**#1125 — CataloguePage refactor**
- Extracted filter bar, scroll spy, and distance logic into focused modules
- CataloguePage reduced from ~550 lines by splitting concerns

### Retro learnings
- **Keep:** Catalogue-first approach — building on the 1.4 catalogue data made "add to schedule" a natural next step
- **Lesson:** The old \\\`GLOBAL_TEMPLATES\\\` constant was a shortcut that became tech debt. Replacing it with live Firestore data was the right move — no more stale session presets.

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
