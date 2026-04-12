// ──────────────────────────────────────────────
// useTheme — dark / light mode context
// Persists to localStorage, provides context for all components
// ──────────────────────────────────────────────
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark', isDark: true, toggleTheme: () => {}, setTheme: () => {},
});

const STORAGE_KEY = 'fw-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark'; }
    catch { return 'dark'; }
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    // Apply to <html> for Tailwind dark-mode class strategy
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }, [theme, isDark]);

  const toggleTheme = useCallback(() => setThemeState(t => t === 'dark' ? 'light' : 'dark'), []);
  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
