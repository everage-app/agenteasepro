import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from '../../components/ui/Logo';
import { InternalSidebar } from './InternalSidebar';
import { useMobile } from '../../hooks/useMobile';
import { useState } from 'react';

export function InternalShell() {
  const location = useLocation();
  const isMobile = useMobile(1024);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
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
        <InternalSidebar />

        {isMobile && (
          <InternalSidebar isMobile isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {isMobile && (
            <div className="flex items-center justify-between h-14 px-4 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl lg:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Open internal menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center gap-4">
                <Logo size="sm" showText />
                <span className="hidden sm:inline-flex text-[9px] font-bold tracking-[0.2em] text-cyan-200/60 border border-cyan-500/20 bg-cyan-500/5 rounded px-1.5 py-0.5">INTERNAL</span>
              </div>

              <div className="w-10" />
            </div>
          )}

          <main className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
