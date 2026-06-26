// ──────────────────────────────────────────────
// Invitation — invite FightWeek users to an activity (#1201, Release 1.14)
// See docs/DOMAIN_MODEL.md for terminology.
//
// An invitation is a document in the shared `invitations` collection. It holds
// a snapshot of the activity (title, date, time, location) plus a map of
// invitees keyed by EMAIL (the stable id from #1191). It is merged into each
// invitee's calendar at render time (like signed-up events) — nothing is ever
// written into a private week document.
// ──────────────────────────────────────────────

/** An invitee's response to an invitation. `pending` = invited, not yet replied. */
export type InvitationResponse = 'pending' | 'accepted' | 'declined' | 'tentative';

/** Lifecycle of an invitation. `cancelled` = the arranger called it off; invitees
 * still see it (struck through) until they remove it from their own calendar. */
export type InvitationStatus = 'active' | 'cancelled';

/** Snapshot of the activity an invitation was created from (taken at invite time). */
export interface InvitationActivity {
  title: string;          // Activity name, e.g. "MMA Sparring"
  category?: string;      // Discipline/category for colouring, e.g. "MMA"
  date: string;           // ISO date "2026-06-30" (the specific day)
  start: string;          // "17:00" (HH:mm) — may be empty
  end: string;            // "18:30" (HH:mm) — may be empty
  location: string;       // Venue / gym name — may be empty
}

/** A single invitation to one activity, with its invitees and their responses. */
export interface Invitation {
  id: string;
  activity: InvitationActivity;
  invitedBy: string;                              // Inviter's email (lower-case)
  invitedByName?: string;                         // Inviter's display name (denormalised for UI)
  invitees: Record<string, InvitationResponse>;   // email → response
  status?: InvitationStatus;                      // undefined = active (legacy docs)
  createdAt: string;                              // ISO 8601
  updatedAt: string;                              // ISO 8601
}

/** Response options offered to an invitee (excludes the implicit `pending`). */
export const INVITATION_RESPONSE_OPTIONS: {
  value: Exclude<InvitationResponse, 'pending'>;
  label: string;
  activeColor: string;
}[] = [
  { value: 'accepted', label: 'Deltager', activeColor: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'tentative', label: 'Måske', activeColor: 'bg-amber-500 text-white border-amber-500' },
  { value: 'declined', label: 'Afslår', activeColor: 'bg-red-600 text-white border-red-600' },
];

/** Danish label for a response value (for read-only status display). */
export function responseLabel(status: InvitationResponse | undefined): string {
  switch (status) {
    case 'accepted': return 'Deltager';
    case 'tentative': return 'Måske';
    case 'declined': return 'Afslår';
    case 'pending': return 'Afventer svar';
    default: return '—';
  }
}

/**
 * Compact badge for an invitation shown on the calendar — tells the viewer their
 * own response state at a glance so they remember to answer. `tone` maps to a
 * colour the calendar components turn into Tailwind classes.
 */
export interface InvitationBadge {
  label: string;
  tone: 'attention' | 'positive' | 'maybe';
}

export function invitationBadge(status: InvitationResponse | undefined): InvitationBadge {
  switch (status) {
    case 'accepted': return { label: 'Du deltager', tone: 'positive' };
    case 'tentative': return { label: 'Du har svaret måske', tone: 'maybe' };
    case 'declined': return { label: 'Afslået', tone: 'maybe' };
    default: return { label: 'Svar mangler', tone: 'attention' };
  }
}
