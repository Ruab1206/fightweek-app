/**
 * Export all FightWeek data as downloadable JSON files.
 * Called from the admin UI when logged in as a team member.
 *
 * This runs in the browser context (has Firebase auth + Firestore access)
 * and saves snapshots that the AI agent can read from the data/ folder.
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PUBLIC_DATA_PATH, FIGHTERS } from '../config/constants';
import { getISOWeek } from '../utils/dateUtils';

export interface DataSnapshot {
  exportedAt: string;
  exportedBy: string;
  storyMap: any | null;
  backlog: any[];
  feedback: any[];
  fighters: Record<string, { currentWeek: any | null; standardTemplate: any | null }>;
}

/** Read all data from Firestore and return as a single object. */
export async function readAllData(): Promise<DataSnapshot> {
  const week = getISOWeek();
  const snapshot: DataSnapshot = {
    exportedAt: new Date().toISOString(),
    exportedBy: 'admin-ui',
    storyMap: null,
    backlog: [],
    feedback: [],
    fighters: {},
  };

  // Story map
  try {
    const smSnap = await getDoc(doc(db, PUBLIC_DATA_PATH, 'story-map', 'main'));
    if (smSnap.exists()) snapshot.storyMap = smSnap.data();
  } catch (e) { console.warn('[snapshot] story map read failed:', e); }

  // Backlog
  try {
    const bSnap = await getDocs(collection(db, PUBLIC_DATA_PATH, 'backlog'));
    bSnap.forEach(d => snapshot.backlog.push({ id: d.id, ...d.data() }));
  } catch (e) { console.warn('[snapshot] backlog read failed:', e); }

  // Feedback
  try {
    const fSnap = await getDocs(collection(db, PUBLIC_DATA_PATH, 'feedback'));
    fSnap.forEach(d => snapshot.feedback.push({ id: d.id, ...d.data() }));
  } catch (e) { console.warn('[snapshot] feedback read failed:', e); }

  // Fighter data
  const ROOT = 'artifacts/production/users';
  for (const name of FIGHTERS) {
    snapshot.fighters[name] = { currentWeek: null, standardTemplate: null };
    try {
      const wSnap = await getDoc(doc(db, ROOT, name, 'weeks', `week_${week}`));
      if (wSnap.exists()) snapshot.fighters[name].currentWeek = wSnap.data();
    } catch (e) { /* may not exist */ }
    try {
      const tSnap = await getDoc(doc(db, ROOT, name, 'templates', 'standard'));
      if (tSnap.exists()) snapshot.fighters[name].standardTemplate = tSnap.data();
    } catch (e) { /* may not exist */ }
  }

  return snapshot;
}

/** Trigger a browser download of the full snapshot as JSON. */
export async function downloadSnapshot(): Promise<{ ok: boolean; summary: string }> {
  try {
    const data = await readAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fightweek-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const sm = data.storyMap;
    const summary = [
      sm ? `Story map: ${sm.activities?.length ?? 0}A/${sm.tasks?.length ?? 0}T/${sm.slices?.length ?? 0}S` : 'Story map: missing',
      `Backlog: ${data.backlog.length} items`,
      `Feedback: ${data.feedback.length}`,
      `Fighters: ${Object.entries(data.fighters).filter(([, v]) => v.currentWeek || v.standardTemplate).length}/${FIGHTERS.length} with data`,
    ].join(' · ');

    return { ok: true, summary };
  } catch (e) {
    return { ok: false, summary: `Error: ${e instanceof Error ? e.message : String(e)}` };
  }
}
