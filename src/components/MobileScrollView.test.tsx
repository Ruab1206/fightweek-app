// @vitest-environment jsdom
/**
 * MobileScrollView.test.tsx — the non-fravær card path renders exclusively
 * from CalendarItemSummary and emits only the opaque CalendarItemKey on
 * click (see calendarItemSummary.ts / calendarItemProjection.ts). Fravær
 * and the friend-overlay list remain on their existing raw-session path,
 * unchanged. No Firebase, no routing — App.tsx owns key resolution.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileScrollView from './MobileScrollView';
import type { ScrollDay } from '../utils/dateUtils';
import type { CalendarItemSummary } from '../domain/calendar/calendarItemSummary';
import type { CalendarItemKey } from '../domain/calendar/calendarItemDetail';
import { mapLegacySessionToCalendarItemSummary } from '../domain/calendar/legacySessionSummaryAdapter';
import { mapEventSessionToCalendarItemSummary } from '../domain/calendar/eventSessionSummaryAdapter';
import { mapInvitationSessionToCalendarItemSummary } from '../domain/calendar/invitationSummaryAdapter';
import { mapProjectedCalendarEntryToCalendarItemSummary } from '../domain/calendar/projectedCalendarEntrySummaryAdapter';

// jsdom has no IntersectionObserver; MobileScrollView only uses it to trigger
// infinite-scroll loading, unrelated to card rendering under test here.
beforeAll(() => {
  (globalThis as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const DAY_KEY = '2026-08-17';
const context = { weekNumber: 33, dateISO: DAY_KEY };

function makeScrollDay(overrides: Partial<ScrollDay> = {}): ScrollDay {
  return {
    date: new Date('2026-08-17T00:00:00'),
    dayName: 'Mandag',
    weekNumber: 33,
    dateLabel: '17. august',
    monthLabel: 'august',
    isToday: false,
    key: DAY_KEY,
    ...overrides,
  };
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    scrollDays: [makeScrollDay()],
    multiWeekData: {},
    calendarItemsByDayKey: {},
    isDark: false,
    onOpenItem: vi.fn(),
    onFraværClick: vi.fn(),
    todayRef: { current: null },
    onLoadMorePast: vi.fn(),
    onLoadMoreFuture: vi.fn(),
    ...overrides,
  };
}

describe('MobileScrollView — non-fravær cards render from CalendarItemSummary', () => {
  // 1. Legacy self-posted card.
  it('renders a legacy self-posted card', () => {
    const summary = mapLegacySessionToCalendarItemSummary(
      { id: 's1', day: 'Mandag', name: 'MMA Sparring', category: 'MMA', start: '17:00', end: '18:30', location: 'Klub A', status: 'active' },
      context,
    );
    render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(screen.getByText('MMA Sparring')).toBeTruthy();
  });

  // 2. Recurring card and recurrence indicator.
  it('renders the recurrence icon for a recurring card', () => {
    const summary = mapLegacySessionToCalendarItemSummary(
      { id: 's1', day: 'Mandag', name: 'MMA Sparring', category: 'MMA', start: '17:00', end: '18:30', location: 'Klub A', status: 'active', isRecurring: true },
      context,
    );
    const { container } = render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(container.querySelector('svg.lucide-repeat')).toBeTruthy();
  });

  // 3. Event card and event indicator.
  it('renders an event card with the generic Event indicator', () => {
    const summary = mapEventSessionToCalendarItemSummary(
      { id: 'e1', name: 'DM i Brydning 2026', category: 'MMA', start: '09:00', end: '18:00', location: 'Brøndby Hallen', status: 'active', type: 'event', eventId: 'ev_1' } as any,
      context,
    );
    render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(screen.getByText('DM i Brydning 2026')).toBeTruthy();
    expect(screen.getByText('Event')).toBeTruthy();
  });

  // 4. Invitation card, response badge and inviter.
  it('renders an invitation card with the generic inviter and response indicators', () => {
    const summary = mapInvitationSessionToCalendarItemSummary(
      { id: 'i1', name: 'BJJ open mat', category: 'BJJ', start: '19:00', end: '20:00', location: 'Klub B', status: 'active', type: 'invitation', invitationId: 'inv_1', invitationResponse: 'accepted', invitationCancelled: false, invitedByName: 'Karl' },
      context,
    );
    render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(screen.getByText('Fra Karl')).toBeTruthy();
    expect(screen.getByText('Du deltager')).toBeTruthy();
  });

  // 5. Projected calendar-entry card.
  it('renders a projected calendar_entry card', () => {
    const summary = mapProjectedCalendarEntryToCalendarItemSummary(
      { type: 'calendar_entry', readOnly: true, aggregateId: 'agg_1', occurrenceId: 'occ_1', calendarEntryId: 'ce_1', name: 'Solo run', category: 'MMA', start: '06:00', end: '07:00', location: 'Parken', status: 'active' } as any,
      context,
    );
    render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(screen.getByText('Solo run')).toBeTruthy();
  });

  // 6. Cancelled card and cancellation reason.
  it('renders cancellation styling and reason', () => {
    const summary = mapLegacySessionToCalendarItemSummary(
      { id: 's1', day: 'Mandag', name: 'MMA Sparring', category: 'MMA', start: '17:00', end: '18:30', location: 'Klub A', status: 'cancelled', cancellationReason: 'Skade' },
      context,
    );
    render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(screen.getByText('Aflyst: Skade')).toBeTruthy();
  });

  // 7. Category colour input.
  it('passes summary.category through for colour classification', () => {
    const summary = mapLegacySessionToCalendarItemSummary(
      { id: 's1', day: 'Mandag', name: 'Brydning Fundamentals', category: 'Brydning', start: '18:00', end: '19:00', location: 'Klub A', status: 'active' },
      context,
    );
    const { container } = render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(container.querySelector('.bg-emerald-600')).toBeTruthy();
  });

  // 8. Location.
  it('renders summary.location', () => {
    const summary = mapLegacySessionToCalendarItemSummary(
      { id: 's1', day: 'Mandag', name: 'MMA Sparring', category: 'MMA', start: '17:00', end: '18:30', location: 'Klub A', status: 'active' },
      context,
    );
    render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(screen.getByText('Klub A')).toBeTruthy();
  });

  // 9 / 12. Click behaviour: emits only the opaque CalendarItemKey.
  it('calls onOpenItem with only the opaque CalendarItemKey on click', () => {
    const onOpenItem = vi.fn();
    const summary = mapLegacySessionToCalendarItemSummary(
      { id: 's1', day: 'Mandag', name: 'MMA Sparring', category: 'MMA', start: '17:00', end: '18:30', location: 'Klub A', status: 'active' },
      context,
    );
    render(<MobileScrollView {...baseProps({ onOpenItem, calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    fireEvent.click(screen.getByText('MMA Sparring'));
    expect(onOpenItem).toHaveBeenCalledTimes(1);
    expect(onOpenItem).toHaveBeenCalledWith(summary.itemKey);
    expect(typeof onOpenItem.mock.calls[0][0]).toBe('string');
  });

  // 10. Fravær remains on its own, unaffected raw path.
  it('renders fravær on its own path, unaffected by the migrated card path', () => {
    const onFraværClick = vi.fn();
    const props = baseProps({
      onFraværClick,
      multiWeekData: {
        33: { Mandag: [{ id: 'f1', type: 'fravær', name: 'Ferie', fraværTitel: 'Ferie', start: '00:00', end: '23:59', status: 'active' }] },
      },
    });
    render(<MobileScrollView {...props} />);
    fireEvent.click(screen.getByText('Ferie'));
    expect(onFraværClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }), DAY_KEY);
  });

  // 11. The migrated card path renders correctly from CalendarItemSummary
  // fields alone — no id/type/invitationId/eventId/catalogueClassId or any
  // other raw-source field is required.
  it('renders correctly from a plain CalendarItemSummary object with no raw-source fields', () => {
    const summary: CalendarItemSummary = {
      itemKey: 'event:ev_9' as CalendarItemKey,
      source: 'event',
      title: 'Only-summary-fields item',
      dateISO: DAY_KEY,
      startDateTime: `${DAY_KEY}T10:00:00`,
      endDateTime: `${DAY_KEY}T11:00:00`,
      location: 'Somewhere',
      category: 'MMA',
      availability: { status: 'active' },
    };
    render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(screen.getByText('Only-summary-fields item')).toBeTruthy();
    expect(screen.getByText('10:00 - 11:00')).toBeTruthy();
  });

  // 17 / 18. Indicator rendering is generic — driven by indicator.kind only,
  // never by summary.source. Proven with a made-up, unrecognised source
  // value paired with a normal indicators array.
  it('renders indicators by kind alone, never by inspecting summary.source', () => {
    const summary: CalendarItemSummary = {
      itemKey: 'event:ev_10' as CalendarItemKey,
      source: 'not_a_real_source' as any,
      title: 'Foreign-source item',
      dateISO: DAY_KEY,
      startDateTime: `${DAY_KEY}T10:00:00`,
      endDateTime: `${DAY_KEY}T11:00:00`,
      availability: { status: 'active' },
      indicators: [{ kind: 'event', label: 'Event' }],
    };
    render(<MobileScrollView {...baseProps({ calendarItemsByDayKey: { [DAY_KEY]: [summary] } })} />);
    expect(screen.getByText('Foreign-source item')).toBeTruthy();
    expect(screen.getByText('Event')).toBeTruthy();
  });
});

