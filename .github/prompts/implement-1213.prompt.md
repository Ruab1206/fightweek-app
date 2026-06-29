---
mode: agent
description: "Implement Release 1.17 — Invite the Whole Series (#1213). Fresh implementation session."
---

# Implement Release 1.17 — Invite the Whole Series (#1213)

You are starting a **fresh implementation session** with a clean context window.
Nothing carries over in memory between sessions — state lives in the repo. The
backlog item is **already refined to the Definition of Ready and the design is
decided**. This session is for **implementation only** — no planning, review, or
retro ceremonies. The one closing step is **release notes**, after the PO verifies.

## 1. Rebuild context (always first)

1. Read `/memories/repo/roadmap.md` end-to-end (the live handoff note).
2. Read the full detail of **#1213** from Firestore — the `desc`, `acceptance`,
   and `notes` fields carry the agreed scope, the **data-shape decision (option B)**,
   the affected-files list, risks, and the "How to verify" checklist:
   `node -e "const db=require('./scripts/firestore-admin.cjs'); (async()=>{ await db.init(); const items=await db.listCollection('artifacts/production/public/data/backlog'); const i=items.find(x=>x.number===1213); console.log('DESC:',i.desc); console.log('\nACCEPTANCE:',i.acceptance); console.log('\nNOTES:',i.notes); })().catch(e=>{console.error(e);process.exit(1);});"`
3. Briefly confirm to the PO what you're about to build and the chosen approach,
   then start.

## 2. The decision that is already made (do not re-litigate)

- **Data shape = Option B:** ONE invitation doc **per occurrence**, linked by a shared
  `seriesId`. NOT one doc-per-series with an overrides map.
- A recurring series is **bounded** — cap occurrences at `RECURRENCE_HORIZON_WEEKS = 52`
  (`src/config/constants.ts`), reusing the recurrence-horizon pattern from
  `src/hooks/useSessionHandlers.ts` (`computeRecurringWeeks`). This is the same horizon
  the arranger's own recurring session uses, so the invited series and the session stay
  paired. **Walk the FULL horizon for create AND cancel/remove — not the loaded scroll
  window** (the #1183 trap).
- `seriesId` is an **optional** field — existing 1.14 single-invite docs keep working
  untouched (full backward compatibility).

## 3. What to build (per the #1213 DoR)

Work to the item's acceptance criteria. In short:
- `src/types/invitation.ts` — add `seriesId?: string`.
- `src/hooks/useInvitations.ts` — add series operations (fan-out create, cancel-series,
  remove-from-series) that batch across occurrence docs sharing a `seriesId`. Single-invite
  paths stay unchanged.
- Reuse `RECURRENCE_HORIZON_WEEKS` + the `computeRecurringWeeks` pattern (factor a shared
  helper if cleaner) — **no new horizon constant**.
- Invite + cancel UI — add a **"denne / hele serien"** choice, mirroring the existing
  recurring-session add/delete pattern.
- `src/hooks/useInvitationMerge.ts` and `firestore.rules` — **verify only**, no change
  expected (each occurrence doc still merges into its own day; batch ops are just many
  single-doc writes already permitted by `invitedBy == own email`).

Confirm the small open UI questions in the DoR notes (where the this-occurrence-vs-series
choice lives) just before building that part — don't block on them.

## 4. Build discipline

- **Gate:** `npx vite build` must pass. Use `get_errors` on the files you touch (tsc is
  NOT the gate — it shows ~50 pre-existing errors in untouched files).
- Keep any file under 400 lines; if an edit pushes past it, propose an extraction.
- Add/extend pure unit-tested helpers where decision logic lives (the codebase already
  tests `computeRecurringWeeks` / `computeDeleteFutureWeeks` — follow that pattern for the
  fan-out logic).
- For multi-field Firestore writes with prose, use a temp `scripts/_xxx.cjs`
  (`db.updateDoc`/`addDoc`) then delete it — PowerShell mangles inline `node -e` with quotes.

## 5. Deploy flow (test → verify → production)

1. Commit and `git push origin test` (maps to `origin/feature/bedre-design` = Vercel tst).
2. Tell the PO to **wait for the Vercel rebuild and hard-refresh**, then verify on their
   phone against the item's "How to verify" checklist.
3. Keep #1213 at `doing` after the commit. Only after the PO's explicit verification:
   - `git push origin test:main` to promote to production.
   - Mark #1213 `done` in the backlog.

## 6. Close-out (the only ceremony — after PO accepts)

Once verified and accepted:
- **Write the release notes** for `1.17 — Invite the Whole Series` at the top of
  `src/content/release-notes.md.ts` (in "what you can now *do*" language).
- **Add the release-history row** to the table in `src/content/team-charter.md.ts`.
- **Update the handoff note** `/memories/repo/roadmap.md` (what shipped + commit ref,
  branch/deploy state synced, next candidate).
- Commit + push the docs to `test` and `main`.

## Standing rules

- PO is a **novice** — give exact, step-by-step instructions and phone/UI click-paths.
- **PO written "go" is required before any code change.** Confirm the approach first.
- Feature/release branch (`feature/bedre-design`) = tst only; never push to `main` (prod)
  without an explicit PO go.
- Warn before editing JSON/data files and remind the PO to refresh the browser.
- DoD = "Tested in browser — PO has verified." Keep the item at `doing` after commit; only
  move to `done` once the PO confirms.
- `scripts/firestore-admin.cjs`: call `await db.init()` first; methods listCollection/readDoc/
  writeDoc/addDoc/updateDoc/deleteDoc. Backlog detail fields are `desc` / `acceptance` /
  `notes` (NOT `description`).
- dev server: `node dev-start.mjs` (reads files off disk; past exit-code-1 = manual Ctrl+C).
