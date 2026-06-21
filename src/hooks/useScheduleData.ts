import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { doc, setDoc, getDoc, onSnapshot, type Unsubscribe, type DocumentData } from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { db } from '../config/firebase';
import { FIGHTERS as DEFAULT_FIGHTERS, ROOT_COLLECTION, resolveFighterKey } from '../config/constants';
import { getISOWeek } from '../utils/dateUtils';

/** Strip virtual event sessions before persisting (events are merged at render time by useEventMerge). */
export function stripEvents(weekData: DocumentData): DocumentData {
  const data = structuredClone(weekData);
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) {
      data[key] = data[key].filter((s: any) => s.type !== 'event');
    }
  }
  return data;
}

/**
 * Materialise the standard-week template for a specific week, applying each
 * session's recurrence pattern. Pure & testable. A session with no/weekly
 * recurrence appears every week; an every-N-weeks session only appears on weeks
 * aligned to its recurrenceStartWeek.
 */
export function filterTemplateForWeek(rawTemplate: DocumentData, weekNum: number): DocumentData {
  const data: Record<string, any> = { lastUpdated: new Date().toISOString() };
  for (const key of Object.keys(rawTemplate)) {
    if (key === 'lastUpdated') continue;
    if (!Array.isArray(rawTemplate[key])) { data[key] = rawTemplate[key]; continue; }
    data[key] = rawTemplate[key].filter((s: any) => {
      if (!s.recurrenceInterval || s.recurrenceInterval <= 1) return true;
      const diff = weekNum - (s.recurrenceStartWeek || weekNum);
      return diff >= 0 && diff % s.recurrenceInterval === 0;
    });
  }
  return data;
}

interface ScheduleDataParams {
  user: User | null;
  activeFighter: string;
  accessDenied: boolean;
  isBrowserBlocked: boolean;
  fighters?: string[];
  emailForName?: Record<string, string>;
}

export function useScheduleData({ user, activeFighter, accessDenied, isBrowserBlocked, fighters, emailForName }: ScheduleDataParams) {
  const fightersKey = fighters ? fighters.join(',') : '';
  const FIGHTERS = useMemo(() => fighters || DEFAULT_FIGHTERS, [fightersKey]);
  const emailMap = useMemo(() => emailForName || {}, [emailForName]);
  // #1191: per-user data is keyed by email in Firestore; resolve the active
  // fighter's display name to their email path key (falls back to the name).
  const activeKey = resolveFighterKey(activeFighter, emailMap);
  // Stable, value-based signature of the team's name→key resolution so the sync
  // effect re-subscribes to the email paths once the roles config loads.
  const teamKeysSig = useMemo(
    () => FIGHTERS.map(f => `${f}:${resolveFighterKey(f, emailMap)}`).join(','),
    [FIGHTERS, emailMap]
  );
  const [systemWeek] = useState(getISOWeek());
  const [currentWeek, setCurrentWeek] = useState(getISOWeek());
  const [scheduleData, setScheduleData] = useState<DocumentData>({});
  const [teamData, setTeamData] = useState<Record<string, DocumentData>>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Data Sync
  useEffect(() => {
    if (!user || accessDenied || isBrowserBlocked) return;
    const docId = `week_${currentWeek}`;

    const docRef = doc(db, ROOT_COLLECTION, activeKey, 'weeks', docId);
    const unsubPersonal = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setScheduleData(data);
        if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }));
      } else if (currentWeek >= systemWeek) {
        // Auto-feed from program template for current/future weeks — DISPLAY ONLY.
        // A2 / #1186: useMultiWeekData is the single source of truth for *persisting*
        // a missing week (it applies recurrence filtering). This subscription must not
        // also write the doc, or the two hooks race and can persist divergent data.
        // We show the template locally for an instant view; useMultiWeekData saves the
        // canonical (recurrence-filtered) doc, and this onSnapshot then converges to it.
        setScheduleData({});
        setLastUpdated(null);
        const stdRef = doc(db, ROOT_COLLECTION, activeKey, 'templates', 'standard');
        getDoc(stdRef).then(snap => {
          if (snap.exists()) {
            const data = { ...snap.data(), lastUpdated: new Date().toISOString() };
            setScheduleData(data);
            setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }));
          } else {
            setLastUpdated('Aldrig');
          }
        });
      } else { setScheduleData({}); setLastUpdated('Aldrig'); }
    });

    // Reset team data to only current fighters (prune removed members)
    setTeamData(prev => {
      const pruned: Record<string, DocumentData> = {};
      FIGHTERS.forEach(f => { if (prev[f]) pruned[f] = prev[f]; });
      return pruned;
    });

    const unsubsTeam: Unsubscribe[] = [];
    FIGHTERS.forEach(fighter => {
      const fighterKey = resolveFighterKey(fighter, emailMap);
      const fRef = doc(db, ROOT_COLLECTION, fighterKey, 'weeks', docId);
      const unsub = onSnapshot(fRef, (snap) => {
        if (snap.exists()) setTeamData(prev => ({ ...prev, [fighter]: snap.data() }));
        else setTeamData(prev => ({ ...prev, [fighter]: {} }));
      });
      unsubsTeam.push(unsub);
    });
    return () => { unsubPersonal(); unsubsTeam.forEach(u => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeKey, currentWeek, accessDenied, isBrowserBlocked, FIGHTERS, teamKeysSig]);

  const saveToDb = async (newData: DocumentData) => {
    const clean = stripEvents(newData);
    const docRef = doc(db, ROOT_COLLECTION, activeKey, 'weeks', `week_${currentWeek}`);
    clean.lastUpdated = new Date().toISOString();
    await setDoc(docRef, clean);
  };

  return {
    systemWeek, currentWeek, setCurrentWeek,
    scheduleData, setScheduleData,
    teamData, lastUpdated,
    saveToDb,
  };
}

/**
 * Load schedule data for multiple weeks at once (for continuous scroll).
 * Returns a map: weekNumber → { Mandag: [...], Tirsdag: [...], ... }
 */
export function useMultiWeekData(
  user: User | null,
  fighterKey: string,
  weekNumbers: number[],
  accessDenied: boolean,
  isBrowserBlocked: boolean,
) {
  const [multiWeekData, setMultiWeekData] = useState<Record<number, DocumentData>>({});
  const unsubs = useRef<Unsubscribe[]>([]);

  useEffect(() => {
    // Clean up previous listeners
    unsubs.current.forEach(u => u());
    unsubs.current = [];

    if (!user || accessDenied || isBrowserBlocked || weekNumbers.length === 0) {
      setMultiWeekData({});
      return;
    }

    for (const weekNum of weekNumbers) {
      const docRef = doc(db, ROOT_COLLECTION, fighterKey, 'weeks', `week_${weekNum}`);
      const unsub = onSnapshot(docRef, async (snap) => {
        if (snap.exists()) {
          setMultiWeekData(prev => ({ ...prev, [weekNum]: snap.data() }));
        } else {
          // Auto-feed from program template for current/future weeks
          const systemWeek = getISOWeek();
          if (weekNum >= systemWeek) {
            const stdRef = doc(db, ROOT_COLLECTION, fighterKey, 'templates', 'standard');
            const stdSnap = await getDoc(stdRef);
            if (stdSnap.exists()) {
              const data = filterTemplateForWeek(stdSnap.data(), weekNum);
              setMultiWeekData(prev => ({ ...prev, [weekNum]: data }));
              await setDoc(docRef, data);
            } else {
              setMultiWeekData(prev => ({ ...prev, [weekNum]: {} }));
            }
          } else {
            setMultiWeekData(prev => ({ ...prev, [weekNum]: {} }));
          }
        }
      });
      unsubs.current.push(unsub);
    }

    return () => { unsubs.current.forEach(u => u()); unsubs.current = []; };
  }, [user, fighterKey, weekNumbers.join(','), accessDenied, isBrowserBlocked]);

  const saveWeekToDb = useCallback(async (weekNum: number, newData: DocumentData) => {
    const clean = stripEvents(newData);
    const docRef = doc(db, ROOT_COLLECTION, fighterKey, 'weeks', `week_${weekNum}`);
    clean.lastUpdated = new Date().toISOString();
    await setDoc(docRef, clean);
  }, [fighterKey]);

  /**
   * Read a single week document straight from Firestore (A3 / #1187).
   * Used by save/delete handlers to distinguish "week not loaded yet" from
   * "week is genuinely empty" — so we never overwrite an existing week with {}.
   * Returns the stored data, or null if the document does not exist.
   */
  const fetchWeekData = useCallback(async (weekNum: number): Promise<DocumentData | null> => {
    const docRef = doc(db, ROOT_COLLECTION, fighterKey, 'weeks', `week_${weekNum}`);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  }, [fighterKey]);

  /**
   * Build (but don't persist) the recurrence-filtered standard-week template for a
   * week (#1183). Used by handleAddRecurring to seed a future week that has no doc
   * yet, so writing a recurring session into it doesn't drop the standard sessions.
   * Returns null when the fighter has no template.
   */
  const seedWeekFromTemplate = useCallback(async (weekNum: number): Promise<DocumentData | null> => {
    const stdRef = doc(db, ROOT_COLLECTION, fighterKey, 'templates', 'standard');
    const stdSnap = await getDoc(stdRef);
    if (!stdSnap.exists()) return null;
    return filterTemplateForWeek(stdSnap.data(), weekNum);
  }, [fighterKey]);

  return { multiWeekData, saveWeekToDb, fetchWeekData, seedWeekFromTemplate };
}

/**
 * Load multi-week schedule data for selected friends (team overlay).
 * Returns a map: fighterName → weekNumber → { Mandag: [...], Tirsdag: [...], ... }
 * Only subscribes when visibleFriends is non-empty.
 */
export function useMultiWeekTeamData(
  user: User | null,
  visibleFriends: string[],
  weekNumbers: number[],
  accessDenied: boolean,
  isBrowserBlocked: boolean,
  emailForName?: Record<string, string>,
) {
  const [friendWeekData, setFriendWeekData] = useState<Record<string, Record<number, DocumentData>>>({});
  const unsubs = useRef<Unsubscribe[]>([]);
  const emailMap = useMemo(() => emailForName || {}, [emailForName]);
  // Stable signature so the effect re-subscribes to email paths once config loads.
  const friendKeysSig = useMemo(
    () => visibleFriends.map(f => `${f}:${resolveFighterKey(f, emailMap)}`).join(','),
    [visibleFriends, emailMap]
  );

  useEffect(() => {
    unsubs.current.forEach(u => u());
    unsubs.current = [];

    if (!user || accessDenied || isBrowserBlocked || visibleFriends.length === 0 || weekNumbers.length === 0) {
      setFriendWeekData({});
      return;
    }

    for (const fighter of visibleFriends) {
      const fighterKey = resolveFighterKey(fighter, emailMap);
      for (const weekNum of weekNumbers) {
        const docRef = doc(db, ROOT_COLLECTION, fighterKey, 'weeks', `week_${weekNum}`);
        const unsub = onSnapshot(docRef, (snap) => {
          const data = snap.exists() ? snap.data() : {};
          setFriendWeekData(prev => ({
            ...prev,
            [fighter]: { ...(prev[fighter] || {}), [weekNum]: data },
          }));
        });
        unsubs.current.push(unsub);
      }
    }

    return () => { unsubs.current.forEach(u => u()); unsubs.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, friendKeysSig, weekNumbers.join(','), accessDenied, isBrowserBlocked]);

  return { friendWeekData };
}
