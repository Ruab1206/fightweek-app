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

## Access Control

| Level | Who | Can do |
|-------|-----|--------|
| **Admin** | Rune, Frodi | Full CRUD on all data. Backlog access. Catalogue curation. Process docs. |
| **Coach** | Frodi | View all fighters, manage team schedules, curate catalogue, set goals |
| **Fighter** | Karl + others | Own schedule only. Team view read-only. Catalogue read-only. Feedback submission. |

Access is determined by the \`USER_MAPPING\` in the app config, matching Firebase Auth email to role.

---

## Where We Are

- **6 fighters + coaches** using the app daily in production
- **Vercel** hosting at fightweek-app.vercel.app
- **Firebase** backend for real-time data sync
- **Mobile-first** — most usage is on phones during the day
`;
