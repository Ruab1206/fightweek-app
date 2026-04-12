// ──────────────────────────────────────────────
// Event — one-off activities (tournaments, seminars, social)
// See docs/DOMAIN_MODEL.md for terminology
// ──────────────────────────────────────────────

export type EventType = 'tournament' | 'seminar' | 'social' | 'other';

/** Sign-up status for a team member */
export type EventSignupStatus = 'interested' | 'signed-up' | 'declined';

/** A one-off event (tournament, seminar, social gathering, etc.) */
export interface FightweekEvent {
  id: string;
  title: string;                       // "DM i Brydning 2026"
  type: EventType;                     // tournament / seminar / social / other
  discipline?: string;                 // "Brydning", "MMA", "BJJ" — optional

  // Date & time
  date: string;                        // ISO date "2026-05-16"
  endDate?: string;                    // ISO date — for multi-day events
  startTime?: string;                  // "09:00" (HH:mm)
  endTime?: string;                    // "18:00" (HH:mm)

  // Location
  location?: string;                   // Venue name
  address?: string;                    // Street address (Google Maps link)
  latitude?: number;                   // GPS latitude for distance filtering
  longitude?: number;                  // GPS longitude for distance filtering

  // Details
  description?: string;                // Free-text info
  organiser?: string;                  // Organising body / club
  url?: string;                        // External registration / info page
  cost?: string;                       // "250 kr" — free text

  // Contact
  contactName?: string;                // Contact person name
  contactEmail?: string;               // Contact email
  contactPhone?: string;               // Contact phone number

  // Deadlines
  registrationDeadline?: string;       // ISO date

  // Team sign-ups: fighter name → status
  signups: Record<string, EventSignupStatus>;

  // Housekeeping
  createdBy: string;                   // Email of creator
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
}
