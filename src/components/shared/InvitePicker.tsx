/**
 * InvitePicker — pick FightWeek users to invite to an activity (#1201, 1.14).
 *
 * A compact multi-select chip list. The parent owns the selected emails and
 * decides what to do with them (create the invitation on save). Already-invited
 * members are shown with their current response and cannot be toggled off here.
 */
import { UserPlus, Check } from 'lucide-react';
import { responseLabel, type InvitationResponse } from '../../types/invitation';

export interface InviteCandidate {
  email: string;
  name: string;
}

export function InvitePicker({
  candidates,
  selected,
  onToggle,
  existing = {},
  isDark,
}: {
  candidates: InviteCandidate[];
  selected: string[];          // selected emails (lower-case)
  onToggle: (email: string) => void;
  existing?: Record<string, InvitationResponse>; // already-invited email → response
  isDark: boolean;
}) {
  const labelCls = `text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`;

  if (candidates.length === 0) {
    return (
      <div>
        <label className={labelCls}>Inviter</label>
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>Ingen andre at invitere endnu.</p>
      </div>
    );
  }

  return (
    <div>
      <label className={labelCls}>
        <span className="inline-flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5" /> Inviter holdkammerater
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {candidates.map((c) => {
          const email = c.email.toLowerCase();
          const already = existing[email];
          const isSelected = selected.includes(email);
          // Already-invited members are shown as static chips and can't be re-toggled —
          // EXCEPT people who declined: they get a "Inviter igen" button so a fresh
          // invite resets them to pending (#1201 re-invite-after-decline).
          if (already && already !== 'declined') {
            return (
              <span key={email}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-surface-subtle border-surface-border text-ds-text-subtle'}`}
                title={`Allerede inviteret — ${responseLabel(already)}`}>
                {c.name}
                <span className="opacity-70">· {responseLabel(already)}</span>
              </span>
            );
          }
          if (already === 'declined') {
            return (
              <button key={email} type="button" onClick={() => onToggle(email)}
                title="Afslog tidligere — inviter igen"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : (isDark ? 'bg-red-900/30 border-red-800 text-red-300 hover:bg-red-900/50' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100')
                }`}>
                {isSelected ? <Check className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                {c.name}
                <span className="opacity-70">· {isSelected ? 'Inviteres igen' : 'Inviter igen'}</span>
              </button>
            );
          }
          return (
            <button key={email} type="button" onClick={() => onToggle(email)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : (isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-surface-border text-ds-text hover:bg-surface-hover')
              }`}>
              {isSelected && <Check className="w-3 h-3" />}
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
