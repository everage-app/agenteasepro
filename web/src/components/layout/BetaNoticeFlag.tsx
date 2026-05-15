import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
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
          ? 'inline-flex h-9 items-center gap-2 rounded-xl border border-[#d6b56d]/45 bg-[#fff7df] px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a5a24] transition-all duration-200 group-hover:border-[#9f7933]/55 group-hover:bg-[#fff1c7] dark:border-[#f2d894]/[0.30] dark:bg-[#d6b56d]/[0.10] dark:text-[#f2d894] dark:group-hover:border-[#f2d894]/[0.50] dark:group-hover:bg-[#d6b56d]/[0.18]'
          : 'inline-flex items-center gap-2.5 rounded-full border border-[#f2d894]/[0.35] bg-gradient-to-r from-[#080c14]/[0.95] via-[#0b1220]/[0.90] to-[#111827]/[0.90] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#f2d894] backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.32)] transition-all duration-200 group-hover:border-[#f7e7b0]/[0.55] group-hover:text-[#f7e7b0] group-hover:shadow-[0_16px_42px_rgba(214,181,109,0.18)] group-hover:-translate-y-0.5'}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#9f7933] shadow-[0_0_10px_rgba(214,181,109,0.45)] dark:bg-[#f2d894]/[0.95] dark:shadow-[0_0_10px_rgba(214,181,109,0.65)]" />
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
            <span className="inline-flex items-center rounded-full border border-[#f2d894]/[0.40] bg-[#d6b56d]/[0.10] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f2d894]">
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
              className="rounded-xl bg-gradient-to-r from-[#f2d894] to-[#9f7933] px-6 py-2.5 text-sm font-semibold text-[#171106] shadow-[0_10px_30px_rgba(214,181,109,0.24)] hover:brightness-[1.05] transition-all"
            >
              Got it
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            Thank you for being an early adopter of AgentEase Pro! As a beta user, you get first access to new features and your feedback directly shapes the product.
          </div>
          <div className="rounded-xl border border-[#d6b56d]/[0.35] bg-[#fff7df] p-4 text-sm leading-relaxed text-slate-700 dark:border-[#f2d894]/[0.20] dark:bg-[#d6b56d]/[0.06] dark:text-slate-200">
            <div className="font-semibold text-[#7a5a24] mb-2 flex items-center gap-2 dark:text-[#f2d894]">
              <Lightbulb className="h-4 w-4" /> What &quot;Beta&quot; means for you
            </div>
            <ul className="space-y-1.5 text-slate-600 text-xs dark:text-slate-300">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Your data is secure and backed up daily</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Core features (CRM, deals, contracts, e-sign) are production-ready</li>
              <li className="flex items-start gap-2"><span className="text-[#9f7933] mt-0.5 dark:text-[#f2d894]">→</span> New features are released weekly based on your feedback</li>
              <li className="flex items-start gap-2"><span className="text-[#9f7933] mt-0.5 dark:text-[#f2d894]">→</span> Use the <strong>Support</strong> button anytime for help or suggestions</li>
            </ul>
          </div>
          <div className="text-center text-xs text-slate-500">v1.0 Beta · Built for real estate professionals</div>
        </div>
      </StunningModal>
    </>
  );
}

export default BetaNoticeFlag;