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
  // Keep the latest invitations available inside callbacks (for upsert lookups)
  // without re-creating those callbacks on every snapshot.
  const invitationsRef = useRef<Invitation[]>([]);
  invitationsRef.current = invitations;

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

  /**
   * Invite people to an activity. One invitation doc per (inviter + activity),
   * so everyone invited to the same activity shares a single doc and can see
   * each other's responses. If an invitation for this activity already exists,
   * the new invitees are merged in as `pending` (re-inviting a previously
   * declined person resets them to pending). Otherwise a new doc is created.
   */
  const createInvitation = useCallback(async (
    activity: InvitationActivity,
    invitedBy: string,
    invitedByName: string,
    inviteeEmails: string[],
  ): Promise<void> => {
    const nowIso = new Date().toISOString();
    const inviter = invitedBy.toLowerCase();
    const emails = inviteeEmails.map((e) => e.toLowerCase());

    // Find an existing invitation for the same activity by the same inviter.
    const existing = invitationsRef.current.find((inv) =>
      inv.invitedBy.toLowerCase() === inviter
      && (inv.activity.title || '').trim() === (activity.title || '').trim()
      && inv.activity.date === activity.date
      && (inv.activity.start || '') === (activity.start || ''),
    );

    if (existing) {
      // Merge: set each invitee to pending via FieldPath (emails contain dots).
      const args: unknown[] = [];
      for (const email of emails) {
        args.push(new FieldPath('invitees', email), 'pending');
      }
      args.push('updatedAt', nowIso);
      const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', existing.id);
      // updateDoc(ref, field, value, ...moreFieldsAndValues)
      await (updateDoc as (...a: unknown[]) => Promise<void>)(ref, ...args);
      return;
    }

    const invitees: Record<string, InvitationResponse> = {};
    for (const email of emails) invitees[email] = 'pending';
    await addDoc(collection(db, PUBLIC_DATA_PATH, 'invitations'), {
      activity,
      invitedBy: inviter,
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
