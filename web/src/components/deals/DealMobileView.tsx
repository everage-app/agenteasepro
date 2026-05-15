import React, { useEffect, useState } from 'react';
import { DealCountdown } from './DealCountdown';
import { DealStakeholdersPanel } from './DealStakeholdersPanel';
import { MobileUnifiedInbox } from '../communications/MobileUnifiedInbox';
import { trackEvent } from '../../lib/telemetry';

/**
 * DealMobileView integrates the newly created glass-morphism components
 * to demonstrate how they can be loosely linked in a single coherent dashboard.
 */
export function DealMobileView() {
  const [showGuide, setShowGuide] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 14); // 14 days from now

  useEffect(() => {
    void trackEvent({ kind: 'command_center_viewed', path: '/deals/command-center' });

    try {
      const seen = window.sessionStorage.getItem('aep_command_center_guide_seen') === '1';
      if (!seen) {
        setShowGuide(true);
        void trackEvent({
          kind: 'command_center_guide_shown',
          path: '/deals/command-center',
        });
      }
    } catch {
      setShowGuide(true);
      void trackEvent({
        kind: 'command_center_guide_shown',
        path: '/deals/command-center',
      });
    }
  }, []);

  const dismissGuide = () => {
    setShowGuide(false);
    void trackEvent({
      kind: 'command_center_guide_dismissed',
      path: '/deals/command-center',
    });
    try {
      window.sessionStorage.setItem('aep_command_center_guide_seen', '1');
    } catch {
      // Ignore storage failures.
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f16] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0f0f16] to-[#0f0f16] p-4 sm:p-8 flex justify-center text-white font-sans">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Deal Info & Stakeholders (Desktop perspective) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          {showGuide && (
            <section className="rounded-2xl border border-cyan-300/40 bg-cyan-500/10 p-4 text-cyan-50 shadow-lg shadow-cyan-500/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Preview</p>
                  <h2 className="mt-1 text-lg font-semibold">Deal Command Center</h2>
                  <p className="mt-1 text-sm text-cyan-100/90">
                    One place for deadlines, stakeholder handoffs, and live communications while your existing deal workflow stays untouched.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissGuide}
                  className="rounded-lg border border-cyan-200/40 px-3 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                >
                  Dismiss
                </button>
              </div>
            </section>
          )}
          
          <header className="mb-4">
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
              123 Main Street
            </h1>
            <p className="text-gray-400 mt-2 text-lg">Active Escrow • Closing in 14 days</p>
          </header>

          <section>
            <DealCountdown 
              eventName="Closing Date" 
              targetDate={futureDate} 
              theme="info" 
            />
          </section>

          <section className="mt-4">
            <DealStakeholdersPanel />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">How is this workspace feeling?</p>
                <p className="text-xs text-slate-400">Feedback helps tune this into the default best-in-class deal flow.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFeedback('up');
                    void trackEvent({
                      kind: 'command_center_feedback',
                      path: '/deals/command-center',
                      meta: { value: 'up' },
                    });
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${feedback === 'up' ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-200' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}
                >
                  Useful
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeedback('down');
                    void trackEvent({
                      kind: 'command_center_feedback',
                      path: '/deals/command-center',
                      meta: { value: 'down' },
                    });
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${feedback === 'down' ? 'border-amber-300/50 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}
                >
                  Needs work
                </button>
              </div>
            </div>
          </section>

        </div>

        {/* Right Column: Unified Inbox / Communications Area */}
        <div className="lg:col-span-5 xl:col-span-4 flex justify-center lg:justify-end">
          <div className="sticky top-8 w-full">
            <p className="text-sm font-medium text-gray-400 mb-4 ml-4 uppercase tracking-wider">Agent Communications</p>
            <MobileUnifiedInbox />
          </div>
        </div>

      </div>
    </div>
  );
}

export default DealMobileView;
