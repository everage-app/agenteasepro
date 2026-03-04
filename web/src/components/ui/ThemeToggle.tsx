import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-lg transition-all ${
        isLight
          ? 'border-slate-200 bg-white/90 text-slate-700 shadow-slate-200/50 hover:border-blue-400 hover:bg-white'
          : 'border-white/10 bg-white/5 text-slate-200 shadow-blue-500/10 hover:border-blue-400/40 hover:bg-white/10'
      } ${compact ? 'px-2.5 py-1.5 text-[11px]' : ''}`}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-md shadow-blue-600/30 ${
          compact ? 'h-4 w-4' : ''
        }`}
      >
        {isLight ? (
          <svg className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.95 6.95-1.414-1.414M7.464 7.464 6.05 6.05m12.9 0-1.414 1.414M7.464 16.536 6.05 17.95" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        ) : (
          <svg className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
          </svg>
        )}
      </span>
      <span className="hidden sm:inline">{isLight ? 'Light' : 'Dark'} Mode</span>
    </button>
  );
}
