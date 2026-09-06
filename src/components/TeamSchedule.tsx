import { useState, useEffect } from 'react';
import { Clock, MapPin, CalendarDays } from 'lucide-react';

import { DAYS, CATEGORIES } from '../config/constants';
import { getWeekDateMap } from '../utils/dateUtils';

interface Session {
    id?: string;
    name: string;
    category: string;
    start: string;
    end: string;
    location: string;
    status?: string;
    cancellationReason?: string;
    isRestDay?: boolean;
    fighter?: string;
    type?: string;
    eventSignupStatus?: string;
}

interface TeamScheduleProps {
    days: string[];
    teamData: Record<string, Record<string, Session[]>>;
    currentWeek: number;
    isDark?: boolean;
}

const TeamSchedule = ({ days, teamData, currentWeek, isDark = true }: TeamScheduleProps) => {
    const [weekDates, setWeekDates] = useState<Record<string, string>>({});
    
    useEffect(() => {
        setWeekDates(getWeekDateMap(currentWeek));
    }, [currentWeek]);

    useEffect(() => {
        const dayIndex = new Date().getDay(); 
        const dayName = dayIndex === 0 ? 'Søndag' : DAYS[dayIndex - 1];
        const element = document.getElementById(`team-day-${dayName}`);
        if (element) {
            setTimeout(() => element.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [days]); 

    return (
        <div className="fade-in px-4 pb-32">
             <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                 {days.map(day => {
                         const slots: Record<string, (Session & { fighter: string })[]> = {};
                     Object.keys(teamData).forEach(fighter => {
                        const data = teamData[fighter];
                        if (!data) return;
                        const sessions = data[day] || [];
                        sessions.forEach(s => {
                            if (s.isRestDay || s.isDeleted) return;
                            const key = `${s.start}###${s.location}`;
                            if (!slots[key]) slots[key] = [];
                            slots[key].push({ ...s, fighter });
                        });
                     });
                     
                     const sortedKeys = Object.keys(slots).sort();
                     
                     return (
                         <div id={`team-day-${day}`} key={day} className={`rounded-2xl p-3 border shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-surface-border'}`}>
                            <h3 className={`font-bold text-sm mb-2 text-center ${isDark ? 'text-white' : 'text-ds-text'}`}>
                                <span className="md:hidden">{day}</span>
                                <span className="hidden md:inline">{day.slice(0, 3)}</span>
                                {weekDates[day] && <span className={`text-[10px] ml-1 font-medium ${isDark ? 'text-slate-500' : 'text-ds-text-subtlest'}`}>d. {weekDates[day]}</span>}
                            </h3>
                            
                            {sortedKeys.length === 0 && <div className={`text-xs font-medium py-2 text-center border-2 border-dashed rounded-xl ${isDark ? 'text-slate-600 border-slate-800/50' : 'text-ds-text-subtlest border-surface-border'}`}>Ingen træning</div>}
                                
                            <div className="space-y-2">
                                {sortedKeys.map(key => {
                                    const [time, location] = key.split('###');
                                    const sessions: (Session & { fighter: string })[] = slots[key];
                                    return (
                                        <div key={key} className={`rounded-xl p-2 border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-surface-subtle border-surface-border'}`}>
                                            {/* Time + location header */}
                                            <div className={`flex items-center gap-1 mb-1.5 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-ds-text-subtle'}`}>
                                                <Clock className="w-2.5 h-2.5 shrink-0" /><span>{time}</span>
                                                <span className="mx-0.5">·</span>
                                                <MapPin className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{location}</span>
                                            </div>
                                            
                                            {/* Fighter session cards */}
                                            <div className="space-y-1">
                                                {sessions.map((s, idx) => {
                                                     const isEvent = s.type === 'event';
                                                     const isCancelled = s.status === 'cancelled';
                                                     const cat = CATEGORIES.find(c => c.label === s.category) || CATEGORIES[6];
                                                     return (
                                                         <div key={idx} className={`relative flex items-start p-1.5 rounded-lg border ${isCancelled ? (isDark ? 'bg-red-900/10 border-red-900/30 opacity-75' : 'bg-red-50 border-red-200 opacity-75') : isEvent ? (isDark ? 'bg-indigo-950/30 border-indigo-800/50' : 'bg-indigo-50 border-indigo-200') : (isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-white border-surface-border')}`}>
                                                             <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${cat.color} ${isCancelled ? 'opacity-50' : ''}`}></div>
                                                             <div className="pl-2 min-w-0">
                                                                <div className={`text-[10px] font-bold ${isDark ? 'text-blue-400' : 'text-brand-500'}`}>{s.fighter}</div>
                                                                <div className={`text-[10px] truncate ${isCancelled ? (isDark ? 'text-slate-500 line-through' : 'text-ds-text-subtlest line-through') : (isDark ? 'text-slate-300' : 'text-ds-text')}`}>{s.name}</div>
                                                                {isEvent && <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold uppercase mt-0.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}><CalendarDays className="w-2.5 h-2.5" />Event</span>}
                                                                {isCancelled && <span className="text-[9px] text-red-400">Aflyst</span>}
                                                             </div>
                                                         </div>
                                                     );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                         </div>
                     );
                 })}
             </div>
        </div>
    );
};

export default TeamSchedule;
