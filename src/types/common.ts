/**
 * Aktivitet Type Definitions
 * Types for calendar entries (aktiviteter): træning, fravær, events.
 * See docs/DOMAIN_MODEL.md for terminology.
 */

// User & Auth Types
export interface UserProfile {
  email: string;
  name: string;
  role: 'fighter' | 'coach' | 'admin';
  uid: string;
}

// Day name literal type
export type DayName = 'Mandag' | 'Tirsdag' | 'Onsdag' | 'Torsdag' | 'Fredag' | 'Lørdag' | 'Søndag';

// Træning (training aktivitet) — added from catalogue or manually
export interface TrainingSession {
  id?: string | number;
  day: string;
  name: string;
  category: string;
  start: string;
  end: string;
  location: string;
  status: 'active' | 'cancelled';
  cancellationReason?: string;
  cancellationTime?: string | null;
  catalogueClassId?: string;
  isRecurring?: boolean;
  recurrenceInterval?: number;
  recurrenceStartWeek?: number;
  sessionDate?: string;
  type?: string;
}

// Fravær (absence aktivitet) — stored inline with training sessions
export interface FraværSession {
  id: string | number;
  type: 'fravær';
  name: string;
  category: 'Fravær';
  day: string;
  start: string;
  end: string;
  status: 'active' | 'cancelled';
  cancellationReason?: string;
  cancellationTime?: string | null;
  fraværTitel: string;
  fraværBeskrivelse: string;
  fraværGroupId: string;
  fraværDayIndex: number;
  fraværTotalDays: number;
  fraværStartDate: string;
  fraværEndDate: string;
  fraværStartTime: string;
  fraværEndTime: string;
}

// Rest day marker
export interface RestDayMarker {
  id: number;
  isRestDay: true;
}

// Union type for anything stored in a day's aktivitet array
export type SessionEntry = TrainingSession | FraværSession | RestDayMarker;

// A week's schedule data (aktiviteter keyed by day name)
export type WeekSchedule = Record<string, SessionEntry[]>;

export interface StandardWeek {
  fighterId: string;
  sessions: TrainingSession[];
  lastUpdated: string;
  version: number;
}
