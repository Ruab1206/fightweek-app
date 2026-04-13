// Design System content for FightWeek — adopted from Toolbox patterns
export const DESIGN_SYSTEM = `# Design System

> The visual language and component patterns of FightWeek — how things look, how they behave, and why.
> Maintained bottom-up from working code: Build → Extract → Document → Reference.

---

## How We Use This Document

The design system grows **bottom-up from working code** — not top-down from theory:

1. **Build it once** in a feature — get it working and PO-approved.
2. **Extract the pattern** when it appears a second time — create a shared hook or component.
3. **Document it here** — capture the what, why, and how.
4. **Reference it during DoR** — confirm new features follow the standard.

We don't pre-design components we haven't needed yet.

---

## Theme Strategy

FightWeek uses a **dual-theme approach**:

| Context | Theme | Reason |
|---------|-------|--------|
| **Fighter-facing pages** | Dark (slate-950 base) | Looks professional, easy on eyes during training |
| **Admin pages** | Light/dark toggle | Admin works in various lighting; follows JPD/Atlassian tokens |

Theme is managed by \`useTheme()\` hook with \`ThemeProvider\`. Toggle persisted to \`localStorage('fw-theme')\`.

---

## Colour System

### Dark theme (fighter-facing)

| Token | Value | Usage |
|-------|-------|-------|
| \`bg-slate-950\` | #020617 | App background |
| \`bg-slate-900\` | #0f172a | Cards, header, sidebar, modals |
| \`bg-slate-800\` | #1e293b | Interactive elements, inputs |
| \`text-white\` | #ffffff | Headings, emphasis |
| \`text-slate-200\` | #e2e8f0 | Primary text |
| \`text-slate-400\` | #94a3b8 | Secondary text |
| \`text-slate-500\` | #64748b | Muted text, labels |
| \`bg-blue-600\` | #2563eb | Primary action |
| \`text-blue-400\` | #60a5fa | Links, active states |
| \`border-slate-800\` | #1e293b | Default borders |

### Light theme (admin, JPD/Atlassian tokens)

| Token | Tailwind class | Value | Usage |
|-------|---------------|-------|-------|
| Brand | \`brand-500\` | #0052CC | Primary actions, links |
| Brand light | \`brand-50\` | #E9F2FF | Active tab backgrounds |
| Surface raised | \`surface-raised\` | #F4F5F7 | Card backgrounds |
| Surface hover | \`surface-hover\` | #EBECF0 | Hover states |
| Surface border | \`surface-border\` | #DFE1E6 | Borders |
| Text default | \`ds-text\` | #172B4D | Headings, primary text |
| Text subtle | \`ds-text-subtle\` | #6B778C | Secondary text |
| Text subtlest | \`ds-text-subtlest\` | #97A0AF | Muted text |

### Status colours (both themes)

Following the Toolbox pattern: \`{hue}-100\` background + \`{hue}-700\` text.

| Status | Colour | Classes |
|--------|--------|---------|
| Backlog | ⚪ Gray | \`bg-gray-100 text-gray-700\` |
| Ready | 🔵 Blue | \`bg-blue-100 text-blue-700\` |
| Doing | 🟡 Amber | \`bg-amber-100 text-amber-700\` |
| Done | 🟢 Emerald | \`bg-emerald-100 text-emerald-700\` |

### Category colours (training sessions)

| Category | Colour | Class |
|----------|--------|-------|
| MMA | Red | \`bg-red-600\` |
| Brydning | Emerald | \`bg-emerald-600\` |
| Grappling | Purple | \`bg-purple-600\` |
| Boksning | Yellow | \`bg-yellow-600\` |
| Kickboxing | Orange | \`bg-orange-500\` |
| Fysisk tr\u00e6ning | Stone | \`bg-stone-600\` |
| Andet | Slate | \`bg-slate-500\` |

### Event type badges

| Type | Label | Light classes | Dark classes | Icon |
|------|-------|---------------|-------------|------|
| tournament | St\u00e6vne | \`bg-red-100 text-red-700 border-red-200\` | \`bg-red-900/30 text-red-400 border-red-800\` | Trophy |
| seminar | Seminar | \`bg-blue-100 text-blue-700 border-blue-200\` | \`bg-blue-900/30 text-blue-400 border-blue-800\` | BookOpen |
| social | Socialt | \`bg-emerald-100 text-emerald-700 border-emerald-200\` | \`bg-emerald-900/30 text-emerald-400 border-emerald-800\` | PartyPopper |
| other | Andet | \`bg-slate-100 text-slate-700 border-slate-200\` | \`bg-slate-800 text-slate-400 border-slate-700\` | CalendarDays |

### Semantic colours

| Purpose | Dark classes | Light classes |
|---------|-------------|--------------|
| **Primary action** | \`bg-blue-600 text-white hover:bg-blue-700\` | Same |
| **Destructive** | \`text-red-400 hover:text-red-300\` | \`text-red-600 hover:text-red-700\` |
| **Focus ring** | \`focus:ring-2 focus:ring-blue-500\` | \`focus:ring-1 focus:ring-blue-400\` |
| **Muted text** | \`text-slate-400\` → \`text-slate-500\` | \`text-gray-500\` → \`text-gray-400\` |
| **Borders** | \`border-slate-700\` / \`border-slate-800\` | \`border-gray-200\` / \`border-gray-300\` |
| **Hover bg** | \`hover:bg-slate-800\` | \`hover:bg-gray-50\` |

---

## Typography

- **Font:** Inter (via Tailwind config), fallback to system sans-serif
- **Headings:** \`font-bold\` — lg for page titles, base for section titles
- **Body:** \`text-sm\` (14px) for default, \`text-xs\` (12px) for metadata
- **Labels:** \`text-xs uppercase tracking-wide font-semibold\`
- **Spacing:** \`leading-relaxed\` for body text

---

## Layout Conventions

### App structure (fighter-facing)

- **Max width:** \`max-w-md md:max-w-4xl mx-auto\` (mobile-first)
- **Card padding:** \`p-4\` (16px)
- **Section spacing:** \`space-y-3\`
- **Border radius:** \`rounded-2xl\` cards, \`rounded-xl\` inner, \`rounded-lg\` buttons

### Public pages (no auth)

- **Max width:** \`max-w-5xl mx-auto\` (wider than fighter layout, catalogue/browse pages)
- **Content padding:** \`px-4 sm:px-6 py-6\`
- **Root class:** Same as fighter: \`min-h-screen font-sans selection:bg-blue-500/30 \${isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text'}\`

### Admin structure

\`\`\`
┌─ Header (border-b, py-3, px-6) ────────────────────────┐
├─ Sidebar (w-56 / w-14) ─┬─ Content ────────────────────┤
│  Navigation links        │  Page component              │
│                          │  └─ Toolbar                  │
│                          │  └─ Body (p-6)               │
└──────────────────────────┴──────────────────────────────┘
\`\`\`

---

## Component Patterns

### App Header

Shared across all pages (auth-gated and public). Structure:

\`\`\`
<div className={\`p-4 shadow-lg border-b sticky top-0 z-20
  \${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border shadow-sm'}\`}>
  <div className="flex justify-between items-center max-w-[…] mx-auto">
    <!-- Left: logo + title -->
    <div className="flex items-center space-x-2">
      <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
        <ShieldCheck className="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 className={\`font-bold text-lg leading-tight \${isDark ? 'text-white' : 'text-ds-text'}\`}>FightWeek</h1>
        <p className="text-blue-400 text-xs font-bold uppercase tracking-wide">{subtitle}</p>
      </div>
    </div>
    <!-- Right: actions -->
  </div>
</div>
\`\`\`

- **Logo icon:** ShieldCheck (Lucide) in bg-blue-600 rounded-lg with shadow
- **Max width:** \`max-w-md md:max-w-4xl\` (fighter/admin) or \`max-w-5xl\` (public browse)
- **Sticky header:** Always \`sticky top-0 z-20\` with shadow

### Theme Toggle Button

Consistent across all pages. Uses Lucide Sun/Moon icons.

\`\`\`jsx
<button
  onClick={toggleTheme}
  className={\`p-2 rounded-lg transition-colors
    \${isDark ? 'text-yellow-400 hover:bg-slate-800'
             : 'text-ds-text-subtle hover:bg-surface-hover'}\`}
  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
</button>
\`\`\`

- **Dark state:** \`text-yellow-400\` (warm sun colour), \`hover:bg-slate-800\`
- **Light state:** \`text-ds-text-subtle\`, \`hover:bg-surface-hover\`
- **Icon size:** \`w-5 h-5\` in main headers, \`w-4 h-4\` in compact headers
- **Never** use emoji (☀️/🌙) — always Lucide icons

### Filter Chips

Used for multi-select toggleable filters (catalogue, future browse pages).

\`\`\`jsx
<button className={\`px-3 py-1.5 text-sm rounded-full font-medium transition-colors cursor-pointer select-none
  \${active ? 'bg-blue-600 text-white'
    : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
             : 'bg-surface-raised text-ds-text-subtle hover:bg-surface-hover'}\`}>
  {label}
</button>
\`\`\`

- **Active:** \`bg-blue-600 text-white\` (same for both themes — brand action)
- **Inactive dark:** \`bg-slate-800 text-slate-300\`
- **Inactive light:** \`bg-surface-raised text-ds-text-subtle\`

### Badges / Pills

Small colour-coded labels for discipline, level, status.

\`\`\`
text-xs px-2 py-0.5 rounded font-medium
\`\`\`

- **Semantic colours:** \`{hue}-100 text-{hue}-700\` (light), \`{hue}-900/40 text-{hue}-300\` (dark)
- **Neutral badge:** \`bg-gray-100 text-gray-600\` / \`bg-slate-800 text-slate-400\`
- **Round pill variant:** Add \`rounded-full border\` for status pills in headers

### Buttons

| Type | Dark classes | Light classes |
|------|-------------|--------------|
| **Primary** | \`bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium\` | Same |
| **Ghost** | \`text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg\` | \`text-gray-500 hover:bg-gray-100 rounded-lg\` |
| **Destructive** | \`text-red-400 hover:bg-red-900/30 rounded-lg\` | \`text-red-600 hover:text-red-800\` |
| **Cancel** | \`text-slate-300 hover:bg-slate-700\` | \`text-gray-600 hover:bg-gray-200\` |

### Cards

**Dark:** \`rounded-2xl p-4 border bg-slate-900 border-slate-800 shadow-md\`
**Light:** \`rounded-2xl p-4 border bg-white border-gray-200 shadow-sm\`

### Event session cards (calendar)

Virtual event sessions in the personal and team schedule use an indigo palette to distinguish them from regular training sessions:

**Dark:** \`bg-indigo-950/30 border-indigo-800/50\`
**Light:** \`bg-indigo-50 border-indigo-200\`
**Badge:** \`text-indigo-400\` (dark) / \`text-indigo-600\` (light) — CalendarDays icon + "EVENT" uppercase text

### Modals

**Dark overlay:** \`fixed inset-0 z-50 bg-black/60\`
**Dark panel:** \`bg-slate-800 rounded-xl border border-slate-700 shadow-2xl\`
**Light panel:** \`bg-white rounded-xl border border-gray-200 shadow-2xl\`

### Inputs

**Dark:** \`bg-slate-900 border-slate-600 text-slate-200 placeholder-slate-500\`
**Light:** \`bg-white border-gray-300 text-gray-900 placeholder-gray-400\`

Both: \`rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500\`

---

## Keyboard Shortcuts

### Escape cascade (adopted from Toolbox)

Escape is the universal "undo one layer of UI state" key:

| Step | Condition | Action |
|------|-----------|--------|
| 1 | Input focused | Blur — return keyboard nav |
| 2 | Overlay open | Close the overlay |
| 3 | Search has text | Clear the search filter |
| 4 | Items selected | Deselect all |

### Admin shortcuts

| Key | Action |
|-----|--------|
| \`j/k\` | Move selection up/down |
| \`o\` / \`Enter\` | Open selected item |
| \`n\` | New item |
| \`f/a\` | Move status forward/backward |
| \`r\` | Assign release |
| \`æ\` | Focus search |
| \`m\` | Toggle sidebar |
| \`?\` | Show shortcut help |
| \`b\` | Toggle admin mode |

---

## Responsive Behaviour

| Breakpoint | Behaviour |
|-----------|-----------|
| **Mobile** (\`<md\`) | Single column, full-width cards, bottom nav, no sidebar |
| **Desktop** (\`md+\`) | Wider layout, sidebar visible in admin, horizontal filters |

The app is **mobile-first**. All designs start at the smallest screen and expand.

---

## Patterns

### Confirm before destructive
Any destructive action shows a confirm dialog first. No silent destructive operations.

### Toast notifications
Success (green) / error (red) / info (blue) variants. Auto-dismiss after 3 seconds.

### Loading states
\`text-center py-20\` with "Loading…" message.

### Empty states
Dashed border placeholder with helpful message and action button.
`;

