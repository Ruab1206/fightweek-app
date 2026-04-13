/**
 * useScrollController — orchestrates scroll-to-today, scroll-to-date,
 * month header tracking, and initial-scroll alignment for the calendar views.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getDateForWeekDay, getISOWeekForDate } from '../utils/dateUtils';

interface ScrollDayEntry {
  dayName: string;
  weekNumber: number;
  date: Date;
  key: string;
  isToday?: boolean;
}

interface UseScrollControllerArgs {
  todayRef: React.RefObject<HTMLDivElement | null>;
  mobileTodayRef: React.RefObject<HTMLDivElement | null>;
  view: string;
  user: any;
  currentWeek: number;
  setCurrentWeek: (w: number) => void;
  multiWeekData: Record<number, any>;
  scrollDays: ScrollDayEntry[];
  weeksBack: number;
  setWeeksBack: React.Dispatch<React.SetStateAction<number>>;
  weeksAhead: number;
  setWeeksAhead: React.Dispatch<React.SetStateAction<number>>;
  searchMode: boolean;
}

export function useScrollController({
  todayRef, mobileTodayRef,
  view, user,
  currentWeek, setCurrentWeek,
  multiWeekData, scrollDays,
  weeksBack, setWeeksBack, weeksAhead, setWeeksAhead,
  searchMode,
}: UseScrollControllerArgs) {
  const [headerMonth, setHeaderMonth] = useState(
    () => new Date().toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }),
  );
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  const hasScrolledOnMount = useRef(false);
  const dataSettledRef = useRef(false);
  const weeksBackRef = useRef(weeksBack);
  const weeksAheadRef = useRef(weeksAhead);
  weeksBackRef.current = weeksBack;
  weeksAheadRef.current = weeksAhead;
  const activeDayRef = useRef<{ dayName: string; weekNumber: number; date: Date; key: string } | null>(null);
  const userNavigatedRef = useRef(false);
  const scrollDaysRef = useRef(scrollDays);
  scrollDaysRef.current = scrollDays;

  // Initialize activeDayRef to today so FAB has context before user scrolls
  useEffect(() => {
    if (activeDayRef.current) return;
    const todayEntry = scrollDays.find(d => d.isToday);
    if (todayEntry) {
      activeDayRef.current = { dayName: todayEntry.dayName, weekNumber: todayEntry.weekNumber, date: todayEntry.date, key: todayEntry.key };
    }
  }, [scrollDays]);

  // Compute today's key the same way getDaysInRange does (midnight local → UTC string)
  const todayKeyRef = useRef(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });

  const scrollToToday = useCallback((behavior: ScrollBehavior = 'instant') => {
    const isDesktop = window.innerWidth >= 768;
    const ref = isDesktop ? todayRef.current : mobileTodayRef.current;
    if (ref) { ref.scrollIntoView({ behavior, block: 'start' }); return; }
    const el = document.getElementById(`day-${todayKeyRef.current()}`);
    if (el) el.scrollIntoView({ behavior, block: 'start' });
  }, []);

  const scrollToDate = useCallback((date: Date) => {
    const key = date.toISOString().slice(0, 10);
    setHeaderMonth(date.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }));
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const internalWeek = getISOWeekForDate(target);
    setCurrentWeek(internalWeek);
    // Suppress the data-growth scroll-to-today since this is explicit navigation
    userNavigatedRef.current = true;
    if (window.innerWidth >= 768) return;
    // Compute week offset from actual date difference (handles year boundaries)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    const weekOffset = Math.ceil(Math.abs(diffDays) / 7) + 2;
    if (diffDays < 0) {
      if (weekOffset > weeksBackRef.current) setWeeksBack(weekOffset);
    } else {
      if (weekOffset > weeksAheadRef.current) setWeeksAhead(weekOffset);
    }
    let retries = 0;
    const tryScroll = () => {
      const el = document.getElementById(`day-${key}`);
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else if (retries < 50) {
        retries++;
        setTimeout(tryScroll, 100);
      }
    };
    setTimeout(tryScroll, 50);
  }, [setCurrentWeek]);

  // Scroll to today on mount and when entering personal view
  useEffect(() => {
    if (view !== 'personal' || !user) {
      dataSettledRef.current = false;
      hasScrolledOnMount.current = false;
      setInitialScrollDone(false);
      return;
    }
    const key = todayKeyRef.current();
    let attempts = 0;
    const tryScroll = () => {
      const isDesktop = window.innerWidth >= 768;
      const ref = isDesktop ? todayRef.current : mobileTodayRef.current;
      const hasTarget = ref || document.getElementById(`day-${key}`);
      if (hasTarget) {
        scrollToToday(hasScrolledOnMount.current ? 'smooth' : 'instant');
        hasScrolledOnMount.current = true;
        setInitialScrollDone(true);
      } else if (attempts < 30) {
        attempts++;
        setTimeout(tryScroll, 150);
      }
    };
    setTimeout(tryScroll, 50);
  }, [view, scrollToToday, user]);

  // Re-align after data populates (sessions change card heights).
  // Firestore listeners fire independently per week, so multiWeekData updates
  // many times during initial load. Keep re-scrolling during the settle window
  // so progressive DOM-height changes don't push today off-screen.
  const dataSettledTimeRef = useRef(0);
  useEffect(() => {
    const count = Object.keys(multiWeekData).length;
    if (count === 0 || view !== 'personal') return;
    if (!dataSettledRef.current) {
      dataSettledRef.current = true;
      dataSettledTimeRef.current = Date.now();
    }
    // Keep re-scrolling for 3 s after first data arrives (covers ~15 onSnapshot fires)
    if (Date.now() - dataSettledTimeRef.current < 3000) {
      setTimeout(() => { scrollToToday('instant'); setInitialScrollDone(true); }, 60);
    }
  }, [multiWeekData, view, scrollToToday]);

  // Scroll to current week's Monday when crossing desktop→mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      if (view !== 'personal' || e.matches) return;
      const mon = getDateForWeekDay(currentWeek, 'Mandag');
      if (mon) setTimeout(() => scrollToDate(mon), 100);
      else setTimeout(() => scrollToToday('instant'), 100);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [view, currentWeek, scrollToDate, scrollToToday]);

  // Track visible month: from scroll on mobile, from currentWeek on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) {
      const thu = getDateForWeekDay(currentWeek, 'Torsdag');
      if (thu) setHeaderMonth(thu.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }));
    }
  }, [currentWeek]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (window.innerWidth >= 768) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const el = document.elementFromPoint(window.innerWidth / 2, 90);
        const card = el?.closest?.('[id^="day-"]') as HTMLElement | null;
        if (card) {
          const dateStr = card.id.replace('day-', '');
          const d = new Date(dateStr + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            setHeaderMonth(d.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }));
            // Use ref so we always search the current (possibly expanded) scrollDays
            const sd = scrollDaysRef.current.find(s => s.key === dateStr);
            if (sd) {
              activeDayRef.current = { dayName: sd.dayName, weekNumber: sd.weekNumber, date: sd.date, key: sd.key };
            } else {
              // Day is visible but not in scrollDays (range just expanded) — derive from the DOM date
              const wk = getISOWeekForDate(d);
              const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
              activeDayRef.current = { dayName: dayNames[d.getDay()], weekNumber: wk, date: d, key: dateStr };
            }
          }
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Expand range when search opens
  useEffect(() => {
    if (searchMode) setWeeksAhead(prev => Math.max(prev, 26));
  }, [searchMode]);

  return {
    headerMonth, setHeaderMonth,
    initialScrollDone,
    scrollToToday, scrollToDate,
    activeDayRef,
  };
}
