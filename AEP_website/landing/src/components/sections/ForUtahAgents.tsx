export function ForUtahAgents() {
  const utahFeatures = [
    {
      title: "Official Utah REPC Forms",
      description: "Generate legally compliant Utah Real Estate Purchase Contracts with all required addenda. Pre-filled with your brokerage info.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Due Diligence Tracking",
      description: "Never miss the Utah 14-day due diligence deadline. Auto-reminders for inspections, financing, and appraisal contingencies.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Title Company Integration",
      description: "Connect with Utah title companies for seamless closings. Auto-populate settlement statements and closing documents.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: "Utah MLS Compatible",
      description: "Import listings from UtahRealEstate.com and Wasatch Front MLS. Keep your data synced automatically.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
    },
  ];

  const countyStats = [
    { county: "Salt Lake", deals: "1,200+", trend: "+12%" },
    { county: "Utah County", deals: "890+", trend: "+18%" },
    { county: "Davis", deals: "540+", trend: "+15%" },
    { county: "Weber", deals: "380+", trend: "+22%" },
  ];

  return (
    <section id="utah" className="relative py-20 md:py-32 overflow-hidden">
      {/* Background with Utah mountain silhouette feel */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#0a1628] to-slate-950"></div>
      
      {/* Mountain silhouette decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-64 opacity-20">
        <svg className="w-full h-full" viewBox="0 0 1440 320" preserveAspectRatio="none" fill="none">
          <path d="M0,320 L0,160 L180,120 L360,180 L480,100 L600,160 L720,80 L840,140 L960,60 L1080,120 L1200,100 L1320,160 L1440,140 L1440,320 Z" fill="url(#mountainGradient)"/>
          <defs>
            <linearGradient id="mountainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f4b860" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#f4b860" stopOpacity="0"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Decorative orbs */}
      <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-gradient-radial from-[#f4b860]/10 to-transparent rounded-full blur-[120px]"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-[#f4b860] mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Built for The Beehive State
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              The only CRM that <span className="gradient-text">speaks Utah</span>
            </h2>

            <p className="text-xl text-slate-400 mb-8 leading-relaxed">
              Generic CRMs don't understand Utah real estate. Our platform was built from the ground up for Utah's unique contracts, timelines, and compliance requirements.
            </p>

            {/* Feature list */}
            <div className="space-y-4">
              {utahFeatures.map((feature, index) => (
                <div
                  key={index}
                  className="group flex gap-4 p-4 rounded-xl bg-slate-900/50 border border-white/[0.06] hover:border-[#f4b860]/30 transition-all duration-300"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#f4b860]/20 to-amber-500/10 border border-[#f4b860]/20 flex items-center justify-center text-[#f4b860]">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Utah map visualization */}
          <div className="relative">
            {/* Glowing card */}
            <div className="relative rounded-3xl p-8 bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-white/[0.08] backdrop-blur-xl overflow-hidden"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 80px -20px rgba(244, 184, 96, 0.15)'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-white">Utah Market Coverage</h3>
                  <p className="text-sm text-slate-400">Active deals by county</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f4b860]/10 border border-[#f4b860]/20">
                  <span className="w-2 h-2 rounded-full bg-[#f4b860] animate-pulse"></span>
                  <span className="text-sm font-medium text-[#f4b860]">Live</span>
                </div>
              </div>

              {/* County stats */}
              <div className="space-y-4">
                {countyStats.map((stat, index) => (
                  <div key={index} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">{stat.county}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{stat.deals} deals</span>
                        <span className="text-xs font-medium text-[#f4b860] bg-[#f4b860]/10 px-2 py-0.5 rounded-full">
                          {stat.trend}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#f4b860] to-amber-400"
                        style={{ width: index === 0 ? '90%' : index === 1 ? '72%' : index === 2 ? '52%' : '38%' }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total badge */}
              <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-[#f4b860]/10 to-amber-500/10 border border-[#f4b860]/20 text-center">
                <div className="text-3xl font-bold text-[#f4b860] mb-1">3,000+</div>
                <div className="text-sm text-slate-400">Total Utah deals managed</div>
              </div>

              {/* Decorative Utah shape outline */}
              <div className="absolute -right-8 -bottom-8 w-40 h-48 opacity-10">
                <svg viewBox="0 0 100 120" fill="none" className="w-full h-full">
                  <path d="M0,0 L100,0 L100,90 L75,90 L75,120 L25,120 L25,90 L0,90 Z" stroke="#f4b860" strokeWidth="2" fill="none"/>
                </svg>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-4 -right-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#f4b860] to-amber-400 text-slate-900 text-sm font-semibold shadow-xl shadow-[#f4b860]/30 rotate-3">
              🏔️ Utah Exclusive
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
