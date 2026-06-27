---
mode: agent
description: Start a fresh working session — rebuild context (Session kickoff), then run Release Planning per the team charter.
---

# Session kickoff → Release Planning

You are starting a **fresh working session** with a clean context window. Nothing
carries over in memory between sessions — state lives in the repo, not the chat.
Work strictly in the order below. Do **not** write any code in this session until
the PO gives an explicit written "go" on a refined item.

## 1. Session kickoff (rebuild context — always first)

1. Read `/memories/repo/roadmap.md` (the latest handoff note) end-to-end.
2. Read the team charter (`src/content/team-charter.md.ts`), especially the
   **Ceremonies** and **Release Planning** sections, and the **Target Architecture**
   (`src/content/target-architecture.md.ts`).
3. **Summarise where we are** in a few lines: what shipped last (with the release
   number + commit refs), the current release/backlog state, and the current branch
   / deploy state (tst = `feature/bedre-design`, prod = `main`).
4. **Surface blockers** — anything pending PO verification, deferred, or at risk.
5. Stop and confirm with the PO that we're doing **Release Planning** this session
   before going further.

## 2. Release Planning (per the charter — only after the PO confirms)

Follow the charter's Release Planning ceremony:

1. **Consult the target architecture** before selecting items — does the candidate
   slice align with the north star, or will we have to rework it later?
2. **Read the open backlog sorted by `order` ascending** (lowest `order` = top =
   highest priority). The PO ranks it manually; the top items are the opening
   proposal for *what's next*. Do **not** infer priority from item number, creation
   date, or status — only the `order` field carries the ranking. Use the
   firestore-admin script to read it:
   `node -e "const db=require('./scripts/firestore-admin.cjs'); (async()=>{ await db.init(); const items=await db.listCollection('artifacts/production/public/data/backlog'); const open=items.filter(i=>['backlog','ready'].includes(i.status)); open.sort((a,b)=>(a.order||0)-(b.order||0)); for(const i of open) console.log(i.order, '|', i.number, '|', i.status, '|', i.tag, '|', i.title); })().catch(e=>{console.error(e);process.exit(1);});"`
3. **Read the full detail of the candidate items before judging them** — the
   one-line backlog listing only shows the title. Always read each candidate's
   detail fields before deciding scope or calling an item "empty". ⚠️ The detail
   fields are named **`desc`** (NOT `description`), **`acceptance`**, and **`notes`** —
   reading `i.description` returns blank and will make a populated item look empty.
   `node -e "const db=require('./scripts/firestore-admin.cjs'); (async()=>{ await db.init(); const items=await db.listCollection('artifacts/production/public/data/backlog'); for(const n of [/* item numbers */]){ const i=items.find(x=>x.number===n); console.log('==== #'+n+' | order',i.order,'| tag',i.tag,'===='); console.log('DESC:',i.desc||'(none)'); console.log('ACCEPTANCE:',i.acceptance||'(none)'); console.log('NOTES:',i.notes||'(none)'); console.log(''); } })().catch(e=>{console.error(e);process.exit(1);});"`
   When in doubt, dump the whole doc with `JSON.stringify(i,null,2)`.
4. **Identify the theme (Label) cluster** the top items belong to — a release is
   usually one theme's thinnest end-to-end slice, not scattered items.
5. **Propose the release slice** to the PO, starting from the top items, and explain
   any reason to deviate from the PO's ordering. For a feature slice, optionally walk
   the story map backbone; for cleanup/hardening, drive from the backlog.
6. **Name the release** `1.x — Name` (outcome-based, not feature list) and define its
   **success metric** ("what would we measure to call this a success?").
7. **Refine the first item to the Definition of Ready** — restate goal + acceptance,
   open questions, affected files, risks, explicit CRUD scope, and the "How to verify"
   checklist. Only **after the PO's explicit written "go"** does implementation start
   (in a later step / session). Refinement can be item-by-item, just-in-time.

## Standing rules

- PO is a **novice** — give exact, step-by-step instructions and Portal/UI click-paths.
- PO "go" is required before any code change. Feature/release branch (`feature/bedre-design`)
  = tst only; never push to `main` (prod) without an explicit PO go.
- Warn before editing JSON/data files and remind the PO to refresh the browser.
- DoD = "Tested in browser — PO has verified." Keep an item at `doing` after commit;
  only move to `done` once the PO confirms.
- For multi-field Firestore writes with prose, use a temp `scripts/_xxx.cjs` script
  (PowerShell mangles inline `node -e` with quotes), then delete it.
