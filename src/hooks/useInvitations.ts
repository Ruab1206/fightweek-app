/**
 * useInvitations — load and mutate activity invitations (#1201, Release 1.14).
 *
 * Mirrors useEvents: subscribes to the shared `invitations` collection only
 * after auth resolves (Firestore needs a valid token, DoD #14), and retries on
 * transient listener errors. Invitations are merged into calendars at render
 * time by useInvitationMerge — nothing is written into private week documents.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, addDoc, deleteDoc as firestoreDeleteDoc, deleteField, FieldPath } from 'firebase/firestore';
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
   * Upsert a single occurrence's invitation doc (the shared core of both the
   * single-invite and the series fan-out). One invitation doc per
   * (inviter + activity occurrence): everyone invited to the same occurrence
   * shares a doc and can see each other's responses. If a doc for this
   * occurrence already exists, the invitees are merged in as `pending`
   * (re-inviting a previously declined person resets them to pending); otherwise
   * a new doc is created. `seriesId` (when given) links this occurrence into a
   * recurring-series invitation (#1213); it stays undefined for single invites.
   */
  const upsertOccurrence = async (
    activity: InvitationActivity,
    inviter: string,
    invitedByName: string,
    emails: string[],
    seriesId?: string,
  ): Promise<void> => {
    const nowIso = new Date().toISOString();

    // Find an existing invitation for the same activity occurrence by the same inviter.
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
      // Re-inviting reactivates the activity: if the doc was previously
      // cancelled, clear that so invitees don't see a stale "Aflyst" while the
      // arranger sees them as pending.
      args.push('status', 'active');
      // Link an existing single-occurrence doc into the series if it isn't already.
      if (seriesId && existing.seriesId !== seriesId) args.push('seriesId', seriesId);
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
      status: 'active',
      ...(seriesId ? { seriesId } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  };

  /**
   * Invite people to a single activity occurrence (1.14 behaviour, unchanged).
   */
  const createInvitation = useCallback(async (
    activity: InvitationActivity,
    invitedBy: string,
    invitedByName: string,
    inviteeEmails: string[],
  ): Promise<void> => {
    const inviter = invitedBy.toLowerCase();
    const emails = inviteeEmails.map((e) => e.toLowerCase());
    await upsertOccurrence(activity, inviter, invitedByName, emails);
  }, []);

  /**
   * Invite people to a RECURRING activity in one action (#1213, Release 1.17).
   * Fans out to one occurrence-doc per date in `occurrenceDates`, all sharing a
   * freshly generated `seriesId`. Each occurrence doc is identical to a single
   * invite, so per-occurrence opt-out / who's-coming / cancel-one-date keep
   * working unchanged; `seriesId` only ties them together for series-level ops
   * (cancelSeries / removeFromSeries). The caller computes `occurrenceDates`
   * across the FULL recurrence horizon (computeSeriesOccurrenceDates) so the
   * series can't run away — the #1183 horizon lesson.
   */
  const createSeriesInvitation = useCallback(async (
    baseActivity: Omit<InvitationActivity, 'date'>,
    occurrenceDates: string[],
    invitedBy: string,
    invitedByName: string,
    inviteeEmails: string[],
  ): Promise<string> => {
    const inviter = invitedBy.toLowerCase();
    const emails = inviteeEmails.map((e) => e.toLowerCase());
    const seriesId = crypto.randomUUID();
    for (const date of occurrenceDates) {
      await upsertOccurrence({ ...baseActivity, date }, inviter, invitedByName, emails, seriesId);
    }
    return seriesId;
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
    const nowIso = new Date().toISOString();
    await updateDoc(
      ref,
      new FieldPath('invitees', inviteeEmail.toLowerCase()), response,
      // Stamp WHEN this person responded so the arranger's notification keeps a
      // stable time even if the doc is edited again later for another reason.
      new FieldPath('eventTimes', inviteeEmail.toLowerCase()), nowIso,
      'updatedAt', nowIso,
    );
  }, []);

  /** Cancel/delete an invitation (inviter only — enforced by rules). */
  const removeInvitation = useCallback(async (invitationId: string): Promise<void> => {
    const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', invitationId);
    await firestoreDeleteDoc(ref);
  }, []);

  /**
   * Arranger calls off an invitation (Outlook-style): the doc is kept but marked
   * `cancelled`, so invitees still see it struck through until they remove it
   * from their own calendar (dismissInvitation). Inviter-only, enforced by rules.
   */
  const cancelInvitation = useCallback(async (invitationId: string): Promise<void> => {
    const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', invitationId);
    const nowIso = new Date().toISOString();
    await updateDoc(ref, { status: 'cancelled', cancelledAt: nowIso, updatedAt: nowIso });
  }, []);

  /**
   * Cancel the invitation that matches an activity the current user arranged
   * (same inviter + title + date + start). Used when the arranger deletes the
   * underlying activity, so invitees see it was called off. No-op if none match.
   */
  const cancelInvitationForActivity = useCallback(async (
    invitedBy: string,
    title: string,
    date: string,
    start: string,
  ): Promise<void> => {
    const inviter = invitedBy.toLowerCase();
    const t = (title || '').trim();
    const matches = invitationsRef.current.filter((inv) =>
      inv.status !== 'cancelled'
      && inv.invitedBy.toLowerCase() === inviter
      && (inv.activity.title || '').trim() === t
      && inv.activity.date === date
      && (inv.activity.start || '') === (start || ''),
    );
    const nowIso = new Date().toISOString();
    for (const inv of matches) {
      const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', inv.id);
      await updateDoc(ref, { status: 'cancelled', cancelledAt: nowIso, updatedAt: nowIso });
    }
  }, []);

  /**
   * Cancel every invitation I arranged for an activity on `fromDate` or later
   * (same inviter + title + start). Used when the arranger deletes a recurring
   * activity "this and future occurrences", so invitees of any future occurrence
   * are notified too. No-op if none match.
   */
  const cancelInvitationsForActivityFrom = useCallback(async (
    invitedBy: string,
    title: string,
    start: string,
    fromDate: string,
  ): Promise<void> => {
    const inviter = invitedBy.toLowerCase();
    const t = (title || '').trim();
    const matches = invitationsRef.current.filter((inv) =>
      inv.status !== 'cancelled'
      && inv.invitedBy.toLowerCase() === inviter
      && (inv.activity.title || '').trim() === t
      && (inv.activity.start || '') === (start || '')
      && inv.activity.date >= fromDate,
    );
    const nowIso = new Date().toISOString();
    for (const inv of matches) {
      const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', inv.id);
      await updateDoc(ref, { status: 'cancelled', cancelledAt: nowIso, updatedAt: nowIso });
    }
  }, []);

  /**
   * Cancel the WHOLE series (#1213): mark every occurrence-doc sharing `seriesId`
   * as cancelled, so every invitee on every future occurrence is notified. Only
   * not-yet-cancelled occurrences are touched. A batch of single-doc writes, each
   * already permitted by the inviter rule (invitedBy == own email).
   */
  const cancelSeries = useCallback(async (seriesId: string): Promise<void> => {
    if (!seriesId) return;
    const matches = invitationsRef.current.filter((inv) =>
      inv.seriesId === seriesId && inv.status !== 'cancelled',
    );
    const nowIso = new Date().toISOString();
    for (const inv of matches) {
      const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', inv.id);
      await updateDoc(ref, { status: 'cancelled', cancelledAt: nowIso, updatedAt: nowIso });
    }
  }, []);

  /**
   * Remove one person from the WHOLE series (#1213): set their response to
   * `cancelled` on every occurrence-doc sharing `seriesId`, so they see each
   * future occurrence struck through as "Aflyst" and can dismiss it. Stamps a
   * stable per-person eventTime per doc (the single-invite removeInvitee
   * behaviour, fanned out).
   */
  const removeFromSeries = useCallback(async (
    seriesId: string,
    inviteeEmail: string,
  ): Promise<void> => {
    if (!seriesId) return;
    const email = inviteeEmail.toLowerCase();
    const matches = invitationsRef.current.filter((inv) =>
      inv.seriesId === seriesId && inv.invitees?.[email] !== undefined && inv.invitees[email] !== 'cancelled',
    );
    const nowIso = new Date().toISOString();
    for (const inv of matches) {
      const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', inv.id);
      await updateDoc(
        ref,
        new FieldPath('invitees', email), 'cancelled',
        new FieldPath('eventTimes', email), nowIso,
        'updatedAt', nowIso,
      );
    }
  }, []);

  const dismissInvitation = useCallback(async (
    invitationId: string,
    inviteeEmail: string,
  ): Promise<void> => {
    const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', invitationId);
    await updateDoc(
      ref,
      new FieldPath('invitees', inviteeEmail.toLowerCase()), deleteField(),
      'updatedAt', new Date().toISOString(),
    );
  }, []);

  /**
   * Arranger un-invites a single person (Outlook-style): sets that invitee's
   * response to `cancelled` so they see the activity struck through as "Aflyst"
   * and can remove it from their own calendar (instead of it vanishing without
   * explanation). Inviter/admin only (the inviter clause permits editing other
   * invitees' keys).
   */
  const removeInvitee = useCallback(async (
    invitationId: string,
    inviteeEmail: string,
  ): Promise<void> => {
    const ref = doc(db, PUBLIC_DATA_PATH, 'invitations', invitationId);
    const nowIso = new Date().toISOString();
    await updateDoc(
      ref,
      new FieldPath('invitees', inviteeEmail.toLowerCase()), 'cancelled',
      // Stamp WHEN this person was removed so their "removed" notification keeps
      // a stable time even if the doc is edited again later for another reason.
      new FieldPath('eventTimes', inviteeEmail.toLowerCase()), nowIso,
      'updatedAt', nowIso,
    );
  }, []);

  return {
    invitations, loading, createInvitation, createSeriesInvitation, respondToInvitation,
    removeInvitation, cancelInvitation, cancelInvitationForActivity, cancelInvitationsForActivityFrom,
    cancelSeries, removeFromSeries, dismissInvitation, removeInvitee,
  };
}
