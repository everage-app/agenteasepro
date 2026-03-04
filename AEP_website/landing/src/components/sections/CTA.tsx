import { EXTERNAL_LINKS } from '../../config/externalLinks';

export function CTA() {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      {/* Background with dramatic gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0a1628] to-slate-950"></div>
      
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-radial from-[#f4b860]/20 to-transparent rounded-full blur-[120px]"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-slate-500/10 to-transparent rounded-full blur-[120px]"></div>
      
      {/* Animated particles/dots */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[#f4b860]/30 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          ></div>
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center">
          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-sm font-medium text-orange-300 mb-8">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
            🔥 Limited Time: 50% off ends soon
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Ready to close more deals
            <br />
            <span className="gradient-text">with less stress?</span>
          </h2>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed">
            Join hundreds of Utah agents who've already transformed their business. 
            Start your free trial today—no credit card required.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <a
              href={EXTERNAL_LINKS.appEntry}
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl font-bold text-xl text-slate-900 bg-gradient-to-r from-[#f4b860] to-amber-400 hover:from-[#f5c87a] hover:to-amber-300 shadow-2xl shadow-[#f4b860]/40 transition-all duration-300 hover:scale-105"
            >
              Start Your Free Trial
              <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="/book-demo"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl font-bold text-xl text-white border border-white/20 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/40 transition-all duration-300 hover:scale-105"
            >
              <svg className="w-6 h-6 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Book a Demo
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 mb-12">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-slate-300">No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-slate-300">14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-slate-300">Cancel anytime</span>
            </div>
          </div>

          {/* Social proof row */}
          <div className="inline-flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-slate-900/50 border border-white/[0.06] backdrop-blur-xl">
            {/* Avatars */}
            <div className="flex items-center">
              <div className="flex -space-x-3">
                {['JM', 'SR', 'MC', 'TW', 'LP'].map((initials, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-900"
                  >
                    {initials}
                  </div>
                ))}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f4b860] to-amber-400 flex items-center justify-center text-xs font-bold text-slate-900 ring-2 ring-slate-900">
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

            {/* Stat */}
            <div className="hidden md:block h-12 w-px bg-slate-700"></div>
            <div className="text-center sm:text-left">
              <div className="text-2xl font-bold text-[#f4b860]">$47M+</div>
              <div className="text-sm text-slate-400">in managed deals</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
