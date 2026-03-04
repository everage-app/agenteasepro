import { EXTERNAL_LINKS } from '../../config/externalLinks';

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
                The #1 CRM Built for Utah Agents
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold leading-[1.06] tracking-tight animate-slide-up animation-delay-200">
              <span className="text-white">Close more deals.</span>
              <br />
              <span className="text-white">Miss zero deadlines.</span>
              <br />
              <span className="bg-gradient-to-r from-[#f4b860] via-amber-300 to-[#f4b860] bg-clip-text text-transparent">
                All in one workspace.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-slate-300/90 leading-relaxed max-w-xl animate-slide-up animation-delay-400">
              Draft <span className="text-white font-semibold">Utah REPCs in minutes</span>, auto-track every deadline,
              manage clients, e-sign contracts, and launch listing marketing—
              <span className="text-[#f4b860]">all without the chaos of 10 different apps.</span>
            </p>

            {/* Value Props Row */}
            <div className="flex flex-wrap gap-4 animate-slide-up animation-delay-500">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Utah REPC forms built-in
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                E-Signatures included
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Deadline automation built in
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up animation-delay-600">
              <a href={EXTERNAL_LINKS.appEntry} className="group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-slate-950 rounded-xl overflow-hidden bg-gradient-to-r from-[#f4b860] via-amber-400 to-amber-300 shadow-[0_0_0_1px_rgba(244,184,96,0.25),0_18px_45px_-18px_rgba(244,184,96,0.8)] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_0_1px_rgba(244,184,96,0.35),0_22px_55px_-18px_rgba(244,184,96,0.95)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b860]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.99]">
                <span className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-80 bg-gradient-to-b from-white/35 via-white/10 to-transparent" />
                <span className="relative z-10 flex items-center gap-2">
                  Start Free — No Card Required
                  <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </a>
              <a href="/book-demo" className="group inline-flex items-center justify-center px-8 py-4 font-semibold text-white rounded-xl border border-white/20 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/40 transition-all duration-300 hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99]">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Book a Demo
                </span>
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
                  <span className="text-xs text-slate-400">Loved by Utah agents</span>
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
              className="relative transition-transform duration-700 ease-out hover:scale-[1.02]"
              style={{
                transform: 'perspective(1800px) rotateX(10deg) rotateY(-12deg) rotateZ(1deg)',
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
                      <svg width="24" height="24" viewBox="0 0 50 50" fill="none">
                        <rect x="14" y="3" width="32" height="32" rx="5" stroke="#f4b860" strokeWidth="2.5" fill="transparent"/>
                        <rect x="3" y="14" width="32" height="32" rx="5" stroke="#f4b860" strokeWidth="2.5" fill="#0f0f16"/>
                        <g transform="translate(7, 19)">
                          <path d="M12 2L2 10V22H22V10L12 2Z" stroke="#f4b860" strokeWidth="2" fill="none"/>
                        </g>
                      </svg>
                      <span className="font-semibold text-[#f4b860] text-sm">AgentEase</span>
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
                  <div className="flex-1 p-5 bg-gradient-to-br from-[#0d0d14] to-[#060609]">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="p-3 rounded-xl bg-[#151520]/80 border border-[#f4b860]/15">
                        <div className="text-[10px] text-[#f4b860]/60 mb-0.5">Active Deals</div>
                        <div className="text-2xl font-bold text-[#f4b860]">12</div>
                        <div className="text-[8px] text-[#f4b860] flex items-center gap-1 mt-1">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                          3 closing this week
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#151520]/80 border border-slate-500/15">
                        <div className="text-[10px] text-slate-400/60 mb-0.5">Volume YTD</div>
                        <div className="text-2xl font-bold text-white">$4.2M</div>
                        <div className="text-[8px] text-[#f4b860] flex items-center gap-1 mt-1">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                          +24% vs last year
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#151520]/80 border border-slate-500/15">
                        <div className="text-[10px] text-slate-400/60 mb-0.5">Tasks Today</div>
                        <div className="text-2xl font-bold text-white">7</div>
                        <div className="text-[8px] text-slate-400 flex items-center gap-1 mt-1">
                          4 done, 3 remaining
                        </div>
                      </div>
                    </div>
                    
                    {/* Upcoming deadlines */}
                    <div className="bg-[#151520]/60 rounded-xl border border-white/5 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-white">Upcoming Deadlines</span>
                        <span className="text-[10px] text-[#f4b860]">View all →</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-[11px] font-medium text-white">Due Diligence Deadline</div>
                            <div className="text-[10px] text-slate-400">1847 Canyon View Dr</div>
                          </div>
                          <div className="text-[10px] font-semibold text-amber-400">Tomorrow</div>
                        </div>
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                          <div className="w-8 h-8 rounded-lg bg-slate-500/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-[11px] font-medium text-white">Financing Contingency</div>
                            <div className="text-[10px] text-slate-400">523 Maple Street</div>
                          </div>
                          <div className="text-[10px] text-slate-400">In 5 days</div>
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
