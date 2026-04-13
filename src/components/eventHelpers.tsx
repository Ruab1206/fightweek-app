/**
 * eventHelpers — shared utilities, badges, and constants used by
 * EventsPage, EventDetail, and EventCard.
 */
import { Trophy, BookOpen, PartyPopper, CalendarDays } from 'lucide-react';
import { CATEGORIES } from '../config/constants';
import { disciplineToCategory } from './InlineCataloguePicker';
import type { FightweekEvent, EventType, EventSignupStatus } from '../types/event';

// ── Category color from discipline ──
export function getCategoryColor(discipline?: string): { color: string; border: string; label: string } {
  if (!discipline) return CATEGORIES[6]; // 'Andet'
  const catLabel = disciplineToCategory(discipline);
  return CATEGORIES.find(c => c.label === catLabel) || CATEGORIES[6];
}

// ── Event type styling ──
export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string; darkColor: string; icon: typeof Trophy }> = {
  tournament: { label: 'Stævne', color: 'bg-red-100 text-red-700 border-red-200', darkColor: 'bg-red-900/30 text-red-400 border-red-800', icon: Trophy },
  seminar:    { label: 'Seminar', color: 'bg-blue-100 text-blue-700 border-blue-200', darkColor: 'bg-blue-900/30 text-blue-400 border-blue-800', icon: BookOpen },
  social:     { label: 'Socialt', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', darkColor: 'bg-emerald-900/30 text-emerald-400 border-emerald-800', icon: PartyPopper },
  other:      { label: 'Andet', color: 'bg-slate-100 text-slate-700 border-slate-200', darkColor: 'bg-slate-800 text-slate-400 border-slate-700', icon: CalendarDays },
};

export function formatDateDa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateRange(date: string, endDate?: string): string {
  if (!endDate || endDate === date) return formatDateDa(date);
  return `${formatDateDa(date)} – ${formatDateDa(endDate)}`;
}

export function isEventPast(evt: FightweekEvent): boolean {
  const checkDate = evt.endDate || evt.date;
  return new Date(checkDate + 'T23:59:59') < new Date();
}

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Haversine distance (km) ──
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Type badge component ──
export function TypeBadge({ type, isDark }: { type: EventType; isDark: boolean }) {
  const cfg = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.other;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isDark ? cfg.darkColor : cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Sign-up summary component ──
export function SignupSummary({ signups, isDark }: { signups: Record<string, EventSignupStatus>; isDark: boolean }) {
  const interested = Object.entries(signups).filter(([, s]) => s === 'interested').map(([n]) => n);
  const signedUp = Object.entries(signups).filter(([, s]) => s === 'signed-up').map(([n]) => n);
  if (interested.length === 0 && signedUp.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 mt-1.5 ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
      {signedUp.map(n => (
        <span key={n} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>{n}</span>
      ))}
      {interested.map(n => (
        <span key={n} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>{n}</span>
      ))}
    </div>
  );
}

// ── Signup options ──
export const SIGNUP_OPTIONS: { value: EventSignupStatus; label: string; activeColor: string; darkActiveColor: string }[] = [
  { value: 'signed-up', label: 'Tilmeldt', activeColor: 'bg-emerald-600 text-white border-emerald-600', darkActiveColor: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'interested', label: 'Interesseret', activeColor: 'bg-blue-600 text-white border-blue-600', darkActiveColor: 'bg-blue-600 text-white border-blue-600' },
  { value: 'declined', label: 'Ikke interesseret', activeColor: 'bg-red-600 text-white border-red-600', darkActiveColor: 'bg-red-600 text-white border-red-600' },
];
