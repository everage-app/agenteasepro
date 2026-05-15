import { EXTERNAL_LINKS } from '../../config/externalLinks';

export function CTA() {
  return (
    <section className="relative py-14 md:py-20 overflow-hidden">
      {/* Background with dramatic gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0a1628] to-slate-950"></div>
      
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-[360px] h-[360px] bg-gradient-radial from-[#f4b860]/18 to-transparent rounded-full blur-[90px]"></div>
      <div className="absolute bottom-0 right-0 w-[360px] h-[360px] bg-gradient-radial from-slate-500/8 to-transparent rounded-full blur-[90px]"></div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center">
          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-sm font-medium text-orange-300 mb-6">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
            Limited launch pricing available now
          </div>

          {/* Headline */}
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
            Ready to close more deals
            <br />
            <span className="gradient-text">with less stress?</span>
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-3xl mx-auto leading-relaxed">
            Join Utah agents using one workspace for contracts, clients, deadlines, and marketing.
            Start your 7-day full-access trial and launch your workspace today.
          </p>

          {/* Primary conversion action */}
          <div className="flex flex-col items-center justify-center gap-3 mb-8">
            <a
              href={EXTERNAL_LINKS.appEntry}
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg md:text-xl text-slate-900 bg-gradient-to-r from-[#f4b860] to-amber-400 hover:from-[#f5c87a] hover:to-amber-300 shadow-2xl shadow-[#f4b860]/40 transition-all duration-300 hover:scale-105"
            >
              Start Free Trial in the App
              <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <div className="w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-slate-900/45 px-4 py-4 md:px-5 md:py-5">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500 text-center mb-3">After signup</p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-left">
                  <p className="text-xs text-[#f4b860] font-semibold mb-1">Step 1</p>
                  <p className="text-sm text-slate-200">Create your workspace in under 2 minutes</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-left">
                  <p className="text-xs text-[#f4b860] font-semibold mb-1">Step 2</p>
                  <p className="text-sm text-slate-200">Import clients and launch your first pipeline</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-left">
                  <p className="text-xs text-[#f4b860] font-semibold mb-1">Step 3</p>
                  <p className="text-sm text-slate-200">Generate contracts and track deadlines automatically</p>
                </div>
              </div>
            </div>
            <a
              href="/book-demo"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-[#f4b860] transition-colors"
            >
              Prefer to explore first?
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              See app preview
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-8">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm md:text-base text-slate-300">No card to create an account</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm md:text-base text-slate-300">7-day full-access trial</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm md:text-base text-slate-300">Cancel anytime</span>
            </div>
          </div>

          {/* Social proof row */}
          <div className="inline-flex flex-col sm:flex-row items-center gap-5 p-4 md:p-5 rounded-2xl bg-slate-900/50 border border-white/[0.06] backdrop-blur-xl">
            {/* Avatars */}
            <div className="flex items-center">
              <div className="flex -space-x-2.5">
                {['JM', 'SR', 'MC', 'TW', 'LP'].map((initials, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-900"
                  >
                    {initials}
                  </div>
                ))}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f4b860] to-amber-400 flex items-center justify-center text-xs font-bold text-slate-900 ring-2 ring-slate-900">
                  +200
                </div>
              </div>
            </div>
            
            {/* Rating */}
            <div className="flex flex-col items-center sm:items-start">
              <div className="flex items-center gap-1 mb-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-[#f4b860]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-slate-400">
                <span className="text-white font-semibold">4.9/5</span> from 200+ Utah agents
              </p>
            </div>

            <div className="hidden md:block h-10 w-px bg-slate-700"></div>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-[#f4b860]">$47M+</span> in managed deals
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
