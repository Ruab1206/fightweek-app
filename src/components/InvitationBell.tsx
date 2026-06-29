/**
 * InvitationBell — header bell that surfaces invitation activity (#1201, 1.14).
 *
 * Tier 1 notification feed (no stored notifications — everything is DERIVED from
 * the live invitation docs):
 *   • invites awaiting my answer            (I'm invited, status pending)
 *   • an invite I received was cancelled    (whole activity called off, or I was removed)
 *   • someone responded to an invite I sent (accepted / declined / tentative)
 *
 * Pending invites always appear (they're actionable until answered). Informational
 * items (responses, cancellations) PERSIST in the tray until the user explicitly
 * clears them — by tapping the item, pressing its delete (X), or "Slet alle" —
 * rather than vanishing the moment the panel closes (#1215). A per-user "last
 * seen" marker (synced across devices) only drives the blue "new" highlight, and
 * the set of dismissed item keys is persisted per-user so a cleared notification
 * stays cleared across devices and reloads.
 *
 * Tapping a "someone responded" item opens the activity's full detail view
 * (onOpenActivity) — the same sheet you get tapping the class in your calendar —
 * while invite/cancelled items open the invitation/RSVP sheet (onOpenInvitation).
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
  /** Collapse key: occurrence-docs of one recurring series share this so the
   * feed shows ONE item per series, not one per occurrence (#1213). */
  groupKey: string;
  /** How many occurrences this collapsed item represents (>1 = a series). */
  seriesCount?: number;
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
  onOpenActivity,
  dismissed,
  onDismiss,
  onDismissAll,
}: {
  invitations: Invitation[];
  myEmail: string;
  nameForEmail: (email: string) => string;
  lastSeen: number;
  onMarkSeen: () => void;
  onOpenInvitation: (invitation: Invitation) => void;
  onOpenActivity: (invitation: Invitation) => void;
  dismissed: string[];
  onDismiss: (key: string) => void;
  onDismissAll: (keys: string[]) => void;
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
          groupKey: inv.seriesId ? `invite_series_${inv.seriesId}` : `invite_${inv.id}`,
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
          groupKey: inv.seriesId ? `cancelled_series_${inv.seriesId}` : `cancelled_${inv.id}`,
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
            groupKey: inv.seriesId ? `resp_series_${inv.seriesId}_${email}_${resp}` : `resp_${inv.id}_${email}`,
          });
        }
      }
    }
    // #1213: collapse occurrence-docs of one recurring series into a SINGLE feed
    // item, so the invitee answers once and the arranger sees one notification —
    // not one per occurrence. Representative = the earliest upcoming occurrence
    // (so "when" shows the next date + tapping opens that one); recency = the most
    // recent change across the series.
    const groups = new Map<string, FeedItem[]>();
    for (const it of items) {
      const arr = groups.get(it.groupKey);
      if (arr) arr.push(it); else groups.set(it.groupKey, [it]);
    }
    const collapsed: FeedItem[] = [];
    for (const arr of groups.values()) {
      if (arr.length === 1) { collapsed.push(arr[0]); continue; }
      arr.sort((a, b) => a.activityDate.localeCompare(b.activityDate));
      const rep: FeedItem = { ...arr[0] };
      rep.ts = Math.max(...arr.map((x) => x.ts));
      rep.seriesCount = arr.length;
      rep.subtitle = `${rep.subtitle} · hele serien`;
      collapsed.push(rep);
    }
    collapsed.sort((a, b) => b.ts - a.ts || b.activityDate.localeCompare(a.activityDate));
    return collapsed;
  }, [invitations, lowerMe, nameForEmail]);

  // What the bell shows: pending invites (always, until answered) plus
  // informational items (responses / cancellations) that the user hasn't yet
  // cleared. Cleared keys are persisted per-user so a dismissed item stays gone
  // across devices and reloads — the tray no longer empties just because the
  // panel closed.
  const dismissedSet = useMemo(() => new Set(dismissed), [dismissed]);
  const visibleFeed = useMemo(
    () => feed.filter((f) => f.kind === 'invite' || !dismissedSet.has(f.key)),
    [feed, dismissedSet],
  );

  // Keys of the items "Slet alle" would clear (everything except pending invites,
  // which stay until they're actually answered).
  const dismissibleKeys = useMemo(
    () => visibleFeed.filter((f) => f.kind !== 'invite').map((f) => f.key),
    [visibleFeed],
  );

  // Advance the "seen" marker when the panel CLOSES (not on open), so the blue
  // "new" highlight clears on the next open. Items themselves stay until cleared.
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
            <div className={`px-4 py-3 border-b flex items-start justify-between gap-2 ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-ds-text'}`}>Notifikationer</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                  {visibleFeed.length > 0 ? `${visibleFeed.length} ${visibleFeed.length === 1 ? 'opdatering' : 'opdateringer'}` : 'Du er ajour'}
                </p>
              </div>
              {dismissibleKeys.length > 0 && (
                <button
                  onClick={() => onDismissAll(dismissibleKeys)}
                  className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}
                >
                  Slet alle
                </button>
              )}
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
                // Informational items (responses, cancellations) can be cleared;
                // pending invites stay until they're actually answered.
                const dismissible = f.kind !== 'invite';
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
                const rowClass = `flex items-stretch border-b last:border-b-0 ${isDark ? 'border-slate-700/60' : 'border-surface-border'} ${newBg}`;
                const tapClass = `flex-1 min-w-0 text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${isDark ? 'hover:bg-slate-700' : 'hover:bg-surface-hover'}`;
                return (
                  <div key={f.key} className={rowClass}>
                    <button
                      onClick={() => {
                        // Tapping an informational item also clears it; pending
                        // invites are left in place (they resolve on answer).
                        if (dismissible) onDismiss(f.key);
                        setOpen(false);
                        // A response I received opens the activity's full detail
                        // sheet; invites/cancellations open the invitation sheet.
                        if (f.kind === 'response') onOpenActivity(f.invitation);
                        else onOpenInvitation(f.invitation);
                      }}
                      className={tapClass}
                    >
                      {content}
                    </button>
                    {dismissible && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDismiss(f.key); }}
                        className={`shrink-0 px-3 flex items-center transition-colors ${isDark ? 'text-slate-500 hover:text-red-300 hover:bg-slate-700' : 'text-ds-text-subtlest hover:text-red-600 hover:bg-surface-hover'}`}
                        title="Fjern notifikation"
                        aria-label="Fjern notifikation"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
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
