// ──────────────────────────────────────────────
// Catalogue types — class catalog for cross-gym training offers
// ──────────────────────────────────────────────

/** A recurring weekly timeslot for a class */
export interface ClassSchedule {
  dayOfWeek: number;   // 1=Mon … 7=Sun (ISO 8601, maps to Google Calendar BYDAY)
  startTime: string;   // "17:00" (HH:mm)
  endTime: string;     // "18:30" (HH:mm)
}

/** A training class offered by a gym */
export interface CatalogueClass {
  id: string;
  title: string;                    // "Thaiboksning Elite"
  discipline: string;               // "Muay Thai", "MMA", "BJJ", "S&C", "Boxing"
  subDiscipline?: string;           // "Thai clinch", "Wall wrestling" — technique focus
  level: string;                    // "Beginner", "Advanced", "Kamphold", "Elite", "Pro"
  ageGroup?: string;                // "6-12 år", "13-17 år" — separate from level

  // Gym / location
  gym: string;                      // "Fightworld", "BurnellMMA"
  location: string;                 // Display name for the venue
  address?: string;                 // Street address — maps to Google Calendar location

  // Schedule (one entry per recurring weekly timeslot)
  schedules: ClassSchedule[];

  // Metadata
  instructor?: string;
  description?: string;             // Free-text details, prerequisites, notes

  // Rating visibility — when fighters log intensity/relevance, averages shown here
  showRatings: boolean;

  // Housekeeping
  source: string;                   // "holdoversigt-import" | "manual"
  createdBy?: string;               // Email of creator — set automatically on create
  createdAt: string;                // ISO 8601
  updatedAt: string;                // ISO 8601
}
