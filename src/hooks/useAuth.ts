import { useState, useEffect, useRef } from 'react';
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence,
  type User,
} from 'firebase/auth';

import { auth } from '../config/firebase';
import { USER_MAPPING as HARDCODED_MAPPING } from '../config/constants';
import { checkInAppBrowser, isMobileDevice } from '../utils/deviceUtils';

export function useAuth(externalMapping?: Record<string, { name: string; role: string }>) {
  const USER_MAPPING = externalMapping || HARDCODED_MAPPING;
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isBrowserBlocked, setIsBrowserBlocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeFighter, setActiveFighter] = useState('Karl');
  const [isLocked, setIsLocked] = useState(true);
  const initialAuthDone = useRef(false);
  const mappingRef = useRef(externalMapping);
  mappingRef.current = externalMapping;

  useEffect(() => {
    setIsMobile(isMobileDevice());
    if (checkInAppBrowser()) { setIsBrowserBlocked(true); setAuthLoading(false); return; }

    const initAuth = async () => {
      try { await setPersistence(auth, browserLocalPersistence); }
      catch (error) { console.error("Persistence error:", error); }
    };
    initAuth();

    getRedirectResult(auth).catch((error: { code?: string; message?: string }) => {
      if (error.code !== 'auth/popup-closed-by-user') setLoginError(error.message ?? 'Unknown error');
    });

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setAuthLoading(false);
      if (u) {
        const email = u.email ? u.email.toLowerCase() : '';
        const mapping = mappingRef.current || HARDCODED_MAPPING;
        const userProfile = mapping[email];
        if (userProfile) {
          setUser(u);
          setAccessDenied(false);
          if (!initialAuthDone.current) {
            initialAuthDone.current = true;
            // #1165: everyone lands on their OWN calendar (coach/admin too — no
            // longer hardcoded to fighter "Karl"). Only the admin stays unlocked so
            // they keep the fighter-switcher to inspect any fighter's calendar; the
            // coach is locked to their own calendar like a fighter.
            setActiveFighter(userProfile.name);
            setIsLocked(userProfile.role !== 'admin');
          }
        } else { setAccessDenied(true); setUser(u); }
      } else { setUser(null); initialAuthDone.current = false; }
    });
    return () => unsubAuth();
  }, []);

  const triggerLoginPopup = async () => {
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); }
    catch (error) { setLoginError(error instanceof Error ? error.message : 'Unknown error'); }
  };

  const triggerLoginRedirect = async () => {
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try { await signInWithRedirect(auth, provider); }
    catch (error) { setLoginError(error instanceof Error ? error.message : 'Unknown error'); }
  };

  const handleLogout = () => { signOut(auth); setAccessDenied(false); setLoginError(null); };

  return {
    user, authLoading, accessDenied, loginError,
    isBrowserBlocked, isMobile,
    activeFighter, setActiveFighter,
    isLocked,
    triggerLoginPopup, triggerLoginRedirect, handleLogout,
  };
}
