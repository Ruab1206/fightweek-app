// Personas content for FightWeek
// Updated 2026-04-02: Expanded role model, added future roles, aligned with Domain Model v1.0
export const PERSONAS = `# Who Uses FightWeek

> A guide to the people behind the screens — their roles, their needs, and what the app does for each of them.
> See the **Domain Model** for the full conceptual role hierarchy.

---

## The Team

The Fighter Team is a tight unit with clear roles. Everyone has a say, but the mandate is clear. The team trains across multiple clubs — there is no single home gym.

### Current Roles

| Role | Domain Role | Access Level |
|------|-------------|-------------|
| **Coach** | Head Coach | Admin — full control over all fighters, catalogue curation, goal setting |
| **Fighter** | Kæmper | Own data — can edit own schedule, view team, give feedback |
| **Admin / RTE** | Coordinator | Admin — backlog, process, app management, impediment removal |

### Future Roles (💭 Envisioned)

| Role | Domain Role | Access Level |
|------|-------------|-------------|
| **Instructor** | Træner/Instruktør | Read-only on relevant sessions — external coaches at clubs |
| **Stakeholder** | Interessent | Read-only on relevant schedule/fight data — managers, family |
| **Promoter / Matchmaker** | Promotor | Public read-only on *published* fighter profiles — no login, no access to private schedule data |

---

## Meet the Personas

### 🥊 Frodi — The Head Coach

**Domain role:** Head Coach
**Real person:** Head coach with a strong theoretical and practical understanding of MMA and training principles. Master's degree in sports science.

**Needs:**
- Overview of all fighters' weekly plans
- Curate the cross-gym training catalogue — decide which classes are available to the team
- Data-driven follow-up on training load (intensity, attendance, volume per discipline)
- Quick identification of who's training, who's resting, who cancelled
- Set goals for fighters at quarterly and long-term level
- Manage upcoming fights and fight camps
- Review and approve weekly plans before the week starts

**What Frodi does in FightWeek:**
- Reviews the **Team View** to monitor all fighters
- Curates the **Catalogue** — selects which external classes are available for the team
- Gets notified about cancellations and reasons
- Validates that fighters follow "Standarden"
- Reviews fighters' weekly plans (submitted by Saturday 18:00)
- Uses intensity and attendance data to adjust training plans
- 💭 Sets quarterly goals and monitors progression toward them
- 💭 Registers upcoming fights and defines fight camp periods

---

### 🏆 Karl — The Fighter

**Domain role:** Kæmper (Fighter)
**Real person:** Serious fighter aiming for the UFC. Strong wrestling and grappling background, capable striker. Needs structure, fight preparation, and an easy way to stay on top of goals, training, and fights.

**Needs:**
- Simple weekly view — what's happening today?
- Easy session management — pick from the curated catalogue, or add custom sessions
- Rate training intensity after each session (1–5 scale)
- Mark sessions as completed or cancelled (with reason)
- Rest day toggling without friction
- Standard week import for routine weeks, then adjust for the coming week
- See weekly focus / goals from coach
- Mobile-first — uses the phone, always

**What Karl does in FightWeek:**
- Opens the app to see today's and this week's plan
- Adds sessions from the **curated catalogue** or creates custom ones
- After training: marks session as **completed** and rates **intensity** (1–5)
- Cancels sessions with a reason when needed
- Marks rest days
- Adjusts his standard week in the weekend for the coming week
- Submits his weekly plan for coach review
- Checks the team view to see who else is training
- 💭 Reviews his goals and links training to competence targets

---

### ⚙️ Rune — The Coordinator (RTE)

**Domain role:** Teamkoordinator (Coordinator)
**Real person:** Facilitates the team framework. Wants flow, simple processes, and "Poka-Yoke" (error-proof) solutions to support the team functioning optimally.

**Needs:**
- Backlog management for app development
- Process documentation accessible in-app
- Feedback collection and conversion to backlog items
- Overview of what's been built and what's planned
- Maintain the catalogue of training offerings (data entry, scraping coordination)
- Story map for development coordination

**What Rune does in FightWeek:**
- Manages the **Backlog** (admin 'b' shortcut)
- Reviews and converts **Feedback** from users
- Maintains **Team Charter** and **Release Notes**
- Plans releases with outcome-based goals
- Validates features in the browser
- Helps maintain the **Catalogue** data (sources, offerings)
- Uses the **Story Map** for development planning

---

### 🎤 Mark O — The Promoter / Matchmaker (💭 Envisioned)

**Domain role:** Promotor (external)
**Real person:** Regional fight promoter / matchmaker who runs 2–6 events per year and works with multiple gyms and managers at once. He never logs in — he discovers a fighter through a shared link and decides, in under a minute, whether this fighter is worth a bout offer. He is matching *competitive, entertaining* fights, so he weighs both ability and marketability.

**What he needs to decide on a match (from how matchmakers actually scout):**
- **Fight record first** — W–L–D, *and how the wins come* (finish rate: KO/submission vs decision). "Does this fighter finish opponents?" is the single biggest signal.
- **Weight class / division** — the primary matching filter; must be unambiguous.
- **Experience level** — amateur vs professional, and the calibre of promotions fought in.
- **Fighting style & disciplines** — striker, grappler, or well-rounded; the standout strengths that make an exciting fight.
- **Physical attributes for matchmaking** — age, height, reach, stance.
- **Gym / team affiliation** — who coaches and trains the fighter (credibility + a contact path).
- **Accomplishments** — titles, performance bonuses, "top prospect" recognition.
- **Availability & readiness** — is the fighter open to offers right now (and medically clear)?
- **Fight footage** — a highlight/video link; promoters want to *see* the fighter.
- **A clear way to make contact** — how to reach the fighter or coach with an offer.

**What Mark O does with FightWeek:**
- Opens a fighter's **public profile** from a shared link — no account, no login
- Scans the headline facts (record, division, gym, style) above the fold in seconds
- Trusts the profile because the team curates it — verified, up-to-date stats
- Reaches out to the coach/fighter when there's a fit
- 💭 Later: browses and **filters** a roster of published fighters by weight, record, availability

> **Design implications for the profile page (effective-profile research):** lead with the most decision-relevant facts (record + finish rate + weight class) above the fold; keep it scannable, not a wall of text; signal credibility (curated/verified, recently updated); give one obvious next action (contact); mobile-first, since the link is opened on a phone. The fighter controls what's public and whether the profile is published at all (Poka-Yoke: nothing private is ever exposed by accident).

---

## Access Control

| Level | Who | Can do |
|-------|-----|--------|
| **Admin** | Rune, Frodi | Full CRUD on all data. Backlog access. Catalogue curation. Process docs. Publish/unpublish any fighter profile. |
| **Coach** | Frodi | View all fighters, manage team schedules, curate catalogue, set goals. Edit and publish/unpublish fighter profiles. |
| **Fighter** | Karl + others | Own schedule only. Team view read-only. Catalogue read-only. Feedback submission. Edit and publish/unpublish **own** profile. |
| **Promoter / Matchmaker** | External, no login | Read-only on **published** fighter profiles via public link. No access to schedules or private data. |

Access is determined by the \`USER_MAPPING\` in the app config, matching Firebase Auth email to role.

---

## Where We Are

- **6 fighters + coaches** using the app daily in production
- **Vercel** hosting at fightweek-app.vercel.app
- **Firebase** backend for real-time data sync
- **Mobile-first** — most usage is on phones during the day
`;
