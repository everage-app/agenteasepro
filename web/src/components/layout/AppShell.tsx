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
import { NotificationCenter } from '../notifications/NotificationCenter';
import { AnimatedAppBackground } from './AnimatedAppBackground';
import api from '../../lib/api';
import { contactEmailApi, RecentReplyItem } from '../../lib/contactEmailApi';
import { notificationFeedApi, LeadAlertItem } from '../../lib/notificationFeedApi';

interface AppShellProps {
  children?: ReactNode;
}

type NotificationCenterOpenDetail = {
  anchor?: {
    top: number;
    right: number;
    width: number;
  };
  streak?: number;
};

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMobile(1024); // Use lg breakpoint
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [inAppBannersEnabled, setInAppBannersEnabled] = useState(true);
  const [replyBanner, setReplyBanner] = useState<RecentReplyItem | null>(null);
  const [leadBanner, setLeadBanner] = useState<LeadAlertItem | null>(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationCenterAnchor, setNotificationCenterAnchor] = useState<NotificationCenterOpenDetail['anchor'] | null>(null);
  const [notificationCenterStreak, setNotificationCenterStreak] = useState(0);

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
      setLeadBanner(null);
      return;
    }

    let cancelled = false;

    const loadReplies = async () => {
      try {
        const [replyRes, leadRes] = await Promise.all([
          contactEmailApi.recentReplies({ limit: 5 }),
          notificationFeedApi.recentLeadCaptures({ limit: 5 }),
        ]);
        if (cancelled) return;
        const unseen = (Array.isArray(replyRes.data?.items) ? replyRes.data.items : []).find((item) => item.unseen);
        const lastSeenLeadAt = notificationFeedApi.getLastSeenLeadCaptureAt();
        const unseenLead = (Array.isArray(leadRes.data?.items) ? leadRes.data.items : []).find((item) => {
          if (!lastSeenLeadAt) return true;
          return new Date(item.at).getTime() > new Date(lastSeenLeadAt).getTime();
        });
        setReplyBanner(unseen || null);
        setLeadBanner(unseenLead || null);
      } catch {
        if (!cancelled) setReplyBanner(null);
        if (!cancelled) setLeadBanner(null);
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

  useEffect(() => {
    const openCenter = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationCenterOpenDetail>;
      setNotificationCenterAnchor(customEvent.detail?.anchor || null);
      setNotificationCenterStreak(customEvent.detail?.streak || 0);
      setNotificationCenterOpen(true);
    };

    const closeCenter = () => {
      setNotificationCenterOpen(false);
    };

    window.addEventListener('ae:notifications:open', openCenter as EventListener);
    window.addEventListener('ae:notifications:close', closeCenter);

    return () => {
      window.removeEventListener('ae:notifications:open', openCenter as EventListener);
      window.removeEventListener('ae:notifications:close', closeCenter);
    };
  }, []);

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

  const openLeadAlert = () => {
    if (!leadBanner) return;
    notificationFeedApi.markLeadCapturesSeen(leadBanner.at);
    setLeadBanner(null);
    navigate(`/leads/${encodeURIComponent(leadBanner.leadId)}`);
  };

  const dismissLeadBanner = () => {
    if (leadBanner) {
      notificationFeedApi.markLeadCapturesSeen(leadBanner.at);
    }
    setLeadBanner(null);
  };

  // Use the first path segment as the animation key so nested navigation
  // (e.g. /settings/profile → /settings/notifications) does NOT unmount the
  // parent layout.  This prevents unnecessary re-suspensions and the
  // "Something went wrong" crash caused by chunk-load races.
  const routeKey = location.pathname.split('/').filter(Boolean)[0] || 'home';

  const content = children ?? (
    <Suspense fallback={<SkeletonPage />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={routeKey}
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
    <div className="ae-bg ae-app-shell">
      <AnimatedAppBackground />

      <div className="ae-shell-frame relative z-10 flex h-screen overflow-hidden">
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
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Mobile Header */}
          {isMobile && (
            <div className="ae-shell-header flex items-center justify-between h-14 px-4 border-b border-slate-200/70 bg-white/90 text-slate-800 backdrop-blur-xl lg:hidden dark:border-[#f2d894]/[0.13] dark:bg-[#080c14]/[0.88] dark:text-[#f7f4ee]">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
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
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-[#f2d894]/[0.20] dark:bg-[#d6b56d]/[0.10] dark:text-[#f2d894] dark:hover:bg-[#d6b56d]/[0.18] dark:hover:text-white"
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
          <div className="ae-shell-header ae-command-strip hidden lg:flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-[#f2d894]/[0.12] dark:bg-[#080c14]/[0.80] ae-surface">
            <div className="flex-1 min-w-0">
              <CommandBar compact />
            </div>
            <BetaNoticeFlag inline />
            <button
              onClick={() => setSupportOpen(true)}
              title="Support"
              aria-label="Support"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d6b56d]/[0.34] bg-white text-[#7a5a24] hover:bg-[#f8f3e6] dark:border-[#f2d894]/[0.30] dark:bg-[#d6b56d]/[0.12] dark:text-[#f2d894] dark:hover:bg-[#d6b56d]/[0.20]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 10c0-3.314-2.686-6-6-6s-6 2.686-6 6v5a2 2 0 002 2h1v-7H8a4 4 0 018 0h-1v7h1a2 2 0 002-2v-5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h2" />
              </svg>
            </button>
            <ThemeToggle />
          </div>

          {leadBanner && (
            <div className="px-4 sm:px-6 py-2 border-b border-emerald-400/20 bg-emerald-500/10 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={openLeadAlert}
                  className="min-w-0 text-left text-sm text-emerald-800 hover:text-emerald-950 dark:text-emerald-100 dark:hover:text-white"
                >
                  <span className="font-semibold">New lead captured: {leadBanner.leadName}</span>
                  <span className="text-emerald-700/80 dark:text-emerald-200/80">{leadBanner.sourceLabel ? ` • ${leadBanner.sourceLabel}` : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={dismissLeadBanner}
                  className="shrink-0 text-xs px-2 py-1 rounded-lg border border-emerald-500/30 text-emerald-800 hover:bg-emerald-500/20 dark:border-emerald-300/30 dark:text-emerald-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {replyBanner && (
            <div className="px-4 sm:px-6 py-2 border-b border-[#f2d894]/[0.20] bg-[#d6b56d]/[0.10] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void openReply()}
                  className="min-w-0 text-left text-sm text-[#7a5a24] hover:text-[#172235] dark:text-[#f7e7b0] dark:hover:text-white"
                >
                  <span className="font-semibold">New reply from {replyBanner.contactName}</span>
                  <span className="text-[#7a5a24]/[0.78] dark:text-[#f2d894]/[0.80]">{replyBanner.subject ? ` • ${replyBanner.subject}` : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void dismissReplyBanner()}
                  className="shrink-0 text-xs px-2 py-1 rounded-lg border border-[#d6b56d]/[0.38] text-[#7a5a24] hover:bg-[#d6b56d]/[0.20] dark:border-[#f2d894]/[0.30] dark:text-[#f7e7b0]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Content */}
          <main className="ae-app-main flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
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
      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        isMobile={isMobile}
        streak={notificationCenterStreak}
        anchor={notificationCenterAnchor}
      />
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
    <nav className="ae-mobile-nav flex items-center justify-around h-16 border-t border-slate-200/70 bg-white/92 backdrop-blur-xl lg:hidden safe-area-bottom dark:border-[#f2d894]/[0.13] dark:bg-[#080c14]/[0.90] ae-surface-strong">
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
              <div className="ae-mobile-nav-action w-12 h-12 rounded-full bg-gradient-to-r from-[#f2d894] to-[#9f7933] flex items-center justify-center shadow-lg shadow-[#d6b56d]/[0.25]">
                <Icon className="w-6 h-6 text-white" />
              </div>
            </Link>
          );
        }
        
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`ae-mobile-nav-link flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all ${
              isActive 
                ? 'ae-mobile-nav-link-active text-[#7a5a24] bg-[#f8f3e6] dark:text-[#f2d894] dark:bg-[#d6b56d]/[0.12]'
                : 'text-slate-500 hover:text-slate-800 active:text-slate-600 dark:text-slate-400 dark:hover:text-slate-100 dark:active:text-slate-200'
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
