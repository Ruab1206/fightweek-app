/**
 * FightWeek Constants
 * Central location for all app-wide constants, templates, and mappings.
 * Changes here affect the entire app.
 */

export const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

export const CATEGORIES = [
  { label: 'MMA', color: 'bg-red-600', border: 'border-red-600' },
  { label: 'Brydning', color: 'bg-emerald-600', border: 'border-emerald-600' },
  { label: 'Grappling', color: 'bg-purple-600', border: 'border-purple-600' },
  { label: 'Boksning', color: 'bg-yellow-600', border: 'border-yellow-600' },
  { label: 'Kickboxing', color: 'bg-orange-500', border: 'border-orange-500' },
  { label: 'Fysisk træning', color: 'bg-stone-600', border: 'border-stone-600' },
  { label: 'Andet', color: 'bg-slate-500', border: 'border-slate-500' }
];

export const USER_MAPPING: Record<string, { name: string; role: 'fighter' | 'coach' | 'admin' }> = {
  'carolinemollerh@gmail.com': { name: 'Caroline', role: 'fighter' },
  'sankarem00@gmail.com': { name: 'San', role: 'fighter' },
  'eneasopa354@gmail.com': { name: 'Enea', role: 'fighter' },
  'anton.emil.bang@gmail.com': { name: 'Anton', role: 'fighter' },
  'duraceljones@gmail.com': { name: 'Jonas', role: 'fighter' },
  'lindsgren@gmail.com': { name: 'Chris', role: 'fighter' },
  'karl.lindsgren@gmail.com': { name: 'Karl', role: 'fighter' },
  'frode.lindsgren@gmail.com': { name: 'Frode', role: 'fighter' },
  'frodihansen@hotmail.com': { name: 'Frodi', role: 'coach' }, 
  'rune.abrahamsson@gmail.com': { name: 'Rune', role: 'admin' }
};

export const FIGHTERS = ['Caroline', 'Chris', 'San', 'Enea', 'Anton', 'Jonas', 'Karl', 'Frode'];

// Shared day-of-week mapping (ISO: 1=Monday … 7=Sunday)
export const DAY_NAMES: Record<number, string> = { 1: 'Mandag', 2: 'Tirsdag', 3: 'Onsdag', 4: 'Torsdag', 5: 'Fredag', 6: 'Lørdag', 7: 'Søndag' };

// Recurrence interval options
export const RECURRENCE_OPTIONS = [
  { label: 'Gentag ikke', value: 0 },
  { label: 'Hver uge', value: 1 },
  { label: 'Hver 2. uge', value: 2 },
  { label: 'Hver 3. uge', value: 3 },
  { label: 'Hver 4. uge', value: 4 },
];

// Google Maps search link
export function googleMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Firestore paths
export const ROOT_COLLECTION = `artifacts/production/users`;
export const PUBLIC_DATA_PATH = `artifacts/production/public/data`;
