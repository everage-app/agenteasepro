import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StunningModal } from '../ui/StunningModal';

const shortcuts = [
  { keys: ['N'], label: 'New Deal', action: '/deals/new' },
  { keys: ['C'], label: 'New Client', action: '/clients' },
  { keys: ['T'], label: 'Tasks', action: '/tasks' },
  { keys: ['K'], label: 'Command Bar', action: 'focus-command' },
  { keys: ['D'], label: 'Dashboard', action: '/dashboard' },
  { keys: ['L'], label: 'Listings', action: '/listings' },
  { keys: ['M'], label: 'Marketing', action: '/marketing' },
  { keys: ['R'], label: 'Reporting', action: '/reporting' },
  { keys: ['?'], label: 'Show this help', action: 'help' },
  { keys: ['Esc'], label: 'Close modals / panels', action: 'escape' },
];

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      // Don't trigger with modifier keys (except shift for ?)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key;

      if (key === '?') {
        e.preventDefault();
        setIsOpen((v) => !v);
        return;
      }

      if (isOpen) return; // Don't navigate while help is showing

      switch (key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          navigate('/deals/new');
          break;
        case 'c':
          e.preventDefault();
          navigate('/clients');
          break;
        case 't':
          e.preventDefault();
          navigate('/tasks');
          break;
        case 'd':
          e.preventDefault();
          navigate('/dashboard');
          break;
        case 'l':
          e.preventDefault();
          navigate('/listings');
          break;
        case 'm':
          e.preventDefault();
          navigate('/marketing');
          break;
        case 'r':
          e.preventDefault();
          navigate('/reporting');
          break;
        case 'k': {
          e.preventDefault();
          const cmdInput = document.querySelector('[data-command-input]') as HTMLInputElement;
          if (cmdInput) cmdInput.focus();
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, isOpen]);

  return (
    <StunningModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Keyboard Shortcuts"
      size="sm"
    >
      <div className="space-y-2">
        {shortcuts.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between rounded-xl px-4 py-3 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="text-sm text-slate-200">{s.label}</span>
            <div className="flex gap-1.5">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="min-w-[28px] h-7 px-2 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-600 text-xs font-mono font-semibold text-slate-200 shadow-sm"
                >
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center text-xs text-slate-500">
        Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-300 font-mono text-[10px]">?</kbd> anywhere to toggle this overlay
      </div>
    </StunningModal>
  );
}

export default KeyboardShortcuts;
