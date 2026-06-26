/**
 * InvitationBell — header bell that surfaces invitations awaiting your answer
 * (#1201, 1.14). So an invite weeks away isn't missed, the bell shows a count of
 * your unanswered invitations; tapping it lists them (soonest first) and each row
 * opens the RSVP sheet. The badge clears as you respond.
 */
import { useState, useMemo } from 'react';
import { Bell, UserPlus, CalendarDays } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { Invitation } from '../types/invitation';

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

export function InvitationBell({
  invitations,
  myEmail,
  onOpenInvitation,
}: {
  invitations: Invitation[];
  myEmail: string;
  onOpenInvitation: (invitation: Invitation) => void;
}) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const lowerMe = myEmail.toLowerCase();

  // Invitations awaiting my answer: I'm invited, haven't replied yet, and neither
  // the whole activity nor my own place has been cancelled. Soonest first.
  const pending = useMemo(() => {
    return invitations
      .filter((inv) => {
        if (inv.status === 'cancelled') return false;
        const mine = inv.invitees?.[lowerMe];
        return mine === 'pending';
      })
      .sort((a, b) => a.activity.date.localeCompare(b.activity.date));
  }, [invitations, lowerMe]);

  const count = pending.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}
        title={count > 0 ? `${count} ${count === 1 ? 'invitation venter på svar' : 'invitationer venter på svar'}` : 'Invitationer'}
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 top-12 w-72 max-w-[85vw] rounded-xl border shadow-xl z-40 overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-surface-border'}`}>
            <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-surface-border'}`}>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-ds-text'}`}>Invitationer</p>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                {count > 0 ? `${count} venter på dit svar` : 'Du er ajour'}
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {count === 0 && (
                <div className={`px-4 py-6 text-center text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                  Ingen invitationer venter på svar.
                </div>
              )}
              {pending.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => { setOpen(false); onOpenInvitation(inv); }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b last:border-b-0 ${isDark ? 'border-slate-700/60 hover:bg-slate-700' : 'border-surface-border hover:bg-surface-hover'}`}
                >
                  <span className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                    <UserPlus className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-bold truncate ${isDark ? 'text-white' : 'text-ds-text'}`}>{inv.activity.title}</span>
                    <span className={`block text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                      Fra {inv.invitedByName || inv.invitedBy}
                    </span>
                    <span className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      <CalendarDays className="w-3 h-3" />
                      {formatDateDa(inv.activity.date)} · {relativeWhen(inv.activity.date)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
