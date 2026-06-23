// ──────────────────────────────────────────────
// ProfileEditPage (#1079 + #1195 / 1.12 — Fighter Profiles)
// Route: /profile  (authenticated).
//   • A fighter edits their OWN profile (doc key = their email).
//   • A coach/admin can pick any fighter and edit theirs.
// Publish/unpublish toggle (#1195): profiles are draft by default; only a
// published profile is visible on the public /fighter/:key page.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Save, ExternalLink, LogOut, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../config/firebase';
import { USER_MAPPING } from '../config/constants';
import { subscribeProfile, saveProfile } from '../services/firebaseProfileService';
import { emptyFighterProfile } from '../types/profile';
import type { FighterProfile, FighterLevel } from '../types/profile';

export default function ProfileEditPage() {
  const { isDark, toggleTheme } = useTheme();
  const {
    user, authLoading, accessDenied, loginError,
    isBrowserBlocked, isMobile,
    triggerLoginPopup, triggerLoginRedirect, handleLogout,
  } = useAuth();

  // Firebase Auth syncs across browser tabs. Opening the public page in another
  // tab can desync this tab's session to null, and (unlike a transient flicker)
  // it only rehydrates on a page load. We tell the two apart with a short delay:
  //  • brief null (HMR/StrictMode/normal re-resolve) → recovers on its own, ignore.
  //  • null persisting past the delay with no auth.currentUser → a real drop;
  //    reload once (the known cure) to rehydrate, guarded against reload loops.
  const RELOAD_KEY = 'profileAuthReloadAt';
  const wasAuthedRef = useRef(false);
  const [authDropped, setAuthDropped] = useState(false);

  useEffect(() => {
    if (user) {
      wasAuthedRef.current = true;
      setAuthDropped(false);
      sessionStorage.removeItem(RELOAD_KEY);
      return;
    }
    if (authLoading || !wasAuthedRef.current) return;
    const t = setTimeout(() => { if (!auth.currentUser) setAuthDropped(true); }, 1500);
    return () => clearTimeout(t);
  }, [user, authLoading]);

  useEffect(() => {
    if (!authDropped) return;
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    if (Date.now() - last < 15000) return; // already reloaded recently → stop, show banner
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }, [authDropped]);

  const reconnecting = authDropped;
  const signOut = () => { wasAuthedRef.current = false; setAuthDropped(false); handleLogout(); };

  const email = user?.email ? user.email.toLowerCase() : '';
  const me = email ? USER_MAPPING[email] : undefined;
  const canEditAny = me?.role === 'coach' || me?.role === 'admin';

  // Fighters a coach/admin may pick from (role === 'fighter').
  const fighterOptions = useMemo(
    () =>
      Object.entries(USER_MAPPING)
        .filter(([, v]) => v.role === 'fighter')
        .map(([e, v]) => ({ email: e, name: v.name })),
    [],
  );

  // Which profile is being edited. A fighter is locked to their own email; a
  // coach/admin defaults to themselves (if a fighter) else the first fighter.
  const [targetKey, setTargetKey] = useState('');
  useEffect(() => {
    if (!email) return;
    if (canEditAny) {
      setTargetKey((prev) => prev || (me?.role === 'fighter' ? email : fighterOptions[0]?.email ?? email));
    } else {
      setTargetKey(email);
    }
  }, [email, canEditAny, me?.role, fighterOptions]);

  const [form, setForm] = useState<FighterProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live-load the selected profile (or a blank draft if none exists yet).
  useEffect(() => {
    if (!targetKey || !user) return;
    setLoading(true);
    const fallbackName = USER_MAPPING[targetKey]?.name ?? '';
    const unsub = subscribeProfile(
      targetKey,
      (p) => {
        setForm(p ?? emptyFighterProfile(targetKey, fallbackName));
        setLoading(false);
      },
      (err) => { setError(err.message); setLoading(false); },
    );
    return () => unsub();
  }, [targetKey, user]);

  const set = <K extends keyof FighterProfile>(field: K, value: FighterProfile[K]) =>
    setForm((f) => (f ? { ...f, [field]: value } : f));

  const setRecord = (field: keyof FighterProfile['record'], value: number) =>
    setForm((f) => (f ? { ...f, record: { ...f.record, [field]: value } } : f));

  const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v));

  // Single persist path: writes to Firestore and reflects the saved object back
  // into the form. Both "Save" and the publish toggle go through here so a click
  // on Publish actually stores published:true (no separate Save needed).
  const persist = async (next: FighterProfile) => {
    // A Firestore write needs a live auth token. If the session has dropped
    // (auth.currentUser is null) writing would hit the rules with no token
    // ("Missing or insufficient permissions"). Block until it rehydrates.
    if (!auth.currentUser) {
      setError('Reconnecting your sign-in — please wait a moment and try again.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProfile(next);
      setForm(next);
      setSavedAt(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => { if (form) persist(form); };

  // Publish/unpublish saves immediately so the public page reflects it at once.
  const handleTogglePublish = () => { if (form) persist({ ...form, published: !form.published }); };

  // ── Theme tokens ──
  const bg = isDark ? 'bg-slate-950 text-slate-200' : 'bg-surface-subtle text-ds-text';
  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border';
  const subtle = isDark ? 'text-slate-400' : 'text-ds-text-subtle';
  const inputCls = `w-full rounded-lg px-3 py-2 text-sm border ${
    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-surface-border text-ds-text'
  }`;
  const labelCls = `text-[11px] uppercase tracking-wide font-semibold ${subtle}`;

  // ── Header (shared) ──
  const header = (
    <div className={`p-4 border-b sticky top-0 z-20 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-ds-text'}`}>Edit profile</h1>
        <div className="flex items-center gap-1">
          {user && (
            <button
              onClick={signOut}
              aria-label="Sign out"
              className={`w-8 h-8 flex items-center justify-center rounded-full ${isDark ? 'text-slate-400 hover:text-white' : 'text-ds-text-subtle hover:text-ds-text'}`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`w-8 h-8 flex items-center justify-center rounded-full ${isDark ? 'text-slate-400 hover:text-white' : 'text-ds-text-subtle hover:text-ds-text'}`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );

  // ── In-app browser block ──
  if (isBrowserBlocked) {
    return (
      <div className={`min-h-screen font-sans ${bg}`}>
        {header}
        <div className="max-w-2xl mx-auto p-4">
          <div className={`rounded-2xl border p-8 text-center ${card}`}>
            <p>Please open this page in Safari or Chrome to sign in.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading auth ──
  if (authLoading) {
    return (
      <div className={`min-h-screen font-sans ${bg}`}>
        {header}
        <p className={`text-center py-16 ${subtle}`}>Loading…</p>
      </div>
    );
  }

  // ── Signed out → sign-in prompt ──
  // Only when we have never authenticated (or after an explicit sign-out). A
  // transient cross-tab null while wasAuthedRef is set falls through to the
  // editor, which keeps the already-loaded form and self-heals when auth returns.
  if (!user && !wasAuthedRef.current) {
    return (
      <div className={`min-h-screen font-sans ${bg}`}>
        {header}
        <div className="max-w-2xl mx-auto p-4">
          <div className={`rounded-2xl border p-8 text-center space-y-4 ${card}`}>
            <h2 className="font-semibold text-lg">Sign in to edit your profile</h2>
            <p className={subtle}>Use the Google account you train with.</p>
            <button
              onClick={isMobile ? triggerLoginRedirect : triggerLoginPopup}
              className="rounded-xl px-5 py-3 font-semibold text-white bg-red-600 hover:bg-red-700"
            >
              Sign in with Google
            </button>
            {loginError && <p className="text-sm text-red-500">{loginError}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Signed in but not on the roster ──
  // Guard on `user` so a transient cross-tab null (user undefined, me undefined)
  // doesn't momentarily render "No access".
  if (user && (accessDenied || !me)) {
    return (
      <div className={`min-h-screen font-sans ${bg}`}>
        {header}
        <div className="max-w-2xl mx-auto p-4">
          <div className={`rounded-2xl border p-8 text-center space-y-3 ${card}`}>
            <h2 className="font-semibold text-lg">No access</h2>
            <p className={subtle}>This account isn’t on the FightWeek roster.</p>
            <button onClick={signOut} className={`text-sm underline ${subtle}`}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Editor ──
  return (
    <div className={`min-h-screen font-sans ${bg}`}>
      {header}
      <div className="max-w-2xl mx-auto p-4 space-y-4 pb-28">
        {/* Reconnecting banner: auth is momentarily resolving (e.g. just opened
            the public page in another tab). Saving is paused until it heals. */}
        {reconnecting && (
          <div className="rounded-2xl border border-amber-400 bg-amber-50 text-amber-900 p-4 flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Reconnecting your sign-in… saving is paused for a moment.</span>
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-semibold underline shrink-0"
            >
              Refresh now
            </button>
          </div>
        )}

        {/* Coach/admin: pick whose profile to edit */}
        {canEditAny && (
          <div className={`rounded-2xl border p-4 ${card}`}>
            <label className={labelCls}>Editing profile for</label>
            <select
              value={targetKey}
              onChange={(e) => setTargetKey(e.target.value)}
              className={`${inputCls} mt-1`}
            >
              {fighterOptions.map((f) => (
                <option key={f.email} value={f.email}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        {loading || !form ? (
          <p className={`text-center py-16 ${subtle}`}>Loading…</p>
        ) : (
          <>
            {/* Publish state (#1195) */}
            <div className={`rounded-2xl border p-4 flex items-center justify-between ${card}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  form.published
                    ? 'bg-green-600 text-white'
                    : isDark ? 'bg-slate-700 text-slate-200' : 'bg-surface-subtle text-ds-text-subtle'
                }`}>
                  {form.published ? 'Published' : 'Draft'}
                </span>
                <span className={`text-sm ${subtle}`}>
                  {form.published ? 'Visible to anyone with the link.' : 'Only the team can see this.'}
                </span>
              </div>
              <button
                onClick={handleTogglePublish}
                disabled={saving || reconnecting}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                  form.published
                    ? (isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-surface-subtle text-ds-text hover:opacity-90')
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {form.published ? <><EyeOff className="w-4 h-4" /> Unpublish</> : <><Eye className="w-4 h-4" /> Publish</>}
              </button>
            </div>

            {/* Basics */}
            <section className={`rounded-2xl border p-5 space-y-3 ${card}`}>
              <h3 className="font-semibold">Basics</h3>
              <div>
                <label className={labelCls}>Name</label>
                <input className={`${inputCls} mt-1`} value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Photo URL</label>
                <input className={`${inputCls} mt-1`} value={form.photoUrl} placeholder="https://…" onChange={(e) => set('photoUrl', e.target.value)} />
                {form.photoUrl && (
                  <img src={form.photoUrl} alt="" className="mt-2 w-16 h-16 rounded-xl object-cover bg-slate-700" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Level</label>
                  <select className={`${inputCls} mt-1`} value={form.level} onChange={(e) => set('level', e.target.value as FighterLevel)}>
                    <option value="amateur">Amateur</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Weight class</label>
                  <input className={`${inputCls} mt-1`} value={form.weightClass} placeholder="e.g. Lightweight" onChange={(e) => set('weightClass', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Gym</label>
                <input className={`${inputCls} mt-1`} value={form.gym} onChange={(e) => set('gym', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Style / disciplines</label>
                <input className={`${inputCls} mt-1`} value={form.disciplines} placeholder="e.g. Striker, BJJ" onChange={(e) => set('disciplines', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  className={`${inputCls} mt-1`}
                  rows={4}
                  value={form.description}
                  placeholder="A few sentences a promoter can read at a glance — fighting style, story, what makes this fighter stand out."
                  onChange={(e) => set('description', e.target.value)}
                />
              </div>
            </section>

            {/* Record */}
            <section className={`rounded-2xl border p-5 space-y-3 ${card}`}>
              <h3 className="font-semibold">Record</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Wins</label>
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={form.record.wins} onChange={(e) => setRecord('wins', Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>Losses</label>
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={form.record.losses} onChange={(e) => setRecord('losses', Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>Draws</label>
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={form.record.draws} onChange={(e) => setRecord('draws', Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>KO wins</label>
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={form.record.koWins} onChange={(e) => setRecord('koWins', Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>Sub wins</label>
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={form.record.subWins} onChange={(e) => setRecord('subWins', Number(e.target.value))} />
                </div>
              </div>
            </section>

            {/* Physical */}
            <section className={`rounded-2xl border p-5 space-y-3 ${card}`}>
              <h3 className="font-semibold">Physical</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Age</label>
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={form.age ?? ''} onChange={(e) => set('age', numOrNull(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>Height (cm)</label>
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={form.heightCm ?? ''} onChange={(e) => set('heightCm', numOrNull(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>Reach (cm)</label>
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={form.reachCm ?? ''} onChange={(e) => set('reachCm', numOrNull(e.target.value))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Stance</label>
                <input className={`${inputCls} mt-1`} value={form.stance} placeholder="Orthodox / Southpaw" onChange={(e) => set('stance', e.target.value)} />
              </div>
            </section>

            {/* Story */}
            <section className={`rounded-2xl border p-5 space-y-3 ${card}`}>
              <h3 className="font-semibold">Story & links</h3>
              <div>
                <label className={labelCls}>Accomplishments</label>
                <textarea className={`${inputCls} mt-1 min-h-[100px]`} value={form.accomplishments} onChange={(e) => set('accomplishments', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Fight footage URL</label>
                <input className={`${inputCls} mt-1`} value={form.footageUrl} placeholder="YouTube / Vimeo link" onChange={(e) => set('footageUrl', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Contact (email or link)</label>
                <input className={`${inputCls} mt-1`} value={form.contact} onChange={(e) => set('contact', e.target.value)} />
              </div>
            </section>

            <Link
              to={`/fighter/${encodeURIComponent(targetKey)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-sm ${subtle} hover:underline`}
            >
              <ExternalLink className="w-3.5 h-3.5" /> View public page
            </Link>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </>
        )}
      </div>

      {/* Sticky save bar */}
      {form && !loading && (
        <div className={`fixed bottom-0 inset-x-0 border-t p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <span className={`text-xs ${subtle}`}>{reconnecting ? 'Reconnecting…' : savedAt ? `Saved at ${savedAt}` : 'Unsaved changes are not stored until you save.'}</span>
            <button
              onClick={handleSave}
              disabled={saving || reconnecting}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
