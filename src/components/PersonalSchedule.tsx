/**
 * PersonalSchedule — desktop/mobile 7-day grid view of the fighter's weekly schedule.
 * Shows session cards, inline catalogue picker (mobile), desktop catalogue overlay,
 * and friend session overlays.
 */
import React from 'react';
import {
  Clock, MapPin, Plus, AlertCircle, Repeat, PenLine, CalendarDays, UserPlus,
} from 'lucide-react';

import { CATEGORIES } from '../config/constants';
import { getDateForWeekDay } from '../utils/dateUtils';
import InlineCataloguePicker, { disciplineToCategory } from './InlineCataloguePicker';
import type { CatalogueClass, ClassSchedule } from '../types/catalogue';
import { invitationBadge } from '../types/invitation';

export interface PersonalScheduleProps {
  days: string[];
  scheduleData: Record<string, any[]>;
  weekDates: Record<string, string>;
  fullWeekDates: Record<string, string>;
  isReadOnly: boolean;
  isDark: boolean;
  expandedDay: string | null;
  onAddClick: (day: string) => void;
  onEditSession: (day: string, session: any) => void;
  onFraværClick?: (session: any, day: string) => void;
  onAddFromCatalogue: (payload: any, day: string) => void;
  onManualAdd: () => void;
  onCollapseDay: () => void;
  showDesktopCatalogue: boolean;
  catalogueByDay: Record<string, { cls: CatalogueClass; schedule: ClassSchedule }[]> | null;
  catalogueLoading: boolean;
  onAddFromDesktopCatalogue: (day: string, session: any) => void;
  onDesktopManual: (day: string) => void;
  todayDayName: string | null;
  todayRef: React.RefObject<HTMLDivElement | null>;
  visibleFriends?: string[];
  friendWeekData?: Record<string, Record<number, any>>;
  friendColors?: Record<string, string>;
  currentWeek?: number;
}

const PersonalSchedule = ({ days, scheduleData, weekDates, fullWeekDates, isReadOnly, isDark, expandedDay, onAddClick, onEditSession, onFraværClick, onAddFromCatalogue, onManualAdd, onCollapseDay, showDesktopCatalogue, catalogueByDay, catalogueLoading, onAddFromDesktopCatalogue, onDesktopManual, todayDayName, todayRef, visibleFriends = [], friendWeekData = {}, friendColors = {}, currentWeek = 0 }: PersonalScheduleProps) => (
  <div className="px-4 pb-32 fade-in">
    <div className="grid grid-cols-1 md:grid-cols-7 md:grid-rows-[1fr_auto] gap-3">
    {days.map(day => {
      const sessions = scheduleData[day] || [];
      const visibleSessions = sessions.filter(s => !s.isRestDay && s.type !== 'fravær');
      const fraværSessions = sessions.filter(s => s.type === 'fravær');
      const isExpanded = expandedDay === day;
      const dayCatalogue = catalogueByDay?.[day] || [];
      const isToday = day === todayDayName;
      return (
        <div key={day} ref={isToday ? todayRef : undefined} className={`rounded-2xl p-3 border transition-all shadow-md flex flex-col md:row-span-2 md:grid md:grid-rows-subgrid md:gap-y-0 ${isToday ? (isDark ? 'border-blue-700/60 ring-1 ring-blue-800/40' : 'border-brand-300 ring-1 ring-brand-100') : ''} ${isExpanded ? (isDark ? 'bg-slate-900 border-blue-800/50 ring-1 ring-blue-800/30' : 'bg-white border-brand-200 ring-1 ring-brand-100') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border')}`}>
          <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-1">
              <h3 className={`font-bold text-sm md:text-xs ${isReadOnly ? (isDark ? 'text-slate-400' : 'text-ds-text-subtle') : (isDark ? 'text-white' : 'text-ds-text')}`}>
                <span className="md:hidden">{day}{fullWeekDates[day] && <span className={`text-xs font-medium ml-1 ${isToday ? 'text-blue-400' : (isDark ? 'text-slate-500' : 'text-ds-text-subtlest')}`}>{fullWeekDates[day]}</span>}</span>
                <span className="hidden md:inline">{day.slice(0, 3)}</span>
                {weekDates[day] && <span className={`hidden md:inline text-[10px] ml-1 font-medium ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>d. {weekDates[day]}</span>}
                {isToday && <span className="md:hidden ml-1.5 text-[9px] font-bold uppercase tracking-wide text-blue-400">i dag</span>}
              </h3>
            </div>
            <div className="flex space-x-0.5">
              <button disabled={isReadOnly} onClick={() => onAddClick(day)} className={`md:hidden rounded-full p-1 transition-colors ${isExpanded ? 'bg-blue-600 text-white' : (isDark ? 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400' : 'bg-brand-50 hover:bg-brand-100 text-brand-500')} ${isReadOnly ? 'opacity-0' : ''}`}><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
          {/* Fravær blocks */}
          {fraværSessions.map(s => {
            const title = s.fraværTitel || s.name || 'Fravær';
            const total = s.fraværTotalDays || 1;
            const dayIdx = s.fraværDayIndex || 1;
            const isFirst = dayIdx === 1;
            const isLast = dayIdx === total;
            const isSingle = total === 1;
            return (
              <div key={s.id}
                onClick={() => {
                  if (isReadOnly || !onFraværClick) return;
                  const d = getDateForWeekDay(currentWeek, day);
                  const dayKey = d ? d.toISOString().slice(0, 10) : day;
                  onFraværClick(s, dayKey);
                }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium mb-1.5 transition-all ${!isReadOnly ? 'cursor-pointer active:scale-[0.98]' : ''} ${isDark ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-800'}`}>
                <span className="font-bold">{title}</span>
                {!isSingle && <span className="opacity-70"> (dag {dayIdx}/{total})</span>}
                {isSingle && <span className="opacity-70"> · {s.start} — {s.end}</span>}
                {!isSingle && isFirst && <span className="opacity-70"> · Fra {s.start}</span>}
                {!isSingle && isLast && <span className="opacity-70"> · Indtil {s.end}</span>}
              </div>
            );
          })}
          {visibleSessions.length === 0 && fraværSessions.length === 0 && !isExpanded && !showDesktopCatalogue && <div className={`text-xs font-medium py-2 text-center border-2 border-dashed rounded-xl ${isDark ? 'text-slate-600 border-slate-800/50' : 'text-ds-text-subtlest border-surface-border'}`}>Ingen pas</div>}
          {visibleSessions.map(s => {
            const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
            const isCancelled = s.status === 'cancelled';
            const isRecurring = !!s.isRecurring;
            const isEvent = s.type === 'event';
            const isInvitation = s.type === 'invitation';
            return (
              <div key={s.id} onClick={() => !isReadOnly && onEditSession(day, s)} className={`relative flex items-start p-2 rounded-xl mb-1.5 border shadow-sm transition-all ${isCancelled ? (isDark ? 'bg-red-950/20 border-red-900/40 opacity-75' : 'bg-red-50 border-red-200 opacity-75') : isInvitation ? (isDark ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200') : isEvent ? (isDark ? 'bg-indigo-950/30 border-indigo-800/50' : 'bg-indigo-50 border-indigo-200') : (isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-surface-raised border-surface-border')} ${!isReadOnly ? 'cursor-pointer active:scale-[0.98]' : ''}`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${cat.color} ${isCancelled ? 'opacity-50' : ''}`}></div>
                <div className="flex-1 pl-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className={`font-bold text-xs leading-tight mb-0.5 line-clamp-2 md:min-h-[1.875rem] ${isCancelled ? (isDark ? 'line-through text-slate-500' : 'line-through text-ds-text-subtlest') : (isDark ? 'text-white' : 'text-ds-text')}`}>{s.name}</h4>
                    {isRecurring && <Repeat className={`w-3 h-3 shrink-0 mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`} />}
                  </div>
                  <div className={`flex flex-col gap-0.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                    <span className="flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.start} - {s.end}</span>
                    <span className="flex items-center truncate"><MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />{s.location}</span>
                  </div>
                  {isInvitation && (() => {
                    const badge = invitationBadge(s.invitationResponse);
                    const toneCls = badge.tone === 'positive'
                      ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                      : (isDark ? 'text-amber-400' : 'text-amber-600');
                    return (
                      <div className="mt-0.5 flex flex-col gap-0.5">
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}><UserPlus className="w-2.5 h-2.5" />{s.invitedByName ? `Fra ${s.invitedByName}` : 'Invitation'}</span>
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase ${toneCls}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{badge.label}</span>
                      </div>
                    );
                  })()}
                  {isEvent && <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase mt-0.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}><CalendarDays className="w-2.5 h-2.5" />Event</span>}
                  {isCancelled && <div className="mt-0.5 text-[9px] text-red-400 flex items-center"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Aflyst{s.cancellationReason ? `: ${s.cancellationReason}` : ''}</div>}
                </div>
              </div>
            );
          })}
          {/* Mobile: Tilføj eget pas outside picker */}
          {isExpanded && !isReadOnly && (
            <div className="md:hidden mt-1.5 mb-0.5">
              <button onClick={() => onManualAdd()} className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-surface-border text-ds-text hover:bg-surface-hover'}`}>
                <PenLine className="w-3.5 h-3.5" /> Tilføj eget pas
              </button>
            </div>
          )}
          {/* Mobile inline picker */}
          {isExpanded && <div className="md:hidden"><InlineCataloguePicker day={day} onAdd={onAddFromCatalogue} onClose={onCollapseDay} /></div>}
          {/* Friend sessions overlay (desktop) */}
          {visibleFriends.length > 0 && visibleFriends.map(friend => {
            const fWeek = friendWeekData[friend]?.[currentWeek] || {};
            const fSessions = (fWeek[day] || []).filter((s: any) => !s.isRestDay);
            if (fSessions.length === 0) return null;
            const colorClass = friendColors[friend] || 'bg-gray-400';
            return (
              <div key={friend} className="mt-1.5">
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
          {/* Desktop catalogue — always rendered for subgrid row alignment */}
          <div className="hidden md:block">
          {showDesktopCatalogue && (
            <>
              <button onClick={() => onDesktopManual(day)} className={`flex items-center gap-1 mt-2 mb-1 text-[9px] font-medium whitespace-nowrap transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-brand-500 hover:text-brand-600'}`}><Plus className="w-2.5 h-2.5" /> Tilføj eget pas</button>
              <span className={`text-[8px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>Tilføj fra katalog</span>
              {catalogueLoading && <div className={`text-center py-2 text-[9px] ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}>...</div>}
              {!catalogueLoading && dayCatalogue.length === 0 && (
                <div className={`text-center py-2 text-[9px] ${isDark ? 'text-slate-700' : 'text-ds-text-subtlest/50'}`}>Ingen hold</div>
              )}
              {dayCatalogue.map(({ cls, schedule }) => {
                const cat = CATEGORIES.find(c => c.label === disciplineToCategory(cls.discipline)) || CATEGORIES[6];
                return (
                  <button key={`cat-${cls.id}-${schedule.startTime}`}
                    onClick={() => onAddFromDesktopCatalogue(day, { name: cls.title, category: disciplineToCategory(cls.discipline), start: schedule.startTime, end: schedule.endTime, location: cls.gym, catalogueClassId: cls.id })}
                    className={`w-full text-left p-1.5 rounded-lg border border-dashed mb-1 transition-colors active:scale-[0.97] group ${isDark ? 'bg-slate-800/20 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600' : 'bg-surface-subtle/50 border-surface-border hover:bg-surface-hover'}`}>
                    <div className="flex items-start gap-1">
                      <div className={`w-1 mt-0.5 rounded-full shrink-0 h-3 ${cat.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-bold leading-tight line-clamp-2 ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{cls.title}</div>
                        <div className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>{schedule.startTime}—{schedule.endTime}</div>
                        <div className={`text-[9px] flex items-center ${isDark ? 'text-slate-600' : 'text-ds-text-subtlest'}`}><MapPin className="w-2 h-2 mr-0.5 shrink-0" />{cls.gym}</div>
                      </div>
                      <Plus className={`w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-blue-400' : 'text-brand-500'}`} />
                    </div>
                  </button>
                );
              })}
            </>
          )}
          </div>
        </div>
      );
    })}
    </div>
  </div>
);

export default PersonalSchedule;
