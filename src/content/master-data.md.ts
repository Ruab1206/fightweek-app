// Master Data content for FightWeek
// Updated 2026-04-02: Fixed category list to match constants.ts, added discipline/focus area model, aligned with Domain Model v1.0
export const MASTER_DATA = `# Master Data

> Configuration and reference data that drives the app — user mapping, disciplines, sources, and system settings.
> See the **Domain Model** for the full conceptual picture.

---

## App Identity

| Property | Value |
|----------|-------|
| **Name** | FightWeek |
| **Tagline** | Training scheduler for professional fighters |
| **URL** | fightweek-app.vercel.app |
| **Version** | 1.1.0 |

---

## User Mapping

Users are mapped by Firebase Auth email to roles and fighter identities:

| Email | Fighter Name | Role |
|-------|-------------|------|
| *(configured in constants.ts)* | Caroline, San, Enea, Anton, Jonas, Karl | fighter |
| *(configured in constants.ts)* | Frodi | coach |
| *(configured in constants.ts)* | Rune | admin |

Roles determine access:
- **admin** / **coach** → Can see admin button, access backlog, view all fighters, curate catalogue
- **fighter** → Own schedule only, team view read-only, catalogue read-only, feedback submission

---

## Disciplines (Training Categories)

These are the actual values used in \`constants.ts\`. This is the **single source of truth**.

| Discipline | Colour (Tailwind) | Description |
|-----------|-------------------|-------------|
| **MMA** | bg-red-600 | Mixed martial arts |
| **Brydning** | bg-emerald-600 | Wrestling (freestyle, Greco-Roman) |
| **Grappling** | bg-purple-600 | BJJ, NoGi, submission grappling |
| **Boksning** | bg-yellow-600 | Boxing |
| **Kickboxing** | bg-orange-500 | Kickboxing, Muay Thai |
| **Fysisk træning** | bg-stone-600 | Strength, cardio, mobility |
| **Andet** | bg-slate-500 | Other / miscellaneous |

### Focus Areas (📐 Planned)

Optional sub-tags for more specificity. Not yet implemented.

| Focus Area | Example disciplines |
|-----------|-------------------|
| Sparring | MMA, Boksning, Kickboxing |
| Parterre | Brydning, Grappling |
| Wall Wrestling | Brydning, MMA |
| Clinch | MMA, Brydning |
| Padwork | Boksning, Kickboxing |
| Technique | Any |
| Conditioning | Fysisk træning |
| Open Mat | Grappling |

---

## Training Sources (Clubs)

The team trains across multiple locations. These are currently free-text strings; planned to become a proper entity (see Domain Model).

| Source | Type | Notes |
|--------|------|-------|
| **Rumble** | Gym (MMA) | Rumble Sports — primary training location |
| **Burnell** | Gym (MMA) | MMA and wrestling |
| **Rødovre** | Gym (Boxing/Wrestling) | Rødovre BK — boxing and wrestling |
| **Roskilde** | Gym (Wrestling) | Wrestling sessions |

---

## Days of the Week

The app uses Danish day names as keys:

| Key | Day |
|-----|-----|
| Mandag | Monday |
| Tirsdag | Tuesday |
| Onsdag | Wednesday |
| Torsdag | Thursday |
| Fredag | Friday |
| Lørdag | Saturday |
| Søndag | Sunday |

---

## Firebase Configuration

| Setting | Value |
|---------|-------|
| **Project ID** | fightweek-app |
| **Auth Domain** | fightweek-app.firebaseapp.com |
| **Database** | Firestore |
| **Data path** | \`/artifacts/production/users/{userId}/{collection}/{docId}\` |
| **Public data** | \`/artifacts/production/public/data/\` |
| **Hosting** | Vercel |

---

## Week Numbering

- ISO 8601 week numbering
- Week IDs in Firestore: \`week_{isoWeekNum}\` (e.g. \`week_14\`)
- System week = current week based on server time
- Fighters can view: current week ± 1
- Past weeks are read-only (historical view)

---

## Session Statuses

| Status | Meaning | Visual |
|--------|---------|--------|
| **planned** | Session is on the schedule | Normal card |
| **cancelled** | Session was cancelled | Dimmed, red accent, strikethrough title |
| **completed** | 📐 Session was attended | (Planned: check mark, intensity badge) |

---

## Intensity Rating (📐 Planned)

Post-session self-reported load, 1–5 scale:

| Rating | Label | Meaning |
|--------|-------|---------|
| 1 | Let | Light / recovery |
| 2 | Moderat | Moderate effort |
| 3 | Normal | Standard training |
| 4 | Hård | Hard session |
| 5 | Maksimal | All-out / competition intensity |

---

## Backlog Statuses

| Status | Meaning | Column (Board) |
|--------|---------|----------------|
| **backlog** | Idea / not yet refined | Backlog |
| **ready** | Refined, ready to start | Ready |
| **doing** | Work in progress | Doing |
| **done** | Shipped | Done |
`;
