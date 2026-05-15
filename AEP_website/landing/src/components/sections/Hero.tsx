import { EXTERNAL_LINKS } from '../../config/externalLinks';
import appLogoDarkMode from '../../assets/app-logo-dark-mode.svg';

export function Hero() {
  return (
    <section id="services" className="relative pt-10 pb-20 md:pt-14 md:pb-28 lg:pt-16 lg:pb-36 overflow-hidden">
      {/* Dark premium background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#0a0a0f] to-black"></div>
      
      {/* Animated background particles */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-[10%] w-2 h-2 bg-[#f4b860]/40 rounded-full animate-float"></div>
        <div className="absolute top-40 right-[15%] w-1.5 h-1.5 bg-slate-400/40 rounded-full animate-float-slow"></div>
        <div className="absolute bottom-32 left-[25%] w-2 h-2 bg-white/20 rounded-full animate-float"></div>
        <div className="absolute top-1/2 right-[30%] w-1 h-1 bg-[#f4b860]/50 rounded-full animate-pulse"></div>
      </div>
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(244,184,96,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(244,184,96,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black,transparent)]"></div>
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left: Text content */}
          <div className="space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full glass-card border-[#f4b860]/20 bg-white/[0.04] animate-slide-up">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f4b860] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f4b860]"></span>
              </span>
              <span className="text-sm font-medium text-[#f4b860] tracking-wide">
                Built for Real Estate Agents and Teams - Now Live
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold leading-[1.06] tracking-tight animate-slide-up animation-delay-200">
              <span className="text-white">Close more deals.</span>
              <br />
              <span className="text-white">Hit zero deadlines.</span>
              <br />
              <span className="bg-gradient-to-r from-[#f4b860] via-amber-300 to-[#f4b860] bg-clip-text text-transparent">
                All in one workspace.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-slate-300/90 leading-relaxed max-w-xl animate-slide-up animation-delay-400">
              Deploy <span className="text-white font-semibold">stunning property websites</span>, manage CRM leads, draft compliant contracts, and track analytics. Perform faster than the competition - <span className="text-[#f4b860]">without the chaos of 10 different apps.</span>
            </p>

            {/* Value Props Row */}
            <div className="flex flex-wrap gap-4 animate-slide-up animation-delay-500">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Lead Gen & Analytics
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Contracts & E-Signatures
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                IDX Property Search
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up animation-delay-600">
              <a href={EXTERNAL_LINKS.appEntry} className="group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-slate-950 rounded-xl overflow-hidden bg-gradient-to-r from-[#f4b860] via-amber-400 to-amber-300 shadow-[0_0_0_1px_rgba(244,184,96,0.25),0_18px_45px_-18px_rgba(244,184,96,0.8)] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_0_1px_rgba(244,184,96,0.35),0_22px_55px_-18px_rgba(244,184,96,0.95)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b860]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.99]">
                <span className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-80 bg-gradient-to-b from-white/35 via-white/10 to-transparent" />
                <span className="relative z-10 flex items-center gap-2">
                  Start Free 7-Day Trial
                  <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </a>
              <a href="#demo" className="inline-flex items-center justify-center px-8 py-4 font-semibold text-[#f4b860] bg-white/[0.03] border border-white/[0.12] rounded-xl transition-all duration-300 hover:bg-white/[0.06] hover:border-[#f4b860]/30 gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Watch 2-min demo
              </a>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4 animate-slide-up animation-delay-800">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f4b860] to-amber-400 flex items-center justify-center text-sm font-bold text-slate-900 ring-2 ring-slate-950">JB</div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-sm font-bold text-slate-900 ring-2 ring-slate-950">MK</div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-sm font-bold text-slate-900 ring-2 ring-slate-950">SR</div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-slate-200 flex items-center justify-center text-sm font-bold text-slate-900 ring-2 ring-slate-950">+</div>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-[#f4b860]" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">Loved by agents and teams</span>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>
              <div className="text-sm text-slate-400">
                <span className="text-white font-semibold">$47M+</span> in deals managed
              </div>
            </div>
          </div>

          {/* Right: 3D Perspective Dashboard Mockup */}
          <div className="relative animate-slide-up animation-delay-800 lg:ml-8">
            {/* Floating card: Auto-filled forms */}
            <div className="hidden md:block absolute z-30 -left-16 lg:-left-24 top-64 lg:top-72 w-[260px] rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-800/80 backdrop-blur-xl shadow-2xl shadow-black/40 p-4 animate-float" style={{ transform: 'rotate(4deg)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-wide text-slate-300">FORMS + E-SIGN READY</span>
                <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 rounded-md">3 Ready</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">REPC Contract</div>
                    <div className="text-xs text-slate-400 truncate">1847 Canyon View</div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
                    <svg className="w-4 h-4 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">Seller Disclosures</div>
                    <div className="text-xs text-slate-400 truncate">523 Maple St</div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                </div>
              </div>
            </div>

            {/* Floating card: Deadline guard */}
            <div className="hidden md:block absolute z-30 -right-4 lg:-right-8 bottom-2 lg:bottom-0 w-[250px] rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-800/80 backdrop-blur-xl shadow-2xl shadow-black/40 p-4 animate-float-slow" style={{ transform: 'rotate(-2deg)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-wide text-slate-300">DEADLINE GUARD</span>
                <span className="w-2 h-2 rounded-full bg-[#f4b860]"></span>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full border-2 border-slate-400/40 flex items-center justify-center text-sm font-bold text-white">7/9</div>
                  <div>
                    <div className="text-base font-semibold text-white leading-tight">Tasks Complete</div>
                    <div className="text-xs text-[#f4b860] font-medium">All deadlines met</div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Title follow-up</span>
                  <span className="font-semibold text-white">Done</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Earnest Money</span>
                  <span className="font-semibold text-white">Today</span>
                </div>
              </div>
            </div>

            {/* Massive golden glow beneath */}
            <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[120%] h-64 bg-gradient-to-t from-[#f4b860]/40 via-[#f4b860]/20 to-transparent blur-[80px] rounded-full"></div>
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[90%] h-32 bg-[#f4b860]/30 blur-[50px] rounded-full"></div>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[70%] h-16 bg-[#f4b860]/50 blur-[30px] rounded-full"></div>
            
            {/* "Live" indicator */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f4b860] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f4b860]"></span>
              </span>
              <span className="text-xs font-medium text-[#f4b860]">Live Dashboard</span>
            </div>
            
            {/* Main mockup container with 3D transform */}
            <div 
              className="relative lg:scale-[1.02] xl:scale-[1.05] lg:origin-center transition-transform duration-700 ease-out hover:scale-[1.08]"
              style={{
                transform: 'perspective(2000px) rotateX(8deg) rotateY(-8deg) rotateZ(0.5deg)',
                transformStyle: 'preserve-3d',
                transformOrigin: 'center center'
              }}
            >
              {/* Outer glow frame */}
              <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-b from-[#f4b860]/50 via-[#f4b860]/20 to-[#f4b860]/60 blur-[2px]"></div>
              
              {/* Main dashboard card */}
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#12121a] via-[#0d0d14] to-[#08080c] border border-[#f4b860]/30 shadow-2xl">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent"></div>
                {/* Top gold accent line */}
                <div className="h-[2px] bg-gradient-to-r from-transparent via-[#f4b860] to-transparent"></div>
                
                <div className="flex">
                  {/* Sidebar */}
                  <div className="w-44 border-r border-[#f4b860]/10 p-4 bg-gradient-to-b from-[#0f0f16] to-[#08080c]">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-6 px-1">
                      <img src={appLogoDarkMode} alt="AgentEasePro" className="h-5 w-auto select-none" draggable={false} />
                    </div>
                    
                    {/* Nav items */}
                    <div className="space-y-1">
                      <div className="px-3 py-2 rounded-lg bg-[#f4b860]/15 border border-[#f4b860]/25 flex items-center gap-2.5 text-[#f4b860] font-medium text-xs">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        Dashboard
                      </div>
                      {['Deals', 'Calendar', 'Clients', 'Contracts', 'Listings', 'Marketing'].map((item, i) => (
                        <div key={i} className="px-3 py-2 rounded-lg flex items-center gap-2.5 text-[#f4b860]/50 text-xs hover:text-[#f4b860]/80 hover:bg-white/5 transition-colors">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Main content */}
                  <div className="flex-1 p-4 bg-gradient-to-br from-[#0d0d14] to-[#060609]">
                    {/* Dashboard top row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-semibold flex items-center justify-center">BP</div>
                        <span className="text-[12px] font-semibold text-white">Dashboard Overview</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-1 rounded-md text-[9px] text-slate-400 bg-white/5">30D</span>
                        <span className="px-2 py-1 rounded-md text-[9px] text-amber-200 bg-amber-500/20 border border-amber-400/30">6M</span>
                        <span className="px-2 py-1 rounded-md text-[9px] text-slate-400 bg-white/5">1Y</span>
                        <span className="ml-1 px-3 py-1 rounded-md text-[10px] font-semibold text-slate-900 bg-gradient-to-r from-[#f4b860] to-amber-300">+ New Deal</span>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2.5 mb-3.5">
                      <div className="p-2.5 rounded-xl bg-[#151520]/80 border border-slate-500/15">
                        <div className="text-[9px] text-slate-400/70 mb-1">Active Pipeline</div>
                        <div className="text-2xl font-bold text-white leading-none">$3.2M</div>
                        <div className="text-[8px] text-emerald-300 mt-1">+12.5% vs last month</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#151520]/80 border border-slate-500/15">
                        <div className="text-[9px] text-slate-400/70 mb-1">Proj. Commission</div>
                        <div className="text-2xl font-bold text-white leading-none">$96K</div>
                        <div className="text-[8px] text-emerald-300 mt-1">On track for goal</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#151520]/80 border border-slate-500/15">
                        <div className="text-[9px] text-slate-400/70 mb-1">Deals in Prog</div>
                        <div className="text-2xl font-bold text-white leading-none">14</div>
                        <div className="text-[8px] text-slate-400 mt-1">3 closing this week</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#151520]/80 border border-slate-500/15">
                        <div className="text-[9px] text-slate-400/70 mb-1">Tasks Pending</div>
                        <div className="text-2xl font-bold text-white leading-none">6</div>
                        <div className="text-[8px] text-rose-300 mt-1">2 priority items</div>
                      </div>
                    </div>

                    {/* Mid cards */}
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <div className="rounded-xl bg-[#151520]/70 border border-white/5 p-2.5">
                        <div className="text-[10px] font-medium text-white mb-1.5">Deal Volume Trends</div>
                        <svg viewBox="0 0 220 64" className="w-full h-16">
                          <path d="M8 52 C 38 58, 50 52, 68 34 C 90 12, 120 18, 138 22 C 155 26, 170 30, 194 14" stroke="#f4b860" strokeWidth="3" fill="none" strokeLinecap="round" />
                          <circle cx="122" cy="22" r="4" fill="#0d0d14" stroke="#f4b860" strokeWidth="3" />
                          <path d="M8 58 L212 58" stroke="rgba(244,184,96,0.22)" strokeWidth="2" />
                        </svg>
                      </div>
                      <div className="rounded-xl bg-[#151520]/70 border border-white/5 p-2.5">
                        <div className="text-[10px] font-medium text-white mb-2">6-Month Forecast</div>
                        <div className="space-y-2.5">
                          <div className="relative pl-9 text-[8px] text-slate-400">
                            Target
                            <div className="absolute left-9 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-emerald-400/60"></div>
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400"></span>
                          </div>
                          <div className="relative pl-9 text-[8px] text-slate-400">
                            Actual
                            <div className="absolute left-9 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-sky-400/60"></div>
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sky-400"></span>
                          </div>
                          <div className="relative pl-9 text-[8px] text-slate-400">
                            Base
                            <div className="absolute left-9 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-400/40"></div>
                            <span className="absolute right-16 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-500"></span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom cards */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl bg-[#151520]/70 border border-white/5 p-2.5">
                        <div className="text-[10px] font-medium text-white mb-2">Lead Sources</div>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full" style={{ background: 'conic-gradient(#f4b860 0 50%, #34d399 50% 80%, #60a5fa 80% 100%)' }}>
                            <div className="w-8 h-8 rounded-full bg-[#0f0f16] relative top-2 left-2"></div>
                          </div>
                          <div className="space-y-1 text-[9px] text-slate-300">
                            <div className="flex items-center justify-between gap-8"><span>Zillow</span><span>50%</span></div>
                            <div className="flex items-center justify-between gap-8"><span>Referrals</span><span>30%</span></div>
                            <div className="flex items-center justify-between gap-8"><span>Open Houses</span><span>20%</span></div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#151520]/70 border border-white/5 p-2.5">
                        <div className="text-[10px] font-medium text-white mb-2">Recent Deal Activity</div>
                        <div className="space-y-1.5 text-[9px]">
                          <div className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5">
                            <div>
                              <div className="text-white font-medium">Under Contract</div>
                              <div className="text-slate-400">1847 Canyon View Dr</div>
                            </div>
                            <div className="text-white font-semibold">$845,000</div>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5">
                            <div>
                              <div className="text-white font-medium">Closing Scheduled</div>
                              <div className="text-slate-400">523 Maple Street</div>
                            </div>
                            <div className="text-white font-semibold">$1.2M</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
