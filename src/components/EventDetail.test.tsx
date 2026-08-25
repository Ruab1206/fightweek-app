// @vitest-environment jsdom
/**
 * EventDetail.test.tsx — first non-self-posted presentation consumer of the
 * shared CalendarItemDetail/CalendarItemCapabilities read contract
 * (see eventDetailAdapter.ts and
 * /docs/self_posted_lifecycle_and_invariants.md Section I step 4).
 *
 * Proves behaviour parity: the common detail/capability fields now cross the
 * shared contract boundary, while native signup, discipline, registration
 * deadline, address/contact info, and date/time formatting remain sourced
 * from the original `FightweekEvent` unchanged. Prefers behaviour assertions
 * over implementation-detail assertions; does not snapshot the component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventDetail } from './EventDetail';
import type { FightweekEvent } from '../types/event';

function makeEvent(overrides: Partial<FightweekEvent> = {}): FightweekEvent {
  return {
    id: 'ev_1',
    title: 'DM i Brydning 2026',
    type: 'tournament',
    date: '2026-09-12',
    startTime: '09:00',
    endTime: '18:00',
    location: 'Brøndby Hallen',
    description: 'Danmarksmesterskab i brydning.',
    organiser: 'Dansk Brydeforbund',
    url: 'https://example.org/dm-brydning',
    cost: '250 kr',
    discipline: 'Brydning',
    address: 'Brøndbyvestervej 1, 2605 Brøndby',
    contactName: 'Jens Hansen',
    contactEmail: 'jens@example.org',
    contactPhone: '12345678',
    registrationDeadline: '2099-01-01',
    signups: {},
    createdBy: 'admin@example.com',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function renderDetail(overrides: Record<string, unknown> = {}) {
  return render(
    <EventDetail
      event={makeEvent()}
      isDark={false}
      fighterName="Karl"
      isAdmin={false}
      onSignup={vi.fn()}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      getNote={() => ''}
      saveNote={vi.fn()}
      {...overrides}
    />,
  );
}

describe('EventDetail — shared contract read boundary', () => {
  // 1. Title renders through adapter output.
  it('renders the event title', () => {
    renderDetail({ event: makeEvent({ title: 'Nordic Open 2026' }) });
    expect(screen.getByText('Nordic Open 2026')).toBeTruthy();
  });

  // 2. Tournament and seminar remain category values of the same event model.
  it.each([
    ['tournament' as const, 'Stævne'],
    ['seminar' as const, 'Seminar'],
  ])('renders the "%s" type label unchanged', (type, label) => {
    renderDetail({ event: makeEvent({ type }) });
    expect(screen.getByText(label)).toBeTruthy();
  });

  // 3. Active and cancelled events render the same cancellation behaviour as before.
  it('shows no "Aflyst" badge for an active event', () => {
    renderDetail({ event: makeEvent({ status: 'active' }) });
    expect(screen.queryByText('Aflyst')).toBeNull();
  });

  it('shows the "Aflyst" badge for a cancelled event', () => {
    renderDetail({ event: makeEvent({ status: 'cancelled', cancellationReason: 'Vejr' }) });
    expect(screen.getByText('Aflyst')).toBeTruthy();
  });

  // 4. Cancellation reason: not currently rendered anywhere in EventDetail —
  // parity means it stays that way, regardless of whether one is supplied.
  it('does not introduce a new cancellation-reason display', () => {
    renderDetail({ event: makeEvent({ status: 'cancelled', cancellationReason: 'Vejr' }) });
    expect(screen.queryByText('Vejr')).toBeNull();
    expect(screen.getByText('Aflyst')).toBeTruthy();
  });

  // 5. Location and description rendering remain unchanged.
  it('renders location and description when present', () => {
    renderDetail({ event: makeEvent({ location: 'Brøndby Hallen', description: 'Danmarksmesterskab i brydning.' }) });
    expect(screen.getByText('Brøndby Hallen')).toBeTruthy();
    expect(screen.getByText('Danmarksmesterskab i brydning.')).toBeTruthy();
  });

  it('omits location and description blocks when absent', () => {
    renderDetail({ event: makeEvent({ location: undefined, address: undefined, description: undefined }) });
    expect(screen.queryByText('Danmarksmesterskab i brydning.')).toBeNull();
  });

  // 6/7. Organiser, URL and cost render when present, and remain absent otherwise.
  it('renders organiser, url link and cost when present', () => {
    renderDetail({ event: makeEvent({ organiser: 'Dansk Brydeforbund', url: 'https://example.org/dm-brydning', cost: '250 kr' }) });
    expect(screen.getByText('Dansk Brydeforbund')).toBeTruthy();
    expect(screen.getByText('250 kr')).toBeTruthy();
    expect(screen.getByRole('link', { name: /læs mere/i }).getAttribute('href')).toBe('https://example.org/dm-brydning');
  });

  it('omits organiser, url and cost when not supplied', () => {
    renderDetail({ event: makeEvent({ organiser: undefined, url: undefined, cost: undefined }) });
    expect(screen.queryByText('Arrangør')).toBeNull();
    expect(screen.queryByRole('link', { name: /læs mere/i })).toBeNull();
    expect(screen.queryByText('Pris')).toBeNull();
  });

  // 8/9. Admin edit/delete behaviour.
  it('gives an admin user edit and delete actions', () => {
    renderDetail({ isAdmin: true });
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(3); // back + edit + delete
  });

  it('does not give a non-admin user edit or delete actions', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderDetail({ isAdmin: false, onEdit, onDelete });
    // Only the back button should be present in the header action area.
    const buttons = screen.getAllByRole('button');
    // No button should invoke onEdit/onDelete since they're not rendered at all.
    buttons.forEach(btn => fireEvent.click(btn));
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  // 10. Existing callbacks remain connected.
  it('invokes onClose when the back button is clicked', () => {
    const onClose = vi.fn();
    renderDetail({ onClose });
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onEdit and onDelete for an admin user', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderDetail({ isAdmin: true, onEdit, onDelete });
    const buttons = screen.getAllByRole('button');
    // buttons[0] = back, buttons[1] = edit, buttons[2] = delete
    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[2]);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  // 11. Notes use the same event note key as before (e_{eventId}).
  it('passes the existing e_{eventId} note key to the notes editor', () => {
    const getNote = vi.fn().mockReturnValue('');
    renderDetail({ event: makeEvent({ id: 'ev_42' }), getNote });
    // NotesEditor calls getNote(noteKey) synchronously on render.
    expect(getNote).toHaveBeenCalledWith('e_ev_42');
  });

  // 12/13. Signup options remain present, and current signup state is read from event.signups.
  it('renders the existing signup options for an upcoming event', () => {
    renderDetail({ event: makeEvent({ date: '2099-01-01' }) });
    expect(screen.getByText('Tilmeldt')).toBeTruthy();
    expect(screen.getByText('Interesseret')).toBeTruthy();
    expect(screen.getByText('Ikke interesseret')).toBeTruthy();
  });

  it('reflects the current fighter signup state from event.signups', () => {
    renderDetail({
      event: makeEvent({ date: '2099-01-01', signups: { Karl: 'signed-up' } }),
      fighterName: 'Karl',
    });
    // The "Holdet" roster row for Karl should show the Tilmeldt status label.
    const karlRow = screen.getByText('Karl').closest('div');
    expect(karlRow?.textContent).toContain('Tilmeldt');
  });

  it('calls onSignup with the selected status', () => {
    const onSignup = vi.fn();
    renderDetail({ event: makeEvent({ date: '2099-01-01', signups: {} }), fighterName: 'Karl', onSignup });
    fireEvent.click(screen.getByText('Interesseret'));
    expect(onSignup).toHaveBeenCalledWith('interested');
  });

  // 14. Team roster behaviour remains available.
  it('renders a team roster section', () => {
    renderDetail();
    expect(screen.getByText('Holdet')).toBeTruthy();
  });

  // 15. Discipline remains rendered from the original event source.
  it('renders discipline from the original event object', () => {
    renderDetail({ event: makeEvent({ discipline: 'Brydning' }) });
    expect(screen.getByText('Brydning')).toBeTruthy();
  });

  // 16. Registration deadline remains rendered from the original event source.
  it('renders the registration deadline label from the original event object', () => {
    renderDetail({ event: makeEvent({ registrationDeadline: '2099-01-01' }) });
    expect(screen.getByText('Tilmeldingsfrist')).toBeTruthy();
  });

  // 17. Address and Google Maps behaviour remain unchanged (sourced from event.address).
  it('renders the address as a Google Maps link from the original event object', () => {
    renderDetail({ event: makeEvent({ address: 'Brøndbyvestervej 1, 2605 Brøndby' }) });
    const link = screen.getByRole('link', { name: /Brøndbyvestervej 1, 2605 Brøndby/ });
    expect(link.getAttribute('href')).toContain('google.com/maps');
  });

  // 18. Contact information remains rendered from the original event source.
  it('renders contact information from the original event object', () => {
    renderDetail({ event: makeEvent({ contactName: 'Jens Hansen', contactEmail: 'jens@example.org', contactPhone: '12345678' }) });
    expect(screen.getByText('Jens Hansen')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'jens@example.org' }).getAttribute('href')).toBe('mailto:jens@example.org');
    expect(screen.getByRole('link', { name: '12345678' }).getAttribute('href')).toBe('tel:12345678');
  });

  // 19. Existing date and time formatting remain unchanged (raw HH:mm, not ISO).
  it('renders start/end time using the existing raw HH:mm formatting, not an ISO datetime', () => {
    renderDetail({ event: makeEvent({ startTime: '09:00', endTime: '18:00' }) });
    expect(screen.getByText('09:00 – 18:00')).toBeTruthy();
    expect(screen.queryByText(/T09:00:00/)).toBeNull();
  });

  // 20-24. No Favorite/CalendarEntry/RSVP/Participation/TrainingLog is introduced.
  it('introduces no Favorite, CalendarEntry-inclusion, RSVP, Participation or TrainingLog UI', () => {
    const { container } = renderDetail();
    const text = container.textContent || '';
    expect(text).not.toMatch(/favorit/i);
    expect(text).not.toMatch(/rsvp/i);
    expect(text).not.toMatch(/deltager/i); // RSVP-style "attending" wording, invitation-only
    expect(screen.queryByText(/træningslog/i)).toBeNull();
  });

  // 25. Public prop contract is unchanged: the component still accepts exactly
  // the original props and renders without a caller change (proven by reusing
  // the exact same prop shape as EventsPage.tsx's call site throughout this file).
  it('renders successfully with exactly the original prop shape', () => {
    expect(() => renderDetail()).not.toThrow();
  });
});
