import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { doc, setDoc, getDoc, onSnapshot, type Unsubscribe, type DocumentData } from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { db } from '../config/firebase';
import { FIGHTERS as DEFAULT_FIGHTERS, ROOT_COLLECTION } from '../config/constants';
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

interface ScheduleDataParams {
  user: User | null;
  activeFighter: string;
  accessDenied: boolean;
  isBrowserBlocked: boolean;
  fighters?: string[];
}

export function useScheduleData({ user, activeFighter, accessDenied, isBrowserBlocked, fighters }: ScheduleDataParams) {
  const fightersKey = fighters ? fighters.join(',') : '';
  const FIGHTERS = useMemo(() => fighters || DEFAULT_FIGHTERS, [fightersKey]);
  const [systemWeek] = useState(getISOWeek());
  const [currentWeek, setCurrentWeek] = useState(getISOWeek());
  const [scheduleData, setScheduleData] = useState<DocumentData>({});
  const [teamData, setTeamData] = useState<Record<string, DocumentData>>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Data Sync
  useEffect(() => {
    if (!user || accessDenied || isBrowserBlocked) return;
    const docId = `week_${currentWeek}`;

    const docRef = doc(db, ROOT_COLLECTION, activeFighter, 'weeks', docId);
    const unsubPersonal = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setScheduleData(data);
        if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }));
      } else if (currentWeek >= systemWeek) {
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

    // Reset team data to only current fighters (prune removed members)
    setTeamData(prev => {
      const pruned: Record<string, DocumentData> = {};
      FIGHTERS.forEach(f => { if (prev[f]) pruned[f] = prev[f]; });
      return pruned;
    });

    const unsubsTeam: Unsubscribe[] = [];
    FIGHTERS.forEach(fighter => {
      const fRef = doc(db, ROOT_COLLECTION, fighter, 'weeks', docId);
      const unsub = onSnapshot(fRef, (snap) => {
        if (snap.exists()) setTeamData(prev => ({ ...prev, [fighter]: snap.data() }));
        else setTeamData(prev => ({ ...prev, [fighter]: {} }));
      });
      unsubsTeam.push(unsub);
    });
    return () => { unsubPersonal(); unsubsTeam.forEach(u => u()); };
  }, [user, activeFighter, currentWeek, accessDenied, isBrowserBlocked, FIGHTERS]);

  const saveToDb = async (newData: DocumentData) => {
    const clean = stripEvents(newData);
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, 'weeks', `week_${currentWeek}`);
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
    const clean = stripEvents(newData);
    const docRef = doc(db, ROOT_COLLECTION, activeFighter, 'weeks', `week_${weekNum}`);
    clean.lastUpdated = new Date().toISOString();
    await setDoc(docRef, clean);
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
