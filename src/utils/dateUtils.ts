/**
 * Date Utilities
 * Functions for week calculations, date formatting, and time manipulation
 */

import { DAYS } from '../config/constants';

/**
 * Get the current ISO week number (1-52)
 */
export const getISOWeek = (): number => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

/**
 * Get the date for a specific weekday in a given week
 * @param weekNumber ISO week number
 * @param dayName Day name (e.g., 'Mandag')
 * @returns Date object or null if dayName is invalid
 */
export const getDateForWeekDay = (weekNumber: number, dayName: string): Date | null => {
    const dayIndex = DAYS.indexOf(dayName); 
    if (dayIndex === -1) return null;
    
    const simpleDate = new Date();
    const currentYear = simpleDate.getFullYear();
    const simple = new Date(currentYear, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    
    const ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    const targetDate = new Date(ISOweekStart);
    targetDate.setDate(ISOweekStart.getDate() + dayIndex);
    return targetDate;
};

/**
 * Get a map of days to dates for a given week
 * Format: { "Mandag": "12. feb", ... }
 */
export const getWeekDateMap = (weekNumber: number): Record<string, string> => {
    const map: Record<string, string> = {};
    DAYS.forEach(day => {
        const date = getDateForWeekDay(weekNumber, day);
        if (date) {
            map[day] = date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }).replace('.', '');
        }
    });
    return map;
};

/**
 * Get a compact date map for a given week
 * Format: { "Mandag": "12/2", ... }
 */
export const getCompactWeekDateMap = (weekNumber: number): Record<string, string> => {
    const map: Record<string, string> = {};
    DAYS.forEach(day => {
        const date = getDateForWeekDay(weekNumber, day);
        if (date) {
            map[day] = `${date.getDate()}/${date.getMonth() + 1}`;
        }
    });
    return map;
};

/**
 * Add minutes to a time string
 * @param timeStr Time in format "HH:MM"
 * @param minutes Minutes to add
 * @returns New time in format "HH:MM"
 */
export const addMinutes = (timeStr: string, minutes: number): string => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m);
    date.setMinutes(date.getMinutes() + minutes);
    const newH = String(date.getHours()).padStart(2, '0');
    const newM = String(date.getMinutes()).padStart(2, '0');
    return `${newH}:${newM}`;
};

/**
 * Format cancellation time for display
 * @param isoString ISO format date string
 * @returns Formatted string (e.g., "Kl. 14:30" or "Mandag")
 */
export const formatCancellationTime = (isoString?: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    
    // If cancelled today, show time
    if (date.toDateString() === now.toDateString()) {
        return `Kl. ${date.toLocaleTimeString('da-DK', {hour: '2-digit', minute:'2-digit'})}`;
    }
    
    // Otherwise show day name
    const dayIndex = date.getDay();
    const dayName = dayIndex === 0 ? 'Søndag' : DAYS[dayIndex - 1];
    return dayName;
};

/**
 * Get today's day name in Danish (e.g., 'Mandag')
 */
export const getTodayDayName = (): string => {
    const dow = new Date().getDay(); // 0=Sun, 1=Mon...
    return dow === 0 ? 'Søndag' : DAYS[dow - 1];
};

/**
 * Get a map of days to full dates for a given week
 * Format: { "Mandag": "13. april", ... }
 */
export const getFullWeekDateMap = (weekNumber: number): Record<string, string> => {
    const map: Record<string, string> = {};
    DAYS.forEach(day => {
        const date = getDateForWeekDay(weekNumber, day);
        if (date) {
            map[day] = date.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
        }
    });
    return map;
};

/**
 * Get the month label for a given week (e.g., "april 2026")
 * Uses Thursday of the week to determine the month (ISO 8601 convention)
 */
export const getWeekMonthLabel = (weekNumber: number): string => {
    const thu = getDateForWeekDay(weekNumber, 'Torsdag');
    if (!thu) return '';
    return thu.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
};

/**
 * Represents one day in the continuous scroll timeline.
 */
export interface ScrollDay {
    date: Date;
    dayName: string;        // e.g. "Mandag"
    weekNumber: number;     // ISO week
    dateLabel: string;      // e.g. "9. april"
    monthLabel: string;     // e.g. "april"
    isToday: boolean;
    key: string;            // unique key e.g. "2026-04-09"
}

/**
 * Get the ISO week number for an arbitrary Date object.
 */
export const getISOWeekForDate = (d: Date): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

/**
 * Generate a continuous array of ScrollDay objects spanning a range of weeks.
 * @param weeksBack  Number of weeks before current week (default 2)
 * @param weeksAhead Number of weeks after current week (default 2)
 */
export const getDaysInRange = (weeksBack = 2, weeksAhead = 2): ScrollDay[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const currentWeek = getISOWeek();
    const days: ScrollDay[] = [];

    for (let wOffset = -weeksBack; wOffset <= weeksAhead; wOffset++) {
        const weekNum = currentWeek + wOffset;
        for (let d = 0; d < 7; d++) {
            const date = getDateForWeekDay(weekNum, DAYS[d]);
            if (!date) continue;
            days.push({
                date,
                dayName: DAYS[d],
                weekNumber: weekNum,
                dateLabel: date.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' }),
                monthLabel: date.toLocaleDateString('da-DK', { month: 'long' }),
                isToday: date.toISOString().slice(0, 10) === todayStr,
                key: date.toISOString().slice(0, 10),
            });
        }
    }
    return days;
};
