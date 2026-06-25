/**
 * MobileScrollView — continuous vertical day scroll (Google Calendar style).
 * Shows a date rail on the left and session cards on the right.
 */
import React, { useRef, useEffect } from 'react';
import {
  Clock, MapPin, AlertCircle, Repeat, CalendarDays, UserPlus,
} from 'lucide-react';

import { CATEGORIES } from '../config/constants';
import { getISOWeekForDate } from '../utils/dateUtils';
import type { ScrollDay } from '../utils/dateUtils';

const DAY_ABBREV: Record<string, string> = { Mandag: 'MAN', Tirsdag: 'TIR', Onsdag: 'ONS', Torsdag: 'TOR', Fredag: 'FRE', Lørdag: 'LØR', Søndag: 'SØN' };

export interface MobileScrollViewProps {
  scrollDays: ScrollDay[];
  multiWeekData: Record<number, any>;
  isDark: boolean;
  onEditSession: (day: string, session: any, weekNum: number) => void;
  onFraværClick: (session: any, dayKey: string) => void;
  todayRef: React.RefObject<HTMLDivElement | null>;
  onLoadMorePast: () => void;
  onLoadMoreFuture: () => void;
  initialScrollDone?: boolean;
  visibleFriends?: string[];
  friendWeekData?: Record<string, Record<number, any>>;
  friendColors?: Record<string, string>;
}

const MobileScrollView = ({ scrollDays, multiWeekData, isDark, onEditSession, onFraværClick, todayRef, onLoadMorePast, onLoadMoreFuture, initialScrollDone = false, visibleFriends = [], friendWeekData = {}, friendColors = {} }: MobileScrollViewProps) => {
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
      const visibleSessions = sessions.filter((s: any) => !s.isRestDay && s.type !== 'fravær');
      // Fravær entries
      const fraværSessions = sessions.filter((s: any) => s.type === 'fravær');
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
              {visibleSessions.length === 0 && fraværSessions.length === 0 && (
                <div className={`text-[10px] font-medium py-1.5 ${isDark ? 'text-slate-700' : 'text-ds-text-subtlest/60'}`}>Ingen pas</div>
              )}
              {visibleSessions.map((s: any) => {
                const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                const isCancelled = s.status === 'cancelled';
                const isRecurring = !!s.isRecurring;
                const isEvent = s.type === 'event';
                const isInvitation = s.type === 'invitation';
                return (
                  <div key={s.id} onClick={() => onEditSession(scrollDay.dayName, s, scrollDay.weekNumber)}
                    className={`relative flex items-start p-2 rounded-xl border shadow-sm transition-all cursor-pointer active:scale-[0.98] ${isCancelled ? (isDark ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-red-50 border-red-200 opacity-75') : isInvitation ? (isDark ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200') : isEvent ? (isDark ? 'bg-indigo-950/30 border-indigo-800/50' : 'bg-indigo-50 border-indigo-200') : (isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-white border-surface-border')}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${isCancelled ? 'opacity-50' : ''}`}></div>
                    <div className="flex-1 pl-2.5 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className={`font-bold text-xs leading-tight mb-0.5 line-clamp-2 ${isCancelled ? (isDark ? 'line-through text-slate-500' : 'line-through text-ds-text-subtlest') : (isDark ? 'text-white' : 'text-ds-text')}`}>{s.name}</h4>
                        {isRecurring && <Repeat className={`w-3 h-3 shrink-0 mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />}
                      </div>
                      <div className={`flex flex-col gap-0.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                        <span className="flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.start} - {s.end}</span>
                        <span className="flex items-center truncate"><MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.location}</span>
                      </div>
                      {isInvitation && <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}><UserPlus className="w-2.5 h-2.5" />{s.invitedByName ? `Fra ${s.invitedByName}` : 'Invitation'}</span>}
                      {isEvent && <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase mt-0.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}><CalendarDays className="w-2.5 h-2.5" />Event</span>}
                      {isCancelled && <div className="mt-0.5 text-[9px] text-red-400 flex items-center"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Aflyst{s.cancellationReason ? `: ${s.cancellationReason}` : ''}</div>}
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
