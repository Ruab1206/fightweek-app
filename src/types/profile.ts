// ──────────────────────────────────────────────
// Fighter Profile types (#1058 / 1.12 — Fighter Profiles)
// A public, read-only profile a promoter/matchmaker can view by link.
// Stored at artifacts/production/public/data/profiles/{emailKey}.
// Keyed by the fighter's email (the stable id from #1191).
// ──────────────────────────────────────────────

export interface FighterRecord {
  wins: number;
  losses: number;
  draws: number;
  /** How wins come — the matchmaker's key signal. */
  koWins: number;
  subWins: number;
}

export type FighterLevel = 'amateur' | 'professional';

export interface FighterProfile {
  /** Doc key = the fighter's email (stable id). */
  emailKey: string;
  name: string;
  /** Pasted image URL (any share link). No upload in v1. */
  photoUrl: string;
  record: FighterRecord;
  weightClass: string;
  level: FighterLevel;
  gym: string;
  /** Striker / grappler / well-rounded etc. — free text or comma list. */
  disciplines: string;
  /** Short narrative bio — who the fighter is, their style and story (#1200). */
  description: string;
  age: number | null;
  /** Centimetres. */
  heightCm: number | null;
  /** Centimetres. */
  reachCm: number | null;
  stance: string;
  accomplishments: string;
  /** Pasted YouTube/Vimeo (unlisted) or any share link. */
  footageUrl: string;
  /** How a promoter reaches the fighter or coach. */
  contact: string;
  /** Draft by default; only published profiles are public (#1195). */
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_RECORD: FighterRecord = { wins: 0, losses: 0, draws: 0, koWins: 0, subWins: 0 };

/** A blank profile for a given email key — draft (unpublished) by default. */
export function emptyFighterProfile(emailKey: string, name = ''): FighterProfile {
  const now = new Date().toISOString();
  return {
    emailKey,
    name,
    photoUrl: '',
    record: { ...EMPTY_RECORD },
    weightClass: '',
    level: 'amateur',
    gym: '',
    disciplines: '',
    description: '',
    age: null,
    heightCm: null,
    reachCm: null,
    stance: '',
    accomplishments: '',
    footageUrl: '',
    contact: '',
    published: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Format a record as "W–L–D" (with finishes if any). */
export function formatRecord(r: FighterRecord): string {
  const base = `${r.wins}–${r.losses}–${r.draws}`;
  const finishes = r.koWins + r.subWins;
  if (r.wins > 0 && finishes > 0) {
    const pct = Math.round((finishes / r.wins) * 100);
    return `${base} (${pct}% finishes)`;
  }
  return base;
}
