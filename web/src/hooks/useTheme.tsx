import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (value: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Safely get localStorage item with fallback
 */
function safeGetStorage(key: string): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (e) {
    // localStorage may be blocked (privacy mode, etc.)
    return null;
  }
}

/**
 * Safely set localStorage item
 */
function safeSetStorage(key: string, value: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Get initial theme - defaults to DARK for new users.
 * Only returns 'light' if user has explicitly chosen it previously.
 * This ensures the stunning dark login is the default first impression.
 */
const getInitialTheme = (): ThemeMode => {
  const stored = safeGetStorage('agentease_theme');
  // Only use light if explicitly saved - new users always get dark
  if (stored === 'light') return 'light';
  return 'dark';
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  // Ensure we only run client-side effects after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    // Add/remove 'dark' class for Tailwind dark: utilities
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    safeSetStorage('agentease_theme', theme);
  }, [theme, mounted]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
