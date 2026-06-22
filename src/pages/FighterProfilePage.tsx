// ──────────────────────────────────────────────
// FighterProfilePage (#1058 / 1.12) — Public, read-only fighter profile.
// Route: /fighter/:key  (key = the fighter's email, the stable id from #1191).
// No authentication required. Only PUBLISHED profiles are shown to the public;
// unpublished/missing profiles render a neutral "not available" state.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sun, Moon, MapPin, Ruler, Calendar, Award, PlayCircle, Mail, ShieldCheck } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { getProfile } from '../services/firebaseProfileService';
import { formatRecord } from '../types/profile';
import type { FighterProfile } from '../types/profile';

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('da-DK', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function FighterProfilePage() {
  const { key = '' } = useParams<{ key: string }>();
  const emailKey = decodeURIComponent(key);
  const { isDark, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<FighterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getProfile(emailKey)
      .then((p) => { if (active) setProfile(p); })
      .catch(() => { if (active) setProfile(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [emailKey]);

  // The public sees a profile only if it exists AND is published. A signed-in
  // team member could read a draft via rules, but this public page intentionally
  // gates on `published` so a shared link never reveals a draft.
  const visible = !!profile && profile.published;

  const bg = isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text';
  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border';
  const subtle = isDark ? 'text-slate-400' : 'text-ds-text-subtle';

  const stats = useMemo(() => {
    if (!profile) return [];
    return [
      { label: 'Age', value: profile.age != null ? `${profile.age}` : null, icon: Calendar },
      { label: 'Height', value: profile.heightCm != null ? `${profile.heightCm} cm` : null, icon: Ruler },
      { label: 'Reach', value: profile.reachCm != null ? `${profile.reachCm} cm` : null, icon: Ruler },
      { label: 'Stance', value: profile.stance || null, icon: ShieldCheck },
    ].filter((s) => s.value);
  }, [profile]);

  return (
    <div className={`min-h-screen font-sans ${bg}`}>
      {/* Header */}
      <div className={`p-4 border-b sticky top-0 z-20 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-ds-text'}`}>FightWeek</h1>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`w-8 h-8 flex items-center justify-center rounded-full ${isDark ? 'text-slate-400 hover:text-white' : 'text-ds-text-subtle hover:text-ds-text'}`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {loading && (
          <p className={`text-center py-16 ${subtle}`}>Loading…</p>
        )}

        {!loading && !visible && (
          <div className={`rounded-2xl border p-8 text-center ${card}`}>
            <h2 className="font-semibold text-lg mb-1">Profile not available</h2>
            <p className={subtle}>This fighter profile doesn’t exist or hasn’t been published yet.</p>
          </div>
        )}

        {!loading && visible && profile && (
          <article className="space-y-4">
            {/* Hero: the decision-relevant facts above the fold */}
            <header className={`rounded-2xl border p-5 ${card}`}>
              <div className="flex items-start gap-4">
                {profile.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={profile.name}
                    className="w-20 h-20 rounded-xl object-cover bg-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-slate-700 flex items-center justify-center text-2xl font-bold text-white shrink-0">
                    {profile.name.charAt(0) || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className={`text-2xl font-bold leading-tight ${isDark ? 'text-white' : 'text-ds-text'}`}>{profile.name}</h2>
                  <p className={`text-sm ${subtle}`}>
                    {profile.level === 'professional' ? 'Professional' : 'Amateur'}
                    {profile.weightClass ? ` · ${profile.weightClass}` : ''}
                  </p>
                  {profile.gym && (
                    <p className={`text-sm flex items-center gap-1 mt-1 ${subtle}`}>
                      <MapPin className="w-3.5 h-3.5" /> {profile.gym}
                    </p>
                  )}
                </div>
              </div>

              {/* Record — the headline metric */}
              <div className="mt-4 flex flex-wrap gap-3">
                <div className={`rounded-xl px-4 py-2 ${isDark ? 'bg-slate-800' : 'bg-surface-subtle'}`}>
                  <div className={`text-[11px] uppercase tracking-wide ${subtle}`}>Record</div>
                  <div className="text-xl font-bold">{formatRecord(profile.record)}</div>
                </div>
                {profile.disciplines && (
                  <div className={`rounded-xl px-4 py-2 ${isDark ? 'bg-slate-800' : 'bg-surface-subtle'}`}>
                    <div className={`text-[11px] uppercase tracking-wide ${subtle}`}>Style</div>
                    <div className="text-base font-semibold">{profile.disciplines}</div>
                  </div>
                )}
              </div>
            </header>

            {/* Physical attributes */}
            {stats.length > 0 && (
              <section className={`rounded-2xl border p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 ${card}`}>
                {stats.map((s) => (
                  <div key={s.label}>
                    <div className={`text-[11px] uppercase tracking-wide flex items-center gap-1 ${subtle}`}>
                      <s.icon className="w-3 h-3" /> {s.label}
                    </div>
                    <div className="text-base font-semibold">{s.value}</div>
                  </div>
                ))}
              </section>
            )}

            {/* Accomplishments */}
            {profile.accomplishments && (
              <section className={`rounded-2xl border p-5 ${card}`}>
                <h3 className="font-semibold flex items-center gap-2 mb-1"><Award className="w-4 h-4" /> Accomplishments</h3>
                <p className={`whitespace-pre-line ${subtle}`}>{profile.accomplishments}</p>
              </section>
            )}

            {/* Footage + contact — the next actions */}
            <section className="flex flex-wrap gap-3">
              {profile.footageUrl && (
                <a
                  href={profile.footageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[140px] rounded-xl px-4 py-3 font-semibold text-white bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" /> Watch footage
                </a>
              )}
              {profile.contact && (
                <a
                  href={profile.contact.includes('@') && !profile.contact.startsWith('http') ? `mailto:${profile.contact}` : profile.contact}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex-1 min-w-[140px] rounded-xl px-4 py-3 font-semibold flex items-center justify-center gap-2 ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-ds-text text-white hover:opacity-90'}`}
                >
                  <Mail className="w-4 h-4" /> Contact
                </a>
              )}
            </section>

            {/* Credibility signal */}
            <p className={`text-xs text-center pt-2 ${subtle}`}>
              Curated by the FightWeek team{profile.updatedAt ? ` · updated ${formatUpdated(profile.updatedAt)}` : ''}
            </p>
          </article>
        )}
      </div>
    </div>
  );
}
