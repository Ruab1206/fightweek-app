/**
 * calendarItemSummary.test.ts — shared-contract and cross-contract proofs
 * for the presentation-oriented rendering read model (see
 * calendarItemSummary.ts and the full-calendar readiness checkpoint in
 * /docs/fightweek_refactoring_plan.md). No Firebase, no React, no routing.
 */
import { describe, it, expect } from 'vitest';
import { mapLegacySessionToCalendarItemSummary } from './legacySessionSummaryAdapter';
import { mapEventToCalendarItemSummary } from './eventSummaryAdapter';
import { mapEventToCalendarItemDetail } from './eventDetailAdapter';
import type { TrainingSession } from '../../types/common';
import type { FightweekEvent } from '../../types/event';

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 'sess_1',
    day: 'Mandag',
    name: 'MMA Sparring',
    category: 'MMA',
    start: '17:00',
    end: '18:30',
    location: 'Klub A',
    status: 'active',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<FightweekEvent> = {}): FightweekEvent {
  return {
    id: 'ev_1',
    title: 'DM i Brydning 2026',
    type: 'tournament',
    date: '2026-09-12',
    startTime: '09:00',
    endTime: '18:00',
    location: 'Brøndby Hallen',
    signups: {},
    createdBy: 'admin@example.com',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

const legacyContext = { weekNumber: 33, dateISO: '2026-08-17' };

describe('CalendarItemSummary — shared contract', () => {
  // 1. Independent of React and Firestore — proven structurally: this file
  // and both adapters import no 'react'/'firebase' module, and both run
  // synchronously on plain data.
  it('produces summaries synchronously with no React/Firestore dependency', () => {
    const legacy = mapLegacySessionToCalendarItemSummary(makeSession(), legacyContext);
    const event = mapEventToCalendarItemSummary(makeEvent());
    expect(legacy).toBeDefined();
    expect(event).toBeDefined();
    expect(legacy).not.toBeInstanceOf(Promise);
    expect(event).not.toBeInstanceOf(Promise);
  });

  it.each([
    ['legacy self-posted', () => mapLegacySessionToCalendarItemSummary(makeSession(), legacyContext)],
    ['event', () => mapEventToCalendarItemSummary(makeEvent())],
  ])('%s summary contains no source-specific action callbacks or unrelated capabilities', (_label, build) => {
    const summary = build() as Record<string, unknown>;
    // 2. No source-specific action callbacks.
    expect(summary).not.toHaveProperty('onEdit');
    expect(summary).not.toHaveProperty('onDelete');
    expect(summary).not.toHaveProperty('onSignup');
    expect(summary).not.toHaveProperty('onInvite');
    // 3. No event signup.
    expect(summary).not.toHaveProperty('eventSignup');
    expect(summary).not.toHaveProperty('signups');
    // 4. No Favorite.
    expect(summary).not.toHaveProperty('favorite');
    expect(summary).not.toHaveProperty('isFavorite');
    // 5. No RSVP.
    expect(summary).not.toHaveProperty('rsvp');
    expect(summary).not.toHaveProperty('invitationResponse');
    // 6. No Participation.
    expect(summary).not.toHaveProperty('participation');
    // 7. No TrainingLog state (neither covered source requires it on its card).
    expect(summary).not.toHaveProperty('trainingLogAssociation');
    expect(summary).not.toHaveProperty('canLogTraining');
    // 8. No edit/delete or recurrence-action capabilities.
    expect(summary).not.toHaveProperty('editable');
    expect(summary).not.toHaveProperty('deletable');
    expect(summary).not.toHaveProperty('recurringEditScope');
  });
});

describe('CalendarItemSummary — cross-contract compatibility', () => {
  // 24. Summary and detail adapters use compatible identity vocabulary.
  it('shares the same opaque itemKey format as the detail adapters for both sources', () => {
    const legacySummary = mapLegacySessionToCalendarItemSummary(makeSession({ id: 'sess_9' }), { weekNumber: 12, dateISO: '2026-03-02' });
    expect(legacySummary.itemKey).toBe('self_posted_legacy:12:2026-03-02:sess_9');

    const eventSummary = mapEventToCalendarItemSummary(makeEvent({ id: 'ev_9' }));
    expect(eventSummary.itemKey).toBe('event:ev_9');
  });

  // 25. Summary and detail adapters use compatible availability vocabulary.
  it('represents availability with the same {status, cancellationReason} shape as the detail contract', () => {
    const cancelledLegacy = mapLegacySessionToCalendarItemSummary(
      makeSession({ status: 'cancelled', cancellationReason: 'Skade' }), legacyContext,
    );
    expect(cancelledLegacy.availability).toEqual({ status: 'cancelled', cancellationReason: 'Skade' });

    const cancelledEvent = mapEventToCalendarItemSummary(
      makeEvent({ status: 'cancelled', cancellationReason: 'Vejr' }),
    );
    expect(cancelledEvent.availability).toEqual({ status: 'cancelled', cancellationReason: 'Vejr' });

    const { detail } = mapEventToCalendarItemDetail(makeEvent({ status: 'cancelled', cancellationReason: 'Vejr' }), {});
    expect(cancelledEvent.availability.status).toBe(detail.availability.status);
    expect(cancelledEvent.availability.cancellationReason).toBe(detail.availability.cancellationReason);
  });

  // 26. The summary remains materially smaller than the detail contract.
  it('has materially fewer fields than the corresponding detail + capabilities record', () => {
    const event = makeEvent({ organiser: 'X', url: 'https://x', cost: '1 kr', description: 'desc' });
    const summary = mapEventToCalendarItemSummary(event);
    const { detail, capabilities } = mapEventToCalendarItemDetail(event, { isAdmin: true });

    const summaryFieldCount = Object.keys(summary).length;
    const detailFieldCount = Object.keys(detail).length + Object.keys(capabilities).length;

    expect(summaryFieldCount).toBeLessThan(detailFieldCount);
    expect(summary).not.toHaveProperty('description');
    expect(summary).not.toHaveProperty('organiser');
    expect(summary).not.toHaveProperty('url');
    expect(summary).not.toHaveProperty('cost');
  });
});
