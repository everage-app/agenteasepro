import { ReactNode, useEffect, useState, Suspense } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { CommandBar } from '../ai/CommandBar';
import { useMobile } from '../../hooks/useMobile';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import { SupportModal } from '../support/SupportModal';
import { FirstLoginWelcomeModal } from '../onboarding/FirstLoginWelcomeModal';
import { BetaNoticeFlag } from './BetaNoticeFlag';
import { ToastProvider } from '../ui/ToastProvider';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { GlobalSearchModal } from '../search/GlobalSearchModal';
import { SkeletonPage } from '../ui/Skeleton';
import api from '../../lib/api';
import { contactEmailApi, RecentReplyItem } from '../../lib/contactEmailApi';

interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMobile(1024); // Use lg breakpoint
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [inAppBannersEnabled, setInAppBannersEnabled] = useState(true);
  const [replyBanner, setReplyBanner] = useState<RecentReplyItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/settings/notifications');
        if (!cancelled) {
          setInAppBannersEnabled(res.data?.inAppBanners !== false);
        }
      } catch {
        if (!cancelled) setInAppBannersEnabled(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!inAppBannersEnabled) {
      setReplyBanner(null);
      return;
    }

    let cancelled = false;

    const loadReplies = async () => {
      try {
        const res = await contactEmailApi.recentReplies({ limit: 5 });
        if (cancelled) return;
        const unseen = (Array.isArray(res.data?.items) ? res.data.items : []).find((item) => item.unseen);
        setReplyBanner(unseen || null);
      } catch {
        if (!cancelled) setReplyBanner(null);
      }
    };

    void loadReplies();
    const interval = window.setInterval(() => {
      void loadReplies();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [inAppBannersEnabled]);

  const openReply = async () => {
    if (!replyBanner) return;
    const destination =
      replyBanner.contactType === 'lead'
        ? `/leads/${encodeURIComponent(replyBanner.contactId)}`
        : `/clients/${encodeURIComponent(replyBanner.contactId)}?tab=timeline`;

    try {
      await contactEmailApi.markRecentRepliesSeen();
    } catch {
      // no-op
    }

    setReplyBanner(null);
    navigate(destination);
  };

  const dismissReplyBanner = async () => {
    try {
      await contactEmailApi.markRecentRepliesSeen();
    } catch {
      // no-op
    }
    setReplyBanner(null);
  };

  const content = children ?? (
    <Suspense fallback={<SkeletonPage />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );

  return (
    <ToastProvider>
    <div className="ae-bg">
      <div className="ae-bg-image" />
      <div className="ae-bg-gradient" />
      <div className="ae-bg-colorwash" />
      <div className="ae-bg-wave" />
      <div className="ae-bg-wave-2" />
      <div className="ae-bg-wave-3" />
      <div className="ae-bg-aurora" />
      <div className="ae-bg-trails" />
      <div className="ae-bg-stars" />
      <div className="ae-bg-wave-grid" />
      <div className="ae-bg-noise" />
      <div className="ae-bg-vignette" />

      <div className="relative z-10 flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Sidebar */}
        {isMobile && (
          <Sidebar 
            isOpen={sidebarOpen} 
            onClose={() => setSidebarOpen(false)} 
            isMobile={true} 
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Header */}
          {isMobile && (
            <div className="flex items-center justify-between h-14 px-4 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl lg:hidden ae-surface-strong">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <Logo size="sm" showText={true} />
              
              <div className="flex items-center gap-2">
                <BetaNoticeFlag inline />
                <button
                  onClick={() => setSupportOpen(true)}
                  title="Support"
                  aria-label="Support"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 10c0-3.314-2.686-6-6-6s-6 2.686-6 6v5a2 2 0 002 2h1v-7H8a4 4 0 018 0h-1v7h1a2 2 0 002-2v-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h2" />
                  </svg>
                </button>
                <ThemeToggle compact />
              </div>
            </div>
          )}

          {/* Command Bar - hidden on mobile */}
          <div className="hidden lg:flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-white/10 bg-slate-950/30 backdrop-blur-sm ae-surface">
            <div className="flex-1">
              <CommandBar compact />
            </div>
            <BetaNoticeFlag inline />
            <button
              onClick={() => setSupportOpen(true)}
              title="Support"
              aria-label="Support"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 10c0-3.314-2.686-6-6-6s-6 2.686-6 6v5a2 2 0 002 2h1v-7H8a4 4 0 018 0h-1v7h1a2 2 0 002-2v-5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h2" />
              </svg>
            </button>
            <ThemeToggle />
          </div>

          {replyBanner && (
            <div className="px-4 sm:px-6 py-2 border-b border-cyan-400/20 bg-cyan-500/10 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void openReply()}
                  className="min-w-0 text-left text-sm text-cyan-100 hover:text-white"
                >
                  <span className="font-semibold">New reply from {replyBanner.contactName}</span>
                  <span className="text-cyan-200/80">{replyBanner.subject ? ` • ${replyBanner.subject}` : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void dismissReplyBanner()}
                  className="shrink-0 text-xs px-2 py-1 rounded-lg border border-cyan-300/30 text-cyan-100 hover:bg-cyan-500/20"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Content */}
          <main className="flex-1 overflow-y-auto">
            {content}
          </main>

          {/* Mobile Bottom Navigation */}
          {isMobile && <MobileBottomNav />}
        </div>
      </div>

      <SupportModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} />
      <FirstLoginWelcomeModal />
      <KeyboardShortcuts />
      <GlobalSearchModal />
    </div>
    </ToastProvider>
  );
}

// Mobile Bottom Navigation for quick access
function MobileBottomNav() {
  const location = useLocation();
  
  const navItems = [
    { href: '/dashboard', icon: HomeIcon, label: 'Home' },
    { href: '/tasks', icon: TaskIcon, label: 'Tasks' },
    { href: '/deals/new', icon: PlusIcon, label: 'New', isAction: true },
    { href: '/clients', icon: UsersIcon, label: 'Clients' },
    { href: '/calendar', icon: CalendarIcon, label: 'Calendar' },
  ];

  return (
    <nav className="flex items-center justify-around h-16 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl lg:hidden safe-area-bottom ae-surface-strong">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        
        if (item.isAction) {
          return (
            <Link
              key={item.href}
              to={item.href}
              className="flex flex-col items-center justify-center -mt-4"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Icon className="w-6 h-6 text-white" />
              </div>
            </Link>
          );
        }
        
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors ${
              isActive 
                ? 'text-blue-400' 
                : 'text-slate-500 active:text-slate-300'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Icon components for bottom nav
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function TaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
