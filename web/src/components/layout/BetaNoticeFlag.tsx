import { useState } from 'react';
import { StunningModal } from '../ui/StunningModal';
import { Logo } from '../ui/Logo';

interface BetaNoticeFlagProps {
  inline?: boolean;
}

export function BetaNoticeFlag({ inline = false }: BetaNoticeFlagProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={inline
          ? 'group'
          : 'fixed z-[120] right-4 bottom-20 lg:bottom-6 group'}
        aria-label="Open beta notice"
        title="Beta notice"
      >
        <span className={inline
          ? 'inline-flex h-9 items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100 transition-all duration-200 group-hover:border-cyan-300/50 group-hover:bg-cyan-500/20'
          : 'inline-flex items-center gap-2.5 rounded-full border border-cyan-300/35 bg-gradient-to-r from-slate-900/90 via-slate-900/85 to-slate-800/85 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100 backdrop-blur-xl shadow-[0_12px_30px_rgba(6,182,212,0.2)] transition-all duration-200 group-hover:border-cyan-200/55 group-hover:text-cyan-50 group-hover:shadow-[0_16px_42px_rgba(6,182,212,0.32)] group-hover:-translate-y-0.5'}>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/95 shadow-[0_0_10px_rgba(103,232,249,0.85)]" />
          BETA
        </span>
      </button>

      <StunningModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title=""
        headerContent={
          <div className="flex items-center gap-4">
            <Logo size="lg" showText={true} className="scale-[1.08]" />
            <span className="inline-flex items-center rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
              Beta
            </span>
          </div>
        }
        size="md"
        footer={
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:from-cyan-400 hover:to-blue-400 transition-all"
            >
              Got it
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 leading-relaxed">
            Thank you for being an early adopter of AgentEase Pro! As a beta user, you get first access to new features and your feedback directly shapes the product.
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4 text-sm text-slate-200 leading-relaxed">
            <div className="font-semibold text-cyan-200 mb-2 flex items-center gap-2">
              <span>💡</span> What &quot;Beta&quot; means for you
            </div>
            <ul className="space-y-1.5 text-slate-300 text-xs">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Your data is secure and backed up daily</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Core features (CRM, deals, contracts, e-sign) are production-ready</li>
              <li className="flex items-start gap-2"><span className="text-cyan-400 mt-0.5">→</span> New features are released weekly based on your feedback</li>
              <li className="flex items-start gap-2"><span className="text-cyan-400 mt-0.5">→</span> Use the <strong>Support</strong> button anytime for help or suggestions</li>
            </ul>
          </div>
          <div className="text-center text-xs text-slate-500">v1.0 Beta · Built for real estate professionals</div>
        </div>
      </StunningModal>
    </>
  );
}

export default BetaNoticeFlag;