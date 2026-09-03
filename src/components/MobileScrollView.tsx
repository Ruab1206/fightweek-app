/**
 * MobileScrollView — continuous vertical day scroll (Google Calendar style).
 * Shows a date rail on the left and session cards on the right.
 *
 * The non-fravær card list renders exclusively from `CalendarItemSummary`
 * (see `calendarItemSummary.ts`) and emits only the opaque `CalendarItemKey`
 * on click — it never receives or inspects a raw session/event/invitation/
 * calendar_entry record, and never branches on `CalendarSource`. Card
 * placement/colour differentiation and badges are driven entirely by
 * `summary.category`/`summary.availability`/`summary.indicators` (a small,
 * generic presentation projection — see `CalendarItemIndicator`), looked up
 * by `indicator.kind` only. Fravær and the friend-overlay list are
 * unaffected: they remain on their existing raw `multiWeekData` path.
 */
import React, { useRef, useEffect } from 'react';
import {
  Clock, MapPin, AlertCircle, Repeat, CalendarDays, UserPlus,
} from 'lucide-react';

import { CATEGORIES } from '../config/constants';
import { getISOWeekForDate } from '../utils/dateUtils';
import type { ScrollDay } from '../utils/dateUtils';
import type { CalendarItemSummary, CalendarItemIndicator } from '../domain/calendar/calendarItemSummary';
import type { CalendarItemKey } from '../domain/calendar/calendarItemDetail';

const DAY_ABBREV: Record<string, string> = { Mandag: 'MAN', Tirsdag: 'TIR', Onsdag: 'ONS', Torsdag: 'TOR', Fredag: 'FRE', Lørdag: 'LØR', Søndag: 'SØN' };

/** ISO "YYYY-MM-DDTHH:mm:00" → "HH:mm" — the exact reverse of the existing `toDateTime` helper. */
function hhmm(dateTime: string): string {
  return dateTime.slice(11, 16);
}

/** Renders one generic indicator by `kind` only — never inspects `CalendarSource`. */
function IndicatorBadge({ indicator, isCancelled, isDark }: { indicator: CalendarItemIndicator; isCancelled: boolean; isDark: boolean }) {
  if (indicator.kind === 'invitation_inviter') {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase ${isCancelled ? 'text-red-400' : (isDark ? 'text-emerald-400' : 'text-emerald-600')}`}>
        <UserPlus className="w-2.5 h-2.5" />{indicator.label}
      </span>
    );
  }
  if (indicator.kind === 'invitation_response') {
    const toneCls = indicator.tone === 'positive' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600');
    return (
      <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase ${toneCls}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />{indicator.label}
      </span>
    );
  }
  if (indicator.kind === 'event') {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase mt-0.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
        <CalendarDays className="w-2.5 h-2.5" />{indicator.label}
      </span>
    );
  }
  return null; // 'recurring' is rendered next to the title, not in the badge block.
}

export interface MobileScrollViewProps {
  scrollDays: ScrollDay[];
  multiWeekData: Record<number, any>;
  /** Non-fravær calendar cards per scroll day, keyed by `scrollDay.key`. */
  calendarItemsByDayKey: Record<string, CalendarItemSummary[]>;
  isDark: boolean;
  onOpenItem: (itemKey: CalendarItemKey) => void;
  onFraværClick: (session: any, dayKey: string) => void;
  todayRef: React.RefObject<HTMLDivElement | null>;
  onLoadMorePast: () => void;
  onLoadMoreFuture: () => void;
  initialScrollDone?: boolean;
  visibleFriends?: string[];
  friendWeekData?: Record<string, Record<number, any>>;
  friendColors?: Record<string, string>;
}

const MobileScrollView = ({ scrollDays, multiWeekData, calendarItemsByDayKey, isDark, onOpenItem, onFraværClick, todayRef, onLoadMorePast, onLoadMoreFuture, initialScrollDone = false, visibleFriends = [], friendWeekData = {}, friendColors = {} }: MobileScrollViewProps) => {
  const topSentinel = useRef<HTMLDivElement | null>(null);
  const bottomSentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target === topSentinel.current) onLoadMorePast();
        if (entry.target === bottomSentinel.current) onLoadMoreFuture();
      }
    }, { rootMargin: '400px' });
    // Only observe top sentinel after initial scroll-to-today has completed
    // to prevent prepending content that shifts the viewport
    if (initialScrollDone && topSentinel.current) observer.observe(topSentinel.current);
    if (bottomSentinel.current) observer.observe(bottomSentinel.current);
    return () => observer.disconnect();
  }, [onLoadMorePast, onLoadMoreFuture, initialScrollDone]);

  return (
  <div className="pb-32 fade-in">
    <div ref={topSentinel} className="h-1" />
    {scrollDays.map((scrollDay, idx) => {
      const weekData = multiWeekData[scrollDay.weekNumber] || {};
      const sessions = weekData[scrollDay.dayName] || [];
      // Fravær entries
      const fraværSessions = sessions.filter((s: any) => s.type === 'fravær');
      const calendarItems = calendarItemsByDayKey[scrollDay.key] || [];
      const showWeekDivider = idx > 0 && scrollDay.dayName === 'Mandag';
      const dayNum = scrollDay.date.getDate();

      return (
        <React.Fragment key={scrollDay.key}>
          {showWeekDivider && (
            <div className={`flex items-center gap-2 pt-3 pb-1 px-4 ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>
              <div className={`flex-1 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Uge {getISOWeekForDate(scrollDay.date)}</span>
              <div className={`flex-1 border-t ${isDark ? 'border-slate-800' : 'border-surface-border'}`} />
            </div>
          )}
          {/* Date-rail row */}
          <div
            id={`day-${scrollDay.key}`}
            ref={scrollDay.isToday ? todayRef : undefined}
            style={{ scrollMarginTop: '82px' }}
            className={`flex items-start gap-0 border-b ${isDark ? 'border-slate-800/50' : 'border-surface-border/50'}`}
          >
            {/* Left date rail */}
            <div className={`w-12 shrink-0 pt-2 pb-2 flex flex-col items-center sticky top-[73px] z-[5] ${isDark ? 'bg-slate-950' : 'bg-surface-subtle'}`}>
              <span className={`text-[9px] font-bold uppercase tracking-wide ${scrollDay.isToday ? 'text-blue-500' : (isDark ? 'text-slate-500' : 'text-ds-text-subtlest')}`}>{DAY_ABBREV[scrollDay.dayName] || scrollDay.dayName.slice(0, 3).toUpperCase()}</span>
              <span className={`text-lg font-bold leading-tight ${scrollDay.isToday ? 'text-white bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center' : (isDark ? 'text-slate-300' : 'text-ds-text')}`}>{dayNum}</span>
            </div>
            {/* Right content area */}
            <div className="flex-1 min-w-0 py-1.5 pr-4 space-y-1">
              {/* Fravær blocks */}
              {fraværSessions.map((s: any) => {
                const title = s.fraværTitel || s.name || 'Fravær';
                const total = s.fraværTotalDays || 1;
                const dayIdx = s.fraværDayIndex || 1;
                const isFirst = dayIdx === 1;
                const isLast = dayIdx === total;
                const isSingle = total === 1;
                return (
                  <div key={s.id}
                    onClick={() => onFraværClick(s, scrollDay.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer active:scale-[0.98] transition-all ${isDark ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-800'}`}>
                    <span className="font-bold">{title}</span>
                    {!isSingle && <span className="opacity-70"> (dag {dayIdx}/{total})</span>}
                    {isSingle && <span className="opacity-70"> · {s.start} — {s.end}</span>}
                    {!isSingle && isFirst && <span className="opacity-70"> · Fra {s.start}</span>}
                    {!isSingle && isLast && <span className="opacity-70"> · Indtil {s.end}</span>}
                  </div>
                );
              })}
              {/* Session cards */}
              {calendarItems.length === 0 && fraværSessions.length === 0 && (
                <div className={`text-[10px] font-medium py-1.5 ${isDark ? 'text-slate-700' : 'text-ds-text-subtlest/60'}`}>Ingen pas</div>
              )}
              {calendarItems.map((item) => {
                const cat = CATEGORIES.find(c => c.label === item.category) || CATEGORIES[6];
                const isCancelled = item.availability.status === 'cancelled';
                const recurringIndicator = item.indicators?.find((i) => i.kind === 'recurring');
                const inviterIndicator = item.indicators?.find((i) => i.kind === 'invitation_inviter');
                const responseIndicator = item.indicators?.find((i) => i.kind === 'invitation_response');
                const eventIndicator = item.indicators?.find((i) => i.kind === 'event');
                return (
                  <div key={item.itemKey} onClick={() => onOpenItem(item.itemKey)}
                    className={`relative flex items-start p-2 rounded-xl border shadow-sm transition-all cursor-pointer active:scale-[0.98] ${isCancelled ? (isDark ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-red-50 border-red-200 opacity-75') : inviterIndicator ? (isDark ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200') : eventIndicator ? (isDark ? 'bg-indigo-950/30 border-indigo-800/50' : 'bg-indigo-50 border-indigo-200') : (isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-white border-surface-border')}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${isCancelled ? 'opacity-50' : ''}`}></div>
                    <div className="flex-1 pl-2.5 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className={`font-bold text-xs leading-tight mb-0.5 line-clamp-2 ${isCancelled ? (isDark ? 'line-through text-slate-500' : 'line-through text-ds-text-subtlest') : (isDark ? 'text-white' : 'text-ds-text')}`}>{item.title}</h4>
                        {recurringIndicator && <Repeat className={`w-3 h-3 shrink-0 mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />}
                      </div>
                      <div className={`flex flex-col gap-0.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                        <span className="flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />{hhmm(item.startDateTime)} - {hhmm(item.endDateTime)}</span>
                        <span className="flex items-center truncate"><MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />{item.location}</span>
                      </div>
                      {inviterIndicator && (
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          <IndicatorBadge indicator={inviterIndicator} isCancelled={isCancelled} isDark={isDark} />
                          {responseIndicator && <IndicatorBadge indicator={responseIndicator} isCancelled={isCancelled} isDark={isDark} />}
                        </div>
                      )}
                      {eventIndicator && <IndicatorBadge indicator={eventIndicator} isCancelled={isCancelled} isDark={isDark} />}
                      {isCancelled && <div className="mt-0.5 text-[9px] text-red-400 flex items-center"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Aflyst{item.availability.cancellationReason ? `: ${item.availability.cancellationReason}` : ''}</div>}
                    </div>
                  </div>
                );
              })}
              {/* Friend sessions overlay */}
              {visibleFriends.length > 0 && visibleFriends.map(friend => {
                const fWeek = friendWeekData[friend]?.[scrollDay.weekNumber] || {};
                const fSessions = (fWeek[scrollDay.dayName] || []).filter((s: any) => !s.isRestDay);
                if (fSessions.length === 0) return null;
                const colorClass = friendColors[friend] || 'bg-gray-400';
                return (
                  <div key={friend} className="mt-1">
                    <div className={`text-[9px] font-bold uppercase tracking-wide mb-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{friend}</div>
                    {fSessions.map((s: any) => (
                      <div key={s.id} className={`relative flex items-start p-1.5 rounded-lg mb-1 border opacity-70 ${isDark ? 'bg-slate-800/50 border-slate-700/30' : 'bg-surface-raised/60 border-surface-border/60'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${colorClass}`}></div>
                        <div className="flex-1 pl-2 min-w-0">
                          <h4 className={`font-semibold text-[10px] leading-tight line-clamp-1 ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{s.name}</h4>
                          <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{s.start} - {s.end}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </React.Fragment>
      );
    })}
    <div ref={bottomSentinel} className="h-1" />
  </div>
  );
};

export default MobileScrollView;
