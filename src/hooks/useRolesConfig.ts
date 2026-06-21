/**
 * useRolesConfig — Load team roles from Firestore config document.
 *
 * Returns USER_MAPPING, FIGHTERS, and mutation functions for the admin UI.
 * Falls back to hardcoded constants if the config doc hasn't loaded yet.
 */
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PUBLIC_DATA_PATH } from '../config/constants';
import {
  USER_MAPPING as HARDCODED_USER_MAPPING,
  FIGHTERS as HARDCODED_FIGHTERS,
  EMAIL_FOR_NAME as HARDCODED_EMAIL_FOR_NAME,
} from '../config/constants';

const CONFIG_DOC_PATH = `${PUBLIC_DATA_PATH}/config/roles`;

export interface RolesConfig {
  admins: string[];
  coaches: string[];
  members: Record<string, string>; // email → fighter name
  removed?: Record<string, string>; // email → fighter name (preserved on delete)
}

type UserRole = 'fighter' | 'coach' | 'admin';
type UserMapping = Record<string, { name: string; role: UserRole }>;

function configToMapping(config: RolesConfig): UserMapping {
  const mapping: UserMapping = {};
  for (const [email, name] of Object.entries(config.members)) {
    let role: UserRole = 'fighter';
    if (config.admins.includes(email)) role = 'admin';
    else if (config.coaches.includes(email)) role = 'coach';
    mapping[email] = { name, role };
  }
  return mapping;
}

function configToFighters(config: RolesConfig): string[] {
  return Object.entries(config.members)
    .filter(([email]) => !config.admins.includes(email) && !config.coaches.includes(email))
    .map(([, name]) => name);
}

/** Invert the members map (email → name) into a display-name → email path key map (#1191). */
function configToEmailForName(config: RolesConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [email, name] of Object.entries(config.members)) map[name] = email;
  return map;
}

export function useRolesConfig() {
  const [config, setConfig] = useState<RolesConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, CONFIG_DOC_PATH);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as RolesConfig);
      }
      setLoading(false);
    }, () => {
      // Error reading config doc — use fallback
      setLoading(false);
    });
    return unsub;
  }, []);

  const userMapping: UserMapping = config ? configToMapping(config) : HARDCODED_USER_MAPPING;
  const fighters: string[] = config ? configToFighters(config) : HARDCODED_FIGHTERS;
  const emailForName: Record<string, string> = config ? configToEmailForName(config) : HARDCODED_EMAIL_FOR_NAME;
  const allMembers: string[] = config ? Object.values(config.members) : [...HARDCODED_FIGHTERS, 'Frodi', 'Rune'];

  const addMember = useCallback(async (email: string, name: string, role: UserRole) => {
    if (!config) return;
    const lower = email.toLowerCase();
    const updated = { ...config };
    updated.members = { ...updated.members, [lower]: name };
    if (role === 'admin') updated.admins = [...new Set([...updated.admins, lower])];
    else if (role === 'coach') updated.coaches = [...new Set([...updated.coaches, lower])];
    // Clean up from removed list if re-adding
    if (updated.removed?.[lower]) {
      const { [lower]: _, ...restRemoved } = updated.removed;
      updated.removed = restRemoved;
    }
    await setDoc(doc(db, CONFIG_DOC_PATH), updated);
  }, [config]);

  const removeMember = useCallback(async (email: string) => {
    if (!config) return;
    const lower = email.toLowerCase();
    const updated = { ...config };
    const name = updated.members[lower];
    const { [lower]: _, ...rest } = updated.members;
    updated.members = rest;
    updated.admins = updated.admins.filter(e => e !== lower);
    updated.coaches = updated.coaches.filter(e => e !== lower);
    // Preserve email→name mapping so re-adding finds the old name
    if (name) updated.removed = { ...(updated.removed || {}), [lower]: name };
    await setDoc(doc(db, CONFIG_DOC_PATH), updated);
  }, [config]);

  const renameMember = useCallback(async (email: string, newName: string) => {
    if (!config) return;
    const lower = email.toLowerCase();
    const oldName = config.members[lower];
    if (!oldName || oldName === newName) return;
    // #1191: schedule data is keyed by EMAIL, so a rename is purely a display
    // change — only the config doc needs updating. No data migration required.
    const updated = { ...config };
    updated.members = { ...updated.members, [lower]: newName };
    await setDoc(doc(db, CONFIG_DOC_PATH), updated);
  }, [config]);

  const updateRole = useCallback(async (email: string, newRole: UserRole) => {
    if (!config) return;
    const lower = email.toLowerCase();
    const updated = { ...config };
    // Remove from current role lists
    updated.admins = updated.admins.filter(e => e !== lower);
    updated.coaches = updated.coaches.filter(e => e !== lower);
    // Add to new role list
    if (newRole === 'admin') updated.admins = [...updated.admins, lower];
    else if (newRole === 'coach') updated.coaches = [...updated.coaches, lower];
    await setDoc(doc(db, CONFIG_DOC_PATH), updated);
  }, [config]);

  return {
    config,
    loading,
    userMapping,
    fighters,
    emailForName,
    allMembers,
    addMember,
    removeMember,
    renameMember,
    updateRole,
    removedMembers: config?.removed || {},
  };
}
