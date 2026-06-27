/**
 * InvitationBell — header bell that surfaces invitation activity (#1201, 1.14).
 *
 * Tier 1 notification feed (no stored notifications — everything is DERIVED from
 * the live invitation docs):
 *   • invites awaiting my answer            (I'm invited, status pending)
 *   • an invite I received was cancelled    (whole activity called off, or I was removed)
 *   • someone responded to an invite I sent (accepted / declined / tentative)
 *
 * A "last seen" marker (stored per-user in Firestore so it syncs across the
 * user's devices) drives what shows: pending invites always appear (they're
 * actionable until answered), while informational items (responses, cancellations)
 * only appear while they're NEW since the last time the bell was opened, then drop
 * off once seen — like a normal notification tray. The marker advances when the
 * panel is closed (not on open) so items don't vanish while they're being read.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Bell, UserPlus, CalendarDays, CalendarX, Check, X, HelpCircle } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { Invitation, InvitationResponse } from '../types/invitation';

/** Danish relative day phrasing for an ISO date ("i dag", "i morgen", "om 3 dage"…). */
function relativeWhen(iso: string): string {
  const target = new Date(iso + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return iso;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) {
    const d = Math.abs(diffDays);
    return d === 1 ? 'i går' : `for ${d} dage siden`;
  }
  if (diffDays === 0) return 'i dag';
  if (diffDays === 1) return 'i morgen';
  if (diffDays < 7) return `om ${diffDays} dage`;
  const weeks = Math.round(diffDays / 7);
  if (diffDays < 28) return weeks === 1 ? 'om 1 uge' : `om ${weeks} uger`;
  const months = Math.round(diffDays / 30);
  return months <= 1 ? 'om 1 måned' : `om ${months} måneder`;
}

function formatDateDa(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
}

type FeedKind = 'invite' | 'cancelled' | 'response';

interface FeedItem {
  key: string;
  kind: FeedKind;
  invitation: Invitation;
  /** Primary line (activity title). */
  title: string;
  /** Secondary line (who / what). */
  subtitle: string;
  /** Activity date (ISO) for the "when" line. */
  activityDate: string;
  /** Recency timestamp (ms) — when this thing last changed. */
  ts: number;
  /** Only invites are actionable (open the RSVP sheet). */
  actionable: boolean;
  /** Response value, for colouring the response icon. */
  response?: InvitationResponse;
}

function tsOf(inv: Invitation): number {
  const t = Date.parse(inv.updatedAt || inv.createdAt || '');
  return Number.isNaN(t) ? 0 : t;
}

/** Parse an optional ISO time to ms; NaN when absent/invalid (caller falls back). */
function tsParse(iso?: string): number {
  return iso ? Date.parse(iso) : NaN;
}

export function InvitationBell({
  invitations,
  myEmail,
  nameForEmail,
  lastSeen,
  onMarkSeen,
  onOpenInvitation,
}: {
  invitations: Invitation[];
  myEmail: string;
  nameForEmail: (email: string) => string;
  lastSeen: number;
  onMarkSeen: () => void;
  onOpenInvitation: (invitation: Invitation) => void;
}) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const lowerMe = myEmail.toLowerCase();

  // Derive the notification feed from the live invitation docs. Newest first.
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    // Local y-m-d for "today" — the feed only surfaces current/upcoming activities.
    // Responses and cancellations for activities already in the past are history
    // noise (they pile up and reappear once newer items are handled), so drop them.
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    for (const inv of invitations) {
      if (!inv.activity?.date || inv.activity.date < todayIso) continue;
      const myStatus = inv.invitees?.[lowerMe];
      const iAmInvited = myStatus !== undefined;
      const iAmInviter = inv.invitedBy.toLowerCase() === lowerMe;
      const when = tsOf(inv);

      // 1) Invites awaiting my answer.
      if (iAmInvited && inv.status !== 'cancelled' && myStatus === 'pending') {
        items.push({
          key: `invite_${inv.id}`,
          kind: 'invite',
          invitation: inv,
          title: inv.activity.title,
          subtitle: `Fra ${inv.invitedByName || nameForEmail(inv.invitedBy)}`,
          activityDate: inv.activity.date,
          ts: when,
          actionable: true,
        });
      }

      // 2) An invite I received was called off (whole activity, or I was removed).
      if (iAmInvited && !iAmInviter && (inv.status === 'cancelled' || myStatus === 'cancelled')) {
        const who = inv.invitedByName || nameForEmail(inv.invitedBy);
        const removedMe = myStatus === 'cancelled' && inv.status !== 'cancelled';
        // Stable time of the specific event (I was removed → my eventTime; whole
        // activity cancelled → cancelledAt), so it doesn't resurface when the doc
        // is touched again later.
        const cancelTs = removedMe ? tsParse(inv.eventTimes?.[lowerMe]) : tsParse(inv.cancelledAt);
        items.push({
          key: `cancelled_${inv.id}`,
          kind: 'cancelled',
          invitation: inv,
          title: inv.activity.title,
          subtitle: removedMe
            ? `${who} fjernede dig`
            : `${who} aflyste aktiviteten`,
          activityDate: inv.activity.date,
          ts: Number.isNaN(cancelTs) ? when : cancelTs,
          // #1215: tapping opens the invitation detail sheet (Outlook-style),
          // showing the activity + its cancelled (Aflyst) state — no calendar nav.
          actionable: true,
        });
      }

      // 3) Responses to an invite I sent (accept / decline / tentative).
      if (iAmInviter && inv.invitees) {
        for (const [email, resp] of Object.entries(inv.invitees)) {
          if (email === lowerMe) continue;
          if (resp !== 'accepted' && resp !== 'declined' && resp !== 'tentative') continue;
          const who = nameForEmail(email);
          const verb = resp === 'accepted' ? 'deltager' : resp === 'declined' ? 'afslog' : 'svarede måske';
          // Stable time of THIS person's response, so unrelated later edits to
          // the doc don't resurface an already-seen response as new.
          const respTs = tsParse(inv.eventTimes?.[email]);
          items.push({
            key: `resp_${inv.id}_${email}`,
            kind: 'response',
            invitation: inv,
            title: inv.activity.title,
            subtitle: `${who} ${verb}`,
            activityDate: inv.activity.date,
            ts: Number.isNaN(respTs) ? when : respTs,
            // #1215: tapping opens the invitation detail sheet showing the
            // activity + who's coming (the responses) — no calendar navigation.
            actionable: true,
            response: resp,
          });
        }
      }
    }
    items.sort((a, b) => b.ts - a.ts || b.activityDate.localeCompare(a.activityDate));
    return items;
  }, [invitations, lowerMe, nameForEmail]);

  // What the bell shows: pending invites (always, until answered) plus
  // informational items (responses / cancellations) that are NEW since the last
  // time the bell was opened. Informational items older than `lastSeen` drop off
  // so the tray stays clean instead of accumulating every past state change.
  const visibleFeed = useMemo(
    () => feed.filter((f) => f.kind === 'invite' || f.ts > lastSeen),
    [feed, lastSeen],
  );

  // Advance the "seen" marker when the panel CLOSES (not on open), so the items
  // stay visible while they're being read and only drop off on the next open.
  // The marker is persisted per-user in Firestore (via onMarkSeen) so it syncs
  // across the user's devices.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) onMarkSeen();
    wasOpen.current = open;
  }, [open, onMarkSeen]);

  const badge = visibleFeed.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}
        title={badge > 0 ? `${badge} ${badge === 1 ? 'ny notifikation' : 'nye notifikationer'}` : 'Notifikationer'}
      >
        <Bell className="w-5 h-5" />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 top-12 w-80 max-w-[88vw] rounded-xl border shadow-xl z-40 overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-surface-border'}`}>
            <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-ds-text'}`}>Notifikationer</p>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                {visibleFeed.length > 0 ? `${visibleFeed.length} ${visibleFeed.length === 1 ? 'opdatering' : 'opdateringer'}` : 'Du er ajour'}
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {visibleFeed.length === 0 && (
                <div className={`px-4 py-6 text-center text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                  Ingen notifikationer.
                </div>
              )}
              {visibleFeed.map((f) => {
                const isNew = f.kind === 'invite' || f.ts > lastSeen;
                const icon = f.kind === 'invite'
                  ? <UserPlus className="w-4 h-4" />
                  : f.kind === 'cancelled'
                    ? <CalendarX className="w-4 h-4" />
                    : f.response === 'accepted'
                      ? <Check className="w-4 h-4" />
                      : f.response === 'declined'
                        ? <X className="w-4 h-4" />
                        : <HelpCircle className="w-4 h-4" />;
                const iconTone = f.kind === 'cancelled' || f.response === 'declined'
                  ? (isDark ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700')
                  : f.response === 'tentative'
                    ? (isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700')
                    : (isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700');
                const whenTone = f.kind === 'cancelled'
                  ? (isDark ? 'text-red-400' : 'text-red-600')
                  : (isDark ? 'text-slate-400' : 'text-ds-text-subtle');
                const rowInteractive = f.actionable
                  ? (isDark ? 'hover:bg-slate-700 transition-colors cursor-pointer' : 'hover:bg-surface-hover transition-colors cursor-pointer')
                  : '';
                const newBg = isNew ? (isDark ? 'bg-slate-700/30' : 'bg-blue-50/60') : '';
                const content = (
                  <>
                    <span className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${iconTone}`}>
                      {icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-bold truncate ${isDark ? 'text-white' : 'text-ds-text'}`}>{f.title}</span>
                      <span className={`block text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                        {f.subtitle}
                      </span>
                      <span className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium ${whenTone}`}>
                        <CalendarDays className="w-3 h-3" />
                        {formatDateDa(f.activityDate)} · {relativeWhen(f.activityDate)}
                      </span>
                    </span>
                    {isNew && (
                      <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-blue-500" aria-label="ny" />
                    )}
                  </>
                );
                const rowClass = `w-full text-left px-4 py-3 flex items-start gap-3 border-b last:border-b-0 ${isDark ? 'border-slate-700/60' : 'border-surface-border'} ${rowInteractive} ${newBg}`;
                return f.actionable ? (
                  <button key={f.key} onClick={() => { setOpen(false); onOpenInvitation(f.invitation); }} className={rowClass}>
                    {content}
                  </button>
                ) : (
                  <div key={f.key} className={rowClass}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
