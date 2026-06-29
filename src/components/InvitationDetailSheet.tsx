/**
 * InvitationDetailSheet — view an invitation and respond to it (#1201, 1.14).
 *
 * Opened when a user taps an invitation on their calendar. The invitee sees the
 * activity details and Accept / Tentative / Decline buttons. The inviter
 * additionally sees the full invitee list with everyone's response ("who's
 * coming") and can cancel the invitation.
 */
import { ArrowLeft, MapPin, Clock, CalendarDays, Trash2, UserPlus, AlertCircle, CalendarX } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import {
  INVITATION_RESPONSE_OPTIONS, responseLabel,
  type Invitation, type InvitationResponse,
} from '../types/invitation';

function formatDateDa(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Colour-coded pill classes (bg + text) for an invitee's response, for the overview list. */
function responseChip(status: InvitationResponse | undefined, isDark: boolean): string {
  switch (status) {
    case 'accepted': return isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700';
    case 'tentative': return isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700';
    case 'declined': return isDark ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700';
    case 'pending':
    default: return isDark ? 'bg-slate-800 text-slate-400' : 'bg-surface-subtle text-ds-text-subtle';
  }
}

export function InvitationDetailSheet({
  invitation,
  myEmail,
  nameForEmail,
  onRespond,
  onOptOutOccurrence,
  onCancel,
  onDismiss,
  onClose,
}: {
  invitation: Invitation;
  myEmail: string;
  nameForEmail: (email: string) => string;
  onRespond: (response: InvitationResponse) => void;
  /** Opt out of just THIS occurrence of a series (decline one date), keeping the
   * rest of the series response unchanged (#1213). Only used when seriesId set. */
  onOptOutOccurrence?: () => void;
  onCancel: () => void;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const { isDark } = useTheme();
  const lowerMe = myEmail.toLowerCase();
  const isInviter = invitation.invitedBy.toLowerCase() === lowerMe;
  const myStatus = invitation.invitees?.[lowerMe];
  const isSeries = !!invitation.seriesId;
  // The whole activity was called off, or just this person was removed — either
  // way the viewer sees an "Aflyst" notice and can remove it from their calendar.
  const activityCancelled = invitation.status === 'cancelled';
  const meRemoved = myStatus === 'cancelled';
  const isCancelled = activityCancelled || meRemoved;
  // Defensive: only show invitees whose value is a real response string. Legacy
  // docs may contain nested garbage from the old dotted-key write bug. Hide
  // people the arranger removed (`cancelled`) from the "who's coming" list.
  const VALID_RESPONSES = ['pending', 'accepted', 'declined', 'tentative'];
  const inviteeEntries = Object.entries(invitation.invitees || {})
    .filter(([, status]) => typeof status === 'string' && VALID_RESPONSES.includes(status));
  const a = invitation.activity;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t shadow-2xl max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-surface-border'}`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center gap-3 shrink-0 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-ds-text-subtle hover:text-ds-text hover:bg-surface-hover'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-ds-text'}`}>{a.title}</h2>
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
              <UserPlus className="w-3 h-3" /> Invitation fra {invitation.invitedByName || nameForEmail(invitation.invitedBy)}
            </span>
          </div>
          {isInviter && !isCancelled && (
            <button onClick={onCancel} className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 shrink-0" title="Annuller invitation">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Cancelled banner (#1201 step A) */}
          {isCancelled && (
            <div className={`rounded-xl border p-3 flex items-start gap-2 ${isDark ? 'bg-red-950/30 border-red-900/50' : 'bg-red-50 border-red-200'}`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className={`text-sm font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>Aflyst</p>
                <p className={`text-xs ${isDark ? 'text-red-300/80' : 'text-red-600'}`}>
                  {meRemoved && !activityCancelled
                    ? `${invitation.invitedByName || nameForEmail(invitation.invitedBy)} har fjernet dig fra denne aktivitet.`
                    : `${invitation.invitedByName || nameForEmail(invitation.invitedBy)} har aflyst denne aktivitet.`}
                </p>
              </div>
            </div>
          )}
          {/* When + where */}
          <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
            <div className="flex items-center gap-2">
              <CalendarDays className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} />
              <span className={`text-sm font-medium capitalize ${isDark ? 'text-white' : 'text-ds-text'}`}>{formatDateDa(a.date)}</span>
            </div>
            {(a.start || a.end) && (
              <div className="flex items-center gap-2 mt-1.5">
                <Clock className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{a.start}{a.end ? ` – ${a.end}` : ''}</span>
              </div>
            )}
            {a.location && (
              <div className="flex items-center gap-2 mt-1.5">
                <MapPin className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`} />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{a.location}</span>
              </div>
            )}
          </div>

          {/* Your response (invitees only — the inviter is not in the invitees map) */}
          {myStatus && !isCancelled && (
            <div className="space-y-2">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Dit svar</p>
              <div className="flex gap-2">
                {INVITATION_RESPONSE_OPTIONS.map(opt => {
                  const isActive = myStatus === opt.value;
                  return (
                    <button key={opt.value} onClick={() => onRespond(opt.value)}
                      className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-colors ${isActive ? opt.activeColor : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-ds-text border-surface-border hover:bg-surface-hover')}`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {isSeries && (
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>
                  Dit svar gælder hele serien. Du kan stadig melde fra til en enkelt dag nedenfor.
                </p>
              )}
              {myStatus === 'declined' && (
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Du har afslået — invitationen fjernes fra din kalender.</p>
              )}
              {isSeries && onOptOutOccurrence && myStatus !== 'declined' && (
                <button onClick={onOptOutOccurrence}
                  className={`mt-1 w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl border transition-colors ${isDark ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-amber-700 border-surface-border hover:bg-surface-hover'}`}>
                  <CalendarX className="w-4 h-4" /> Jeg kan ikke {formatDateDa(a.date)}
                </button>
              )}
            </div>
          )}

          {/* Remove a cancelled invitation from your own calendar (#1201 step A) */}
          {myStatus && isCancelled && (
            <button onClick={onDismiss}
              className={`w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl border transition-colors ${isDark ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' : 'bg-white text-ds-text border-surface-border hover:bg-surface-hover'}`}>
              <CalendarX className="w-4 h-4" /> Fjern fra kalender
            </button>
          )}

          {/* Who's coming (#1100) — visible to everyone invited, colour-coded */}
          <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Inviterede</p>
            <div className="space-y-1.5">
              {inviteeEntries.length === 0 && (
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Ingen inviterede.</p>
              )}
              {inviteeEntries.map(([email, status]) => (
                <div key={email} className="flex justify-between items-center gap-2 text-sm">
                  <span className={`font-medium truncate ${email === lowerMe ? (isDark ? 'text-white' : 'text-ds-text') : (isDark ? 'text-slate-300' : 'text-ds-text')}`}>
                    {nameForEmail(email)}{email === lowerMe ? ' (dig)' : ''}
                  </span>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${responseChip(status as InvitationResponse, isDark)}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />{responseLabel(status as InvitationResponse)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
