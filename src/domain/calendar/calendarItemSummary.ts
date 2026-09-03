/**
 * calendarItemSummary.ts — smaller, source-neutral rendering read contract
 * for calendar cells and list items (PersonalSchedule/MobileScrollView/
 * SearchOverlay — not yet wired to any of them in this slice), sibling to
 * the open/detail contract in `calendarItemDetail.ts` (see
 * `/docs/self_posted_lifecycle_and_invariants.md` Section I step 4 and the
 * full-calendar readiness checkpoint in
 * `/docs/fightweek_refactoring_plan.md`).
 *
 * Pure types only — no Firebase, no React. Reuses `CalendarItemKey` and
 * `CalendarSource` from `calendarItemDetail.ts` unchanged, so summary and
 * detail records share opaque identity and source vocabulary without one
 * depending on the other or creating a competing lifecycle. Deliberately
 * smaller than `CalendarItemDetail`: no description/organiser/url/cost/
 * contact fields, no capabilities, no source-specific action callbacks.
 * Opening an item is a later, separately-designed intent (open by
 * `CalendarItemKey`) resolved by the caller to the correct existing detail
 * surface — this contract does not decide which detail component opens.
 */
import type { CalendarItemKey, CalendarSource } from './calendarItemDetail';

/**
 * Generic, source-neutral rendering projection for a small badge/icon on a
 * calendar card (recurrence, event type, invitation inviter/response, …).
 * Presentation looks up icon/placement/colour by `kind` only — never by
 * inspecting `CalendarSource` — so adding a new indicator kind never
 * requires presentation to branch on source. Data only: no callback, no
 * raw source record, no routing information, no capability, no domain
 * status (RSVP/Participation/Favorite/TrainingLog are not represented
 * here).
 */
export interface CalendarItemIndicator {
  kind: 'recurring' | 'event' | 'invitation_inviter' | 'invitation_response';
  label: string;
  tone?: 'neutral' | 'positive' | 'attention';
  accessibilityLabel?: string;
}

/**
 * The smallest source-neutral rendering read model needed by current
 * calendar cards and search-result items.
 */
export interface CalendarItemSummary {
  itemKey: CalendarItemKey;
  /** Present only when the source already has canonical `EventOccurrence` identity. */
  occurrenceId?: string;
  /** Present only when the source already has canonical `CalendarEntry` identity. */
  calendarEntryId?: string;
  source: CalendarSource;
  title: string;
  dateISO: string;
  startDateTime: string;
  endDateTime: string;
  /** Visual category/colour classification — same field name as `CalendarItemDetail`. */
  category?: string;
  location?: string;
  availability: {
    status: 'active' | 'cancelled';
    cancellationReason?: string;
  };
  /** Small, generic presentation badges (recurrence, event type, invitation inviter/response). Omitted when a source has none. */
  indicators?: CalendarItemIndicator[];
}
