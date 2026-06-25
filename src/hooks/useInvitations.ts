/**
 * useInvitations — load and mutate activity invitations (#1201, Release 1.14).
 *
 * Mirrors useEvents: subscribes to the shared `invitations` collection only
 * after auth resolves (Firestore needs a valid token, DoD #14), and retries on
 * transient listener errors. Invitations are merged into calendars at render
 * time by useInvitationMerge — nothing is written into private week documents.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, addDoc, deleteDoc as firestoreDeleteDoc, FieldPath } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { PUBLIC_DATA_PATH } from '../config/constants';
import type { Invitation, InvitationActivity, InvitationResponse } from '../types/invitation';

export function useInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    function subscribe() {
      const q = query(collection(db, PUBLIC_DATA_PATH, 'invitations'));
      unsub = onSnapshot(q, (snap) => {
        const items: Invitation[] = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as Invitation))
          .filter((inv) => inv.activity && inv.activity.date);
        items.sort((a, b) => a.activity.date.localeCompare(b.activity.date));
        setInvitations(items);
        setLoading(false);
      }, (err) => {
        console.error('[useInvitations] error:', err);
        setLoading(false);
        // Firestore terminates the listener on error — retry after a short delay
        unsub = null;
        retryTimer.current = setTimeout(subscribe, 2000);
      });
    }

    // Wait for auth before subscribing so Firestore has a valid token
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (!unsub) subscribe();
      }
    });

    return () => {
      unsubAuth();
      if (unsub) unsub();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  /** Create an invitation to an activity for one or more invitees (all start as pending). */
  const createInvitation = useCallback(async (
    activity: InvitationActivity,
    invitedBy: string,
    invitedByName: string,
    inviteeEmails: string[],
  ): Promise<void> => {
    const invitees: Record<string, InvitationResponse> = {};
    for (const email of inviteeEmails) invitees[email.toLowerCase()] = 'pending';
    const nowIso = new Date().toISOString();
    await addDoc(collection(db, PUBLIC_DATA_PATH, 'invitations'), {
      activity,
      invitedBy: invitedBy.toLowerCase(),
      invitedByName,
      invitees,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }, []);

  /** Set an invitee's own response (accept/decline/tentative). */
  const respondToInvitation = useCallback(async (
    invitationId: string,
    inviteeEmail: string,
    response: InvitationResponse,
  ): Promise<void> => {
    const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', invitationId);
    // Use FieldPath so the email (which contains dots) is treated as a single
    // literal map key. A dotted string key like `invitees.a.b@x.com` would be
    // parsed by Firestore as a nested field path and corrupt the map.
    await updateDoc(
      ref,
      new FieldPath('invitees', inviteeEmail.toLowerCase()), response,
      'updatedAt', new Date().toISOString(),
    );
  }, []);

  /** Cancel/delete an invitation (inviter only — enforced by rules). */
  const removeInvitation = useCallback(async (invitationId: string): Promise<void> => {
    const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', invitationId);
    await firestoreDeleteDoc(ref);
  }, []);

  return { invitations, loading, createInvitation, respondToInvitation, removeInvitation };
}
