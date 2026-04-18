// @ts-nocheck
/**
 * RolesPage — Admin page for managing team member roles.
 * Reads/writes to the Firestore config doc at public/data/config/roles.
 */
import React, { useState } from 'react';
import { UserPlus, Trash2, Shield, Users, Dumbbell } from 'lucide-react';
import { useRolesConfig, type RolesConfig } from '../hooks/useRolesConfig';

type UserRole = 'fighter' | 'coach' | 'admin';

const ROLE_LABELS: Record<UserRole, string> = { fighter: 'Fighter', coach: 'Coach', admin: 'Admin' };
const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <Shield className="w-4 h-4" />,
  coach: <Users className="w-4 h-4" />,
  fighter: <Dumbbell className="w-4 h-4" />,
};
const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  coach: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  fighter: 'text-slate-300 bg-slate-700/50 border-slate-600',
};

export default function RolesPage({ isDark }: { isDark: boolean }) {
  const { config, loading, userMapping, addMember, removeMember, updateRole } = useRolesConfig();
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('fighter');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (loading) return <div className="p-6 text-center text-slate-500">Loader roller...</div>;
  if (!config) return <div className="p-6 text-center text-red-400">Rolle-konfigurationen kunne ikke indlæses.</div>;

  const sortedEmails = Object.keys(userMapping).sort((a, b) => {
    const roleOrder: Record<UserRole, number> = { admin: 0, coach: 1, fighter: 2 };
    return roleOrder[userMapping[a].role] - roleOrder[userMapping[b].role] || userMapping[a].name.localeCompare(userMapping[b].name);
  });

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    if (!email || !name) return;
    if (userMapping[email]) return; // already exists
    await addMember(email, name, newRole);
    setNewEmail('');
    setNewName('');
    setNewRole('fighter');
  };

  const handleRemove = async (email: string) => {
    await removeMember(email);
    setConfirmDelete(null);
  };

  const bg = isDark ? 'bg-slate-900' : 'bg-white';
  const border = isDark ? 'border-slate-700' : 'border-surface-border';
  const text = isDark ? 'text-slate-200' : 'text-ds-text';
  const textSub = isDark ? 'text-slate-400' : 'text-ds-text-subtle';
  const inputBg = isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-surface-subtle border-surface-border text-ds-text';

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-ds-text'}`}>Holdroller</h2>
        <p className={`text-sm mt-1 ${textSub}`}>Administrer hvem der har adgang til FightWeek og deres rolle.</p>
      </div>

      {/* Add member form */}
      <div className={`rounded-xl border p-4 space-y-3 ${bg} ${border}`}>
        <h3 className={`text-sm font-semibold ${text}`}>Tilføj medlem</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm ${inputBg}`}
          />
          <input
            type="text"
            placeholder="Navn"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className={`w-32 px-3 py-2 rounded-lg border text-sm ${inputBg}`}
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as UserRole)}
            className={`w-28 px-3 py-2 rounded-lg border text-sm ${inputBg}`}
          >
            <option value="fighter">Fighter</option>
            <option value="coach">Coach</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!newEmail.trim() || !newName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Tilføj
          </button>
        </div>
      </div>

      {/* Members list */}
      <div className={`rounded-xl border overflow-hidden ${bg} ${border}`}>
        <div className={`px-4 py-3 border-b ${border}`}>
          <h3 className={`text-sm font-semibold ${text}`}>Medlemmer ({sortedEmails.length})</h3>
        </div>
        <div className="divide-y divide-slate-700/50">
          {sortedEmails.map(email => {
            const member = userMapping[email];
            return (
              <div key={email} className={`flex items-center justify-between px-4 py-3 ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-surface-hover'} transition-colors`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-surface-hover text-ds-text'}`}>
                    {member.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${text}`}>{member.name}</div>
                    <div className={`text-xs truncate ${textSub}`}>{email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Role selector */}
                  <select
                    value={member.role}
                    onChange={e => updateRole(email, e.target.value as UserRole)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium border ${ROLE_COLORS[member.role]} ${isDark ? 'bg-slate-800' : 'bg-surface-subtle'}`}
                  >
                    <option value="fighter">Fighter</option>
                    <option value="coach">Coach</option>
                    <option value="admin">Admin</option>
                  </select>
                  {/* Delete */}
                  {confirmDelete === email ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleRemove(email)} className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-500">Slet</button>
                      <button onClick={() => setConfirmDelete(null)} className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-surface-hover text-ds-text'}`}>Nej</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(email)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800' : 'text-ds-text-subtlest hover:text-red-500 hover:bg-surface-hover'}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className={`flex gap-4 text-xs ${textSub}`}>
        {(['admin', 'coach', 'fighter'] as UserRole[]).map(role => (
          <span key={role} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${ROLE_COLORS[role]}`}>{ROLE_ICONS[role]}</span>
            {ROLE_LABELS[role]}
          </span>
        ))}
      </div>
    </div>
  );
}
