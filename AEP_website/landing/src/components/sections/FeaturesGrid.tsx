import { EXTERNAL_LINKS } from '../../config/externalLinks';

export function FeaturesGrid() {
  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: 'Utah REPC Generator',
      description: 'Create compliant Utah REPCs with smart fields, built-in addenda, and auto-calculated deadlines. Never miss a due diligence date again.',
      gradient: 'from-[#f4b860] to-amber-500',
      bgGlow: 'from-[#f4b860]/20 to-amber-500/20',
      stat: '5 min',
      statLabel: 'avg contract time',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
      title: 'E-Signatures Built In',
      description: 'Send contracts for signature with one click. Buyers and sellers sign on any device. Get notified instantly when they complete.',
      gradient: 'from-amber-400 to-yellow-400',
      bgGlow: 'from-amber-400/20 to-yellow-400/20',
      stat: '100%',
      statLabel: 'legally binding',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      title: 'Deadline Auto-Tracker',
      description: 'Every contract milestone—due diligence, financing, appraisal, settlement—becomes a task with SMS & email reminders.',
      gradient: 'from-[#f4b860] to-amber-500',
      bgGlow: 'from-[#f4b860]/20 to-amber-500/20',
      stat: '0',
      statLabel: 'missed deadlines',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: 'Client & Lead CRM',
      description: 'Track buyers, sellers, and leads in one place. Score leads, log communications, and never let a referral slip through the cracks.',
      gradient: 'from-purple-500 to-violet-500',
      bgGlow: 'from-purple-500/20 to-violet-500/20',
      stat: '360°',
      statLabel: 'client view',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'Deal Pipeline',
      description: 'Visual pipeline from "New Lead" to "Closed". Drag deals between stages, see GCI at a glance, and know exactly where every transaction stands.',
      gradient: 'from-slate-400 to-slate-500',
      bgGlow: 'from-slate-400/20 to-slate-500/20',
      stat: 'Real-time',
      statLabel: 'pipeline view',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      title: 'Listing Hub',
      description: 'Manage all your listings with photos, property details, showing feedback, and marketing materials in one organized dashboard.',
      gradient: 'from-rose-500 to-pink-500',
      bgGlow: 'from-rose-500/20 to-pink-500/20',
      stat: '∞',
      statLabel: 'listings',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      ),
      title: 'Marketing Blaster',
      description: 'Launch listing campaigns across email and social with proven templates. You hit send. Track opens, clicks, and leads generated.',
      gradient: 'from-orange-500 to-red-500',
      bgGlow: 'from-orange-500/20 to-red-500/20',
      stat: '10x',
      statLabel: 'faster campaigns',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z" />
        </svg>
      ),
      title: 'Compliance Vault',
      description: 'Store contracts, disclosures, and signed docs in one secure hub with version history and an audit trail.',
      gradient: 'from-emerald-500 to-teal-400',
      bgGlow: 'from-emerald-500/20 to-teal-400/20',
      stat: 'Secure',
      statLabel: 'document hub',
    },
  ];

  return (
    <section id="features" className="relative py-20 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-slate-950"></div>
      
      {/* Floating orbs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-slate-500/5 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#f4b860]/10 rounded-full blur-[100px]"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-[#f4b860] mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Everything You Need
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            One platform. <span className="gradient-text">Every tool.</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Stop paying for 10 different apps. AgentEasePro gives you contracts, CRM, marketing,
            e-signatures, and deadline automation—all designed specifically for how Utah agents work.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative rounded-2xl p-6 bg-gradient-to-br from-slate-900/80 to-slate-800/40 border border-white/[0.06] backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:scale-[1.02] hover:-translate-y-1"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset'
              }}
            >
              {/* Hover glow */}
              <div className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${feature.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10`}></div>
              
              {/* Icon */}
              <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} text-white mb-5 shadow-lg group-hover:scale-110 group-hover:shadow-2xl transition-all duration-300`}>
                {feature.icon}
              </div>
              
              {/* Content */}
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">{feature.description}</p>
              
              {/* Stat */}
              <div className="pt-4 border-t border-white/[0.06] flex items-center gap-2">
                <span className={`text-2xl font-bold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                  {feature.stat}
                </span>
                <span className="text-xs text-slate-500">{feature.statLabel}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <a 
            href={EXTERNAL_LINKS.appEntry}
            className="group inline-flex items-center gap-2 px-8 py-4 font-semibold text-slate-950 rounded-xl bg-gradient-to-r from-[#f4b860] via-amber-400 to-amber-300 shadow-[0_0_0_1px_rgba(244,184,96,0.25),0_18px_45px_-18px_rgba(244,184,96,0.7)] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_0_1px_rgba(244,184,96,0.35),0_22px_55px_-18px_rgba(244,184,96,0.9)]"
          >
            Try All Features Free
            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <p className="mt-4 text-sm text-slate-500">No credit card required • Setup in under 5 minutes</p>
        </div>
      </div>
    </section>
  );
}
