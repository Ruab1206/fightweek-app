import { useState, useEffect } from 'react';
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
