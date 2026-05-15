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
      className={`group relative inline-flex items-center rounded-full border transition-all duration-300 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/[0.50] dark:focus-visible:ring-[#d6b56d]/[0.50] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#06080d]
        ${
          isLight
            ? 'border-slate-200 bg-white text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.06)] hover:border-[#d6b56d]/[0.55] hover:shadow-[0_4px_16px_rgba(15,23,42,0.12)]'
            : 'border-[#f2d894]/[0.16] bg-[#101827]/[0.80] text-slate-200 hover:border-[#f2d894]/[0.35] hover:bg-[#161f2d]'
        }
        ${compact ? 'h-8 w-[58px]' : 'h-9 w-[68px]'}`}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {/* Sun icon (left) */}
      <span
        className={`absolute left-1.5 flex items-center justify-center rounded-full transition-opacity duration-300 ${
          compact ? 'h-5 w-5' : 'h-6 w-6'
        } ${isLight ? 'opacity-100 text-amber-500' : 'opacity-40 text-slate-500'}`}
      >
        <svg className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.06 1.06M17.34 17.34l1.06 1.06M5.6 18.4l1.06-1.06M17.34 6.66l1.06-1.06" />
        </svg>
      </span>

      {/* Moon icon (right) */}
      <span
        className={`absolute right-1.5 flex items-center justify-center rounded-full transition-opacity duration-300 ${
          compact ? 'h-5 w-5' : 'h-6 w-6'
        } ${!isLight ? 'opacity-100 text-[#f2d894]' : 'opacity-40 text-slate-400'}`}
      >
        <svg className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
        </svg>
      </span>

      {/* Sliding thumb */}
      <span
        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full
          bg-gradient-to-br shadow-[0_2px_8px_rgba(2,6,23,0.20),0_1px_0_rgba(255,255,255,0.30)_inset]
          transition-[transform,background] duration-300 ease-out
          ${compact ? 'h-6 w-6' : 'h-7 w-7'}
          ${
            isLight
              ? `from-amber-300 to-orange-400 ${compact ? 'translate-x-1' : 'translate-x-1'}`
                : `from-[#f2d894] to-[#9f7933] ${compact ? 'translate-x-[30px]' : 'translate-x-[36px]'}`
          }`}
      />
    </button>
  );
}

