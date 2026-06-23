// Team Charter — adopted from the Toolbox's ways of working
export const TEAM_CHARTER = `# Team Charter

> How we work together — our agreements, ceremonies, quality gates, and the things that might slow us down.

---

## Who We Are

The development team is a **PO + AI Agent pair**. The Product Owner drives what gets built and validates every change in the browser. The AI Agent implements features, manages the backlog data, and follows the team's process agreements. Together they work in a continuous flow, using releases (scope-driven) instead of sprints (time-driven).

| Role | Responsibility |
|------|---------------|
| **Product Owner** | Vision, prioritisation, validation, feedback proxy |
| **AI Agent** | Architecture, implementation, code quality, documentation, outcome coaching |

> **Coaching agreement:** The AI Agent actively coaches the PO on keeping releases outcome-focused. When a release goal drifts toward feature lists ("build X, Y, Z"), the Agent should ask: *"What user behaviour change are we trying to achieve?"* and help reframe toward outcomes.

---

## Our Ceremonies

We follow a release-based cadence. Every release goes through four phases:

| Our ceremony | Scrum equivalent | When it happens |
|---|---|---|
| **Release Planning** | Sprint Planning | Before each release starts |
| **Implementation** | The Sprint | Continuous during the release |
| **Release Review** | Sprint Review | After the release ships |
| **Release Retrospective** | Sprint Retrospective | After the review |
| **Conversation start** | Daily Standup | At the beginning of each working session |

### What happens in each ceremony

**Release Planning**
- Re-read project documentation for context
- **Consult the target architecture** — Before selecting items, review the Target Architecture document. Ask: *"Does this slice align with the architectural direction? Will we need to rework this later?"* This prevents incremental drift — locally sensible decisions that create global structural problems. (Added after 1.7 retro)
- **Walk the story map** — Before selecting items, walk the backbone left-to-right (Jeff Patton method). For each Activity, ask: *"What's the next thin slice of value we can deliver here?"* Look at the vertical priority under each User Task. The goal is to find the thinnest horizontal slice that delivers end-to-end value — a *walking skeleton*, not a finished feature.
- **Name the release slice** — Every release gets a number and an outcome-based name using the format \`1.x — Name\`. The name should describe the outcome, not the features (e.g. "1.3 — Catalogue" means *"coaches can manage training offerings without code changes"*, not *"build CRUD for sources and catalogue items"*).
- **Define success metrics** — For each release, answer: *"What would we measure to determine this was successful?"* This could be a user behaviour change, a workflow that's now possible, or a pain point that's removed.
- Review the backlog and refine selected items against the release goal
- Assess whether refactoring should be included or deferred

**Implementation**
- Move items from Ready to Doing before starting work
- Work items in priority order
- Follow DoR/DoD per item

**Release Review**
- **Assess the outcome first** — Did we achieve the release goal? The review focuses on the outcome, not on whether every planned story was completed. Stories are a means to an end.
- If the outcome was achieved through different work than originally planned, that's a success — we adapted.
- If the outcome was not achieved, discuss: was the goal too ambitious, did we learn something that changed the landscape, or did we get sidetracked?
- Demo to stakeholders, collect feedback
- Review the backlog — reprioritise, clean up stale items, check release tags
- Design system review — verify UI changes adhere to the design system
- **Write the release notes** — Capture what shipped, in "what you can now *do*" language, in the Release Notes page. Release notes describe the *outcome* and belong to the review; the retrospective later appends its process learnings to the same entry. (Clarified after 1.12 review)
- **Target architecture review** — Did we move toward or away from the north star? Did we learn something that changes the target? Update the Target Architecture document if understanding evolved. (Added after 1.7 retro)
- **Important:** don't code during review — thinking is fine, but build decisions belong in planning

**Release Retrospective**
- What went well / what to improve
- Update DoR, DoD, and team agreements
- Evaluate AI collaboration
- Update documentation with learnings and process changes

**Conversation start (Daily Standup)**
- Runs at the beginning of every working session, in a fresh context window.
- **Re-read context** — the AI reads the roadmap and any session handoff note before doing anything else, so it knows where we left off.
- **Summarise the standup three** — what shipped last, the current release/backlog state, and what's next.
- **Surface blockers** — call out anything pending PO verification, deferred, or at risk.
- **Confirm this session's goal** — agree what we're doing before any work starts. For a planning session specifically, read the handoff brief and walk the story map (per the "Start ceremonies in a fresh session" agreement).

---

## Release Naming Convention

We use **semantic versioning lite** with an outcome name:

\`\`\`
1.x — Outcome Name
\`\`\`

| Part | Meaning |
|------|---------|
| **Major (1)** | Bumps only for breaking data migrations or major rearchitecture |
| **Minor (x)** | Increments with each release — a coherent slice of user value |
| **Name** | The target outcome, not a feature list |

### Release history

| Release | Outcome | Period |
|---------|---------|--------|
| 1.0 — Core App | Fighters can plan and see their training week | Dec 2025 – Feb 2026 |
| 1.1 — Admin & Backlog | Admin can manage the product backlog inside the app | Feb 2026 |
| 1.2 — Ways of Working | The app documents its own team process and architecture | Mar 2026 |
| 1.3 — Code Health | Codebase is production-grade — zero ts-nocheck, zero TS errors | Apr 2026 |
| 1.4 — Class Catalog | Fighters can easily find training offers across gyms | Apr 2026 |
| 1.5 — Build Your Program | Fighters can build their own weekly program from the catalogue | Apr 2026 |
| 1.6 — Easier Class Scheduling | One-tap catalogue add, recurring sessions, fravær management | Apr 2026 |
| 1.7 — Events | Team can discover, sign up for, and track events like tournaments and seminars | Apr 2026 |
| 1.8 — Robustness | Code quality, test coverage, centralized save logic, iOS scroll fixes, recurring session management | Apr 2026 |
| 1.9 — Roles & Security | Dynamic role management from Firestore, security rules without code deploy, admin UI for team members | Apr 2026 |
| 1.10 — Stabilisation | The weekly schedule is trustworthy — recurring sessions, past-week edits, and notes behave predictably; recurring-session corruption fixed at the root | Jun 2026 |
| 1.11 — Resilience | The app survives mistakes (error boundary) and gains a rename-proof, email-keyed data foundation for public profiles | Jun 2026 |

---

## The Story Map

We use a **Jeff Patton-style user story map** as the primary tool for shared understanding and release planning. The story map lives inside the app (admin area → Story Map).

### How the story map works

\`\`\`
  Activities (backbone)        ←  left-to-right = user journey
       │
  User Tasks (under each)     ←  the things users do within each activity
       │
  Release Slices (horizontal)  ←  each slice = a release = a walking skeleton
       │
  Backlog Items (mapped in)    ←  concrete work, placed in a slice under a task
\`\`\`

### Key principles (from Patton)

1. **The backbone stays fixed** — Activities represent the user's journey. You don't prioritise them against each other. They just *are*.
2. **Prioritise vertically** — Under each User Task, stories near the top are essential; further down is nice-to-have.
3. **Slice horizontally for releases** — A line drawn across the map creates a release. Each slice is the **thinnest possible end-to-end delivery** — a walking skeleton.
4. **Name every slice** — Each release slice gets an outcome name and success metrics, not just a bag of stories.
5. **Walk the map regularly** — At every release planning, walk the backbone left-to-right to spot gaps, check priorities, and find the next thin slice.
6. **The map is alive** — Update it as understanding grows. Add new Activities when the domain expands. Move stories between slices as priorities shift.

### How we use it in practice

| When | What we do with the map |
|------|------------------------|
| **Release Planning** | Walk the backbone, identify the next slice, name it with an outcome |
| **During implementation** | Items move through the backlog (Ready → Doing → Done) while staying pinned to their map position |
| **Release Review** | Mark completed stories on the map. Step back and look at the big picture — what's filled in, what's still thin? |
| **Domain discovery** | When we learn something new about the domain, check if Activities or User Tasks need updating |

---

## Quality Gates

### ✅ Definition of Ready (DoR)

Before starting any backlog item:

1. **Confirm understanding** — Restate the goal and acceptance criteria. **Wait for PO's explicit written "go" before writing any code.**
2. **Discuss open questions** — Notes, questions, and topics on the item have been read and discussed.
3. **Identify affected files** — List which files, services, and data stores will be touched.
4. **Flag risks** — Call out anything that could go wrong (data loss, breaking changes, scope creep).
5. **Explicit CRUD scope** — For items involving entities, AC must state which operations are in scope.
6. **Include "How to verify"** — Every item includes a short verification checklist, written before "go".

### ✅ Definition of Done (DoD)

A backlog item is done when:

1. **Implementation complete** — The feature works as described.
2. **Tested on mobile + desktop** — Responsive design verified.
3. **Tested in browser** — The PO has verified the feature works as intended.
4. **Feedback loop built in** — Users can give feedback directly on the functionality.
5. **Data persisted correctly** — No hardcoded workarounds, proper database writes.
6. **Documentation updated** — Relevant docs and changelogs are current.
7. **Design system checked** — New/changed UI patterns are reflected in the design system.
8. **Poka-Yoke applied** — If a user *can* do something wrong, it's a design flaw.
9. **Release assigned** — The item's release field is set.
10. **File size checked** — No file over 400 lines without a documented reason or a refactoring item in the backlog.
11. **Design system updated** — If new UI patterns are introduced, the design system page is updated.
12. **Dev server verified after mechanical edits** — After batch type-annotation changes or pragma removals, check the Vite dev server terminal for parse errors. TypeScript and Babel/esbuild see different things — a file can pass \`tsc\` but crash at serve time. (Retro 1.3 A1)
13. **Search all callers when removing props** — When a child component's Props interface drops a member, grep for all usages of that prop name in the codebase before considering it done. (Retro 1.3 A4)
14. **Auth-gate all Firestore hooks** — Any hook using \`onSnapshot\` on auth-protected collections must wait for \`onAuthStateChanged\` before subscribing, and auto-retry on transient errors. Subscribing before auth resolves kills the listener permanently. (Retro 1.7)
15. **Verify event-session stripping on new save paths** — When adding a new code path that writes week data to Firestore, verify it uses the centralized save wrapper or \`cloneWithoutEvents()\` to prevent virtual event sessions from leaking into persisted data. (Retro 1.7)
16. **Stabilise object/callback references passed to hooks** — When passing an object, array, or callback into a hook's dependency array (or into a hook that subscribes on it), give it a stable reference with \`useRef\`/\`useMemo\`/\`useCallback\`. A fresh reference every render re-runs the effect — this caused the \`activeFighter\` reset (\`useAuth\` re-subscribed on a new \`externalMapping\` object) and stale \`teamData\` from un-pruned removed members. Also prune stale keys from accumulated state when the source list changes. (Retro 1.11)
17. **Destructive changes use expand → migrate → contract** — Never delete or overwrite data in the same step that introduces the new shape. First *expand* (add the new path/field and rules that accept both old and new), *migrate* (copy data, ship code that reads/writes the new shape), and only then *contract* (remove the old data/rules) — as a **separate backlog item, deferred until the new shape has soaked in production**. The #1191 email-path migration followed this; the contract step is tracked separately as #1193/#1194. (Retro 1.11)

---

## Team Agreements

### Process agreements

| Agreement | Why |
|-----------|-----|
| **PO "go" before coding** | AI waits for explicit written go from PO before implementing |
| **Follow ceremony order** | Retrospective → Planning → then items one by one. No skipping ahead. |
| **Don't code during review/retro** | Thinking de-tours are fine, but build decisions belong in planning |
| **Outcome-based release goals** | Each release gets an outcome-based goal used to scope work |
| **Outcome over output** | A release is judged by whether the outcome was achieved, not whether every planned story was completed. If we discover mid-release that different work is needed to reach the goal, we adapt. We only descope the goal itself if the remaining work is disproportionate. |
| **AI coaches on outcomes** | When the PO drifts toward feature-lists, the AI reframes toward user behaviour changes |
| **Flag scope growth** | When scope grows mid-item, flag it explicitly — add to AC or new item? |
| **Items must pass through Ready** | Every item goes Backlog → Ready → Doing → Done. No skipping. |
| **Pull from backlog before coding** | All items must exist in the backlog before implementation starts. AI must prompt PO to create/confirm the item before writing any code — even for "quick" tasks. |
| **Spike before invest** | For infrastructure work (MCP, new auth patterns, new integrations), create a spike item first. Only build the full solution after the spike confirms feasibility. |
| **Stay within product boundary** | Only edit files in the active product's directory. If a change is needed in another product, flag it and let the PO decide. (Retro 1.3 A2) |
| **Update release notes incrementally** | When completing a significant chunk of work (e.g. a batch of files), update the release notes then — not just at review time. (Retro 1.3 A3) |
| **Diagnostic logging before deep static analysis** | When a bug's code logic "looks correct" through static tracing, add a console.log to see actual runtime values before spending more time on exhaustive code analysis. (Retro 1.7) |
| **Look past the loaded window** | For any feature that spans past/future data, ask whether the logic must walk a real horizon or only the data currently scrolled into memory. The recurring-session and delete-future bugs (#1183) were loaded-window artefacts mistaken for logic errors — operations stopped at the scroll-window edge, not at the intended boundary. (Retro 1.10) |
| **Start ceremonies in a fresh session** | Release Planning (and other heavy ceremonies) start in a new chat session with a clean context window — re-read the docs and walk the story map fresh, rather than carrying implementation detail from the previous release's build session. (Retro 1.11) |

### Design principles

| Principle | Description |
|-----------|-------------|
| **Poka-Yoke** | If a user can make a mistake, it's our design flaw — remove the possibility |
| **Outcome Focus** | We don't build features for features' sake — we solve problems |
| **Mobile-first** | Fighters use phones. Desktop is secondary. |
| **AI proactive on UI/UX** | AI proposes layout and interaction choices during DoR, not after building |
| **400-line check** | After any edit pushing a file past 400 lines, propose extraction |
| **URL/state strategy at DoR** | Items involving URL params must include a state management strategy |
| **Design system discipline** | Build → Extract → Document → Reference. Bottom-up from working code. |

---

## Potential Impediments

| Impediment | Impact | Status |
|-----------|--------|--------|
| **Firebase quota limits** | Could throttle real-time sync under heavy use | Monitoring |
| **In-app browser incompatibility** | Must detect and block Messenger/Instagram browsers | Solved with browser check |
| **Mobile auth cross-site tracking** | Popup vs Redirect login method selection needed | Solved with manual chooser |
| **Single-developer bottleneck** | AI agent is the only implementer | Accepted — pair model works |

---

## Refactoring Discipline

Refactoring is assessed at **every release review**:

1. Count items completed since last refactoring assessment
2. Quick scan: files over 400 lines, any-types, service patterns
3. Decide: refactor now, create a deferred item, or move on

### What we look for
- Component size > 400 lines → extract sub-components
- Duplicated type definitions or utilities
- Service layer violations (pages calling APIs directly)
- Dead code — unused imports, unreachable branches
- Design system adherence — shared patterns used consistently

---

## How We Communicate

| Channel | Purpose |
|---------|---------|
| **Dev conversation** | All planning, implementation, review, and retro |
| **Story Map (in-app)** | Big picture — activities, user tasks, release slices, shared understanding |
| **Backlog (in-app)** | Source of truth for what's planned, in progress, and done |
| **Team Charter** | Team agreements and ways of working (this document) |
| **Domain Model** | Shared language — every concept, how they connect, and why |
| **Release Notes** | What shipped, told for users |
| **Feedback modal** | In-app feedback from users |

---

## AI Agent Data Access

The AI Agent has direct read/write access to the Firestore production database via a service account. This enables live collaboration on planning, backlog management, and data quality checks — without manual export steps.

### How it works

| Component | Purpose |
|-----------|---------|
| \`serviceAccountKey.json\` | Firebase service account key (local only, never committed to version control) |
| \`scripts/firestore-admin.cjs\` | Zero-dependency Firestore client (JWT → OAuth2 → REST API, works on Node 16) |
| \`scripts/read-all-data.cjs\` | Bulk reader — dumps story map, backlog, feedback, and fighter data to \`data/\` |
| \`scripts/write-firestore.cjs\` | CLI for read/write/update/delete operations on any Firestore document |
| \`scripts/mcp-firestore-server.cjs\` | MCP server (ready for when corporate policy allows MCP in VS Code) |

### Firestore paths

| Path | Contains | Access |
|------|----------|--------|
| \`artifacts/production/public/data/story-map/main\` | Story map (activities, tasks, slices, personas) | Team read, admin/coach write |
| \`artifacts/production/public/data/backlog/{id}\` | Backlog items | Team read, admin/coach write |
| \`artifacts/production/public/data/feedback/{id}\` | User feedback | Team read, admin/coach write |
| \`artifacts/production/users/{Name}/weeks/week_{N}\` | Fighter weekly schedule | Team read, fighter+admin write |
| \`artifacts/production/users/{Name}/templates/standard\` | Fighter standard week template | Team read, fighter+admin write |

### Persistence model

**Firestore is the single source of truth for all user data.** No localStorage, no offline caching — every data store works the same way.

| Data | Store | Notes |
|------|-------|-------|
| Story map | Firestore (\`story-map/main\`) | Single document containing activities, tasks, slices, and personas |
| Backlog | Firestore (\`backlog/{id}\`) | Individual docs per item |
| Feedback | Firestore (\`feedback/{id}\`) | Individual docs per feedback entry |
| Fighter schedules | Firestore (\`users/{Name}/weeks/week_{N}\`) | Per-fighter, per-week documents |
| Content docs (charter, domain model, etc.) | Source code (\`src/content/*.md.ts\`) | Updated via code changes, rendered in-app |

### Security

- The service account key bypasses Firestore security rules (admin-level access)
- The key file is in \`.gitignore\` and must never be committed
- Firestore security rules still protect browser-based access (team member whitelist, role-based writes)
- See \`firestore.rules\` for the deployed rule set

---

## Deployment

The FightWeek app is deployed via **Vercel**, connected to the GitHub repo \`Ruab1206/fightweek-app\`. Vercel auto-deploys every branch push.

| Environment | Branch | URL | Trigger |
|-------------|--------|-----|---------|
| **Test** | \`feature/bedre-design\` | \`fightweek-app-git-feature-bedre-design-*.vercel.app\` | Push to test branch |
| **Production** | \`main\` | \`fightweek-app.vercel.app\` | Push to main (after test verification) |

### Workflow: test → verify → production

**1. Work on the \`test\` branch (day-to-day development)**

\`\`\`bash
cd fightweek-app
git checkout test            # local branch tracking origin/feature/bedre-design
git add -A
git commit -m "Description of changes"
git push                     # pushes to test environment
\`\`\`

**2. Verify on the test URL** — open the Vercel preview link and confirm everything works.

**3. Promote to production (after PO go)**

\`\`\`bash
git checkout main
git merge test
git push origin main         # deploys to production
git checkout test            # switch back to dev branch
\`\`\`

### Prerequisites

| Requirement | Details |
|-------------|----------|
| **Git credentials** | The Windows Credential Manager must have a token for a GitHub account with push access to the repo |
| **Collaborator access** | The \`seniorelduderino\` (DSB) account has been added as a collaborator on the personal \`Ruab1206/fightweek-app\` repo |
| **Branches** | \`test\` (local) → tracks \`origin/feature/bedre-design\` (test). \`main\` → tracks \`origin/main\` (production). |

### Troubleshooting

- **403 Permission denied on push** — The cached Git credential doesn't have write access. Check GitHub → Settings → Collaborators.
- **Build fails on Vercel** — Check the Vercel dashboard for build logs. Common issue: missing dependencies in \`package.json\`.
- **vercel.json** — Removed in 1.8; Vercel auto-detects Vite projects. SPA rewrites are handled by the framework preset.
- **Test site not updating** — Make sure you're on the \`test\` branch (\`git branch\`). Commits on \`main\` only deploy to production.

### Deployment helper script

\`scripts/compare-deploy.cjs\` compares local source files against what's on GitHub, reporting which files are different, new, or identical. Run it before pushing to verify what will change.

---

## Working Principles

- **Order is priority** — The backlog's physical order *is* the priority
- **Releases over sprints** — We ship when a coherent set of changes is ready, not on a timer
- **Self-documenting product** — The app documents itself. Docs live inside the app, not in a separate wiki
`;
