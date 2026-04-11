import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, getDoc, onSnapshot, type Unsubscribe, type DocumentData } from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { db } from '../config/firebase';
import { FIGHTERS, ROOT_COLLECTION } from '../config/constants';
import { getISOWeek } from '../utils/dateUtils';

interface ScheduleDataParams {
  user: User | null;
  activeFighter: string;
  accessDenied: boolean;
  isBrowserBlocked: boolean;
}

export function useScheduleData({ user, activeFighter, accessDenied, isBrowserBlocked }: ScheduleDataParams) {
  const [systemWeek] = useState(getISOWeek());
  const [currentWeek, setCurrentWeek] = useState(getISOWeek());
  const [isStandardMode, setIsStandardMode] = useState(false);
  const [scheduleData, setScheduleData] = useState<DocumentData>({});
  const [teamData, setTeamData] = useState<Record<string, DocumentData>>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Data Sync
  useEffect(() => {
    if (!user || accessDenied || isBrowserBlocked) return;
    const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
    const collectionPath = isStandardMode ? 'templates' : 'weeks';

    const docRef = doc(db, ROOT_COLLECTION, activeFighter, collectionPath, docId);
    const unsubPersonal = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setScheduleData(data);
        if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }));
      } else if (!isStandardMode && currentWeek >= systemWeek) {
        // Auto-feed from program template for current/future weeks
        setScheduleData({});
        setLastUpdated(null);
        const stdRef = doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard');
        getDoc(stdRef).then(snap => {
          if (snap.exists()) {
            const data = { ...snap.data(), lastUpdated: new Date().toISOString() };
            setScheduleData(data);
            setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }));
            setDoc(docRef, data);
          } else {
            setLastUpdated('Aldrig');
          }
        });
      } else { setScheduleData({}); setLastUpdated('Aldrig'); }
    });

    const unsubsTeam: Unsubscribe[] = [];
    FIGHTERS.forEach(fighter => {
      const fRef = doc(db, ROOT_COLLECTION, fighter, collectionPath, docId);
      const unsub = onSnapshot(fRef, (snap) => {
        if (snap.exists()) setTeamData(prev => ({ ...prev, [fighter]: snap.data() }));
        else setTeamData(prev => ({ ...prev, [fighter]: {} }));
      });
      unsubsTeam.push(unsub);
    });
    return () => { unsubPersonal(); unsubsTeam.forEach(u => u()); };
  }, [user, activeFighter, currentWeek, isStandardMode, accessDenied, isBrowserBlocked]);

  const saveToDb = async (newData: DocumentData) => {
    const docId = isStandardMode ? 'standard' : `week_${currentWeek}`;
    const collectionPath = isStandardMode ? 'templates' : 'weeks';
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, collectionPath, docId);
    newData.lastUpdated = new Date().toISOString();
    await setDoc(docRef, newData);
  };

  const handleImportStandard = async () => {
    const standardSnap = await getDoc(doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard'));
    if (standardSnap.exists()) {
      await saveToDb(standardSnap.data());
      return true;
    }
    return false;
  };

  return {
    systemWeek, currentWeek, setCurrentWeek,
    isStandardMode, setIsStandardMode,
    scheduleData, setScheduleData,
    teamData, lastUpdated,
    saveToDb, handleImportStandard,
  };
}

/**
 * Load schedule data for multiple weeks at once (for continuous scroll).
 * Returns a map: weekNumber → { Mandag: [...], Tirsdag: [...], ... }
 */
export function useMultiWeekData(
  user: User | null,
  activeFighter: string,
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
      const docRef = doc(db, ROOT_COLLECTION, activeFighter, 'weeks', `week_${weekNum}`);
      const unsub = onSnapshot(docRef, async (snap) => {
        if (snap.exists()) {
          setMultiWeekData(prev => ({ ...prev, [weekNum]: snap.data() }));
        } else {
          // Auto-feed from program template for current/future weeks
          const systemWeek = getISOWeek();
          if (weekNum >= systemWeek) {
            const stdRef = doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard');
            const stdSnap = await getDoc(stdRef);
            if (stdSnap.exists()) {
              const raw = stdSnap.data();
              // Filter out sessions whose recurrence pattern doesn't match this week
              const data: Record<string, any> = { lastUpdated: new Date().toISOString() };
              for (const key of Object.keys(raw)) {
                if (key === 'lastUpdated') continue;
                if (!Array.isArray(raw[key])) { data[key] = raw[key]; continue; }
                data[key] = raw[key].filter((s: any) => {
                  if (!s.recurrenceInterval || s.recurrenceInterval <= 1) return true;
                  const diff = weekNum - (s.recurrenceStartWeek || weekNum);
                  return diff >= 0 && diff % s.recurrenceInterval === 0;
                });
              }
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
  }, [user, activeFighter, weekNumbers.join(','), accessDenied, isBrowserBlocked]);

  const saveWeekToDb = useCallback(async (weekNum: number, newData: DocumentData) => {
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, 'weeks', `week_${weekNum}`);
    newData.lastUpdated = new Date().toISOString();
    await setDoc(docRef, newData);
  }, [activeFighter]);

  return { multiWeekData, saveWeekToDb };
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
) {
  const [friendWeekData, setFriendWeekData] = useState<Record<string, Record<number, DocumentData>>>({});
  const unsubs = useRef<Unsubscribe[]>([]);

  useEffect(() => {
    unsubs.current.forEach(u => u());
    unsubs.current = [];

    if (!user || accessDenied || isBrowserBlocked || visibleFriends.length === 0 || weekNumbers.length === 0) {
      setFriendWeekData({});
      return;
    }

    for (const fighter of visibleFriends) {
      for (const weekNum of weekNumbers) {
        const docRef = doc(db, ROOT_COLLECTION, fighter, 'weeks', `week_${weekNum}`);
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
  }, [user, visibleFriends.join(','), weekNumbers.join(','), accessDenied, isBrowserBlocked]);

  return { friendWeekData };
}

/**
 * Load the standard (program) template for the active fighter.
 * Returns the template data so callers can check if a session is recurring.
 */
export function useStandardTemplate(
  user: User | null,
  activeFighter: string,
  accessDenied: boolean,
  isBrowserBlocked: boolean,
) {
  const [programData, setProgramData] = useState<DocumentData>({});

  useEffect(() => {
    if (!user || accessDenied || isBrowserBlocked) { setProgramData({}); return; }
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard');
    const unsub = onSnapshot(docRef, (snap) => {
      setProgramData(snap.exists() ? snap.data() : {});
    });
    return () => unsub();
  }, [user, activeFighter, accessDenied, isBrowserBlocked]);

  const saveProgramSession = useCallback(async (dayName: string, session: any) => {
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard');
    const snap = await getDoc(docRef);
    const data = snap.exists() ? { ...snap.data() } : {};
    if (!data[dayName]) data[dayName] = [];
    // Don't add if identical session already exists
    const exists = data[dayName].some((s: any) =>
      !s.isRestDay && (s.name || '').toLowerCase() === (session.name || '').toLowerCase() &&
      s.start === session.start
    );
    if (exists) return false;
    data[dayName].push({ ...session, id: Date.now(), status: 'active', day: dayName });
    data[dayName].sort((a: any, b: any) => (a.start || '').localeCompare(b.start || ''));
    data.lastUpdated = new Date().toISOString();
    await setDoc(docRef, data);
    return true;
  }, [activeFighter]);

  const updateProgramSessionRecurrence = useCallback(async (
    dayName: string, sessionName: string, sessionStart: string,
    recurrenceInterval: number, recurrenceStartWeek: number
  ) => {
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;
    const data = { ...snap.data() };
    if (!data[dayName]) return false;
    const nameLC = sessionName.toLowerCase();
    let found = false;
    data[dayName] = data[dayName].map((s: any) => {
      if (!s.isRestDay && (s.name || '').toLowerCase() === nameLC && s.start === sessionStart) {
        found = true;
        return { ...s, recurrenceInterval, recurrenceStartWeek };
      }
      return s;
    });
    if (!found) {
      // Session not in template yet — add it with recurrence metadata
      data[dayName].push({
        name: sessionName, start: sessionStart, day: dayName,
        id: Date.now(), status: 'active',
        recurrenceInterval, recurrenceStartWeek,
      });
      data[dayName].sort((a: any, b: any) => (a.start || '').localeCompare(b.start || ''));
    }
    data.lastUpdated = new Date().toISOString();
    await setDoc(docRef, data);
    return true;
  }, [activeFighter]);

  const removeProgramSession = useCallback(async (dayName: string, sessionName: string, sessionStart: string) => {
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, 'templates', 'standard');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;
    const data = { ...snap.data() };
    if (!data[dayName]) return false;
    const nameLC = sessionName.toLowerCase();
    const before = data[dayName].length;
    data[dayName] = data[dayName].filter((s: any) =>
      s.isRestDay || (s.name || '').toLowerCase() !== nameLC || s.start !== sessionStart
    );
    if (data[dayName].length === before) return false;
    data.lastUpdated = new Date().toISOString();
    await setDoc(docRef, data);
    return true;
  }, [activeFighter]);

  return { programData, saveProgramSession, updateProgramSessionRecurrence, removeProgramSession };
}
