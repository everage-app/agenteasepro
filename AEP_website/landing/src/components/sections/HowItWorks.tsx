import { EXTERNAL_LINKS } from '../../config/externalLinks';

export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Sign up in 60 seconds",
      description: "Create your account, no credit card needed. Import your existing clients or start fresh - we make onboarding a breeze.",
      color: "from-[#f4b860] to-amber-400",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      features: ["No credit card required", "Import existing clients", "Utah-ready templates"],
    },
    {
      number: "02",
      title: "Add your first deal",
      description: "Generate a Utah REPC in 5 minutes. All deadlines are automatically calculated and tracked - no spreadsheets needed.",
      color: "from-white to-slate-300",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      features: ["Auto-calculated deadlines", "Legal Utah REPC forms", "E-signature ready"],
    },
    {
      number: "03",
      title: "Close deals on autopilot",
      description: "Get SMS reminders, automated follow-ups, and never miss another deadline. Focus on selling - we handle the rest.",
      color: "from-slate-300 to-slate-400",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      features: ["SMS & email reminders", "Daily task list", "Automated follow-ups"],
    },
  ];

  return (
    <section id="workflows" className="relative py-20 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"></div>
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiMyMDI5M2EiIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEgMGExIDEgMCAxIDAgMiAwIDEgMSAwIDEgMC0yIDB6IiBmaWxsPSIjMzM0MTU1IiBmaWxsLW9wYWNpdHk9Ii4zIi8+PC9nPjwvc3ZnPg==')] opacity-30"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-[#f4b860] mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Get Started in Minutes
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Three steps to <span className="gradient-text">stress-free</span> closings
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            No complicated setup. No learning curve. Just results.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2">
            <div className="h-full bg-gradient-to-r from-[#f4b860]/20 via-white/20 to-slate-400/20 rounded-full"></div>
            <div className="absolute inset-0 h-full bg-gradient-to-r from-[#f4b860] via-white to-slate-400 rounded-full animate-pulse" style={{ width: '33%', animation: 'grow 3s ease-in-out infinite' }}></div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 lg:gap-4">
            {steps.map((step, index) => (
              <div key={index} className="relative group">
                {/* Step card */}
                <div className="relative rounded-2xl p-8 bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-white/[0.06] backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:scale-[1.02]"
                  style={{
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset'
                  }}
                >
                  {/* Step number badge */}
                  <div className={`absolute -top-5 left-8 w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-xl shadow-${step.color.split('-')[1]}-500/30`}>
                    <span className="text-lg font-bold text-slate-900">{step.number}</span>
                  </div>

                  {/* Icon */}
                  <div className={`mt-6 mb-6 w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color}/10 border border-white/10 flex items-center justify-center`}>
                    <div className={`bg-gradient-to-br ${step.color} bg-clip-text text-transparent`}>
                      {step.icon}
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed mb-6">{step.description}</p>

                  {/* Feature bullets */}
                  <ul className="space-y-2">
                    {step.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                        <svg className={`w-4 h-4 bg-gradient-to-br ${step.color} bg-clip-text text-transparent flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: step.color.includes('f4b860') ? '#f4b860' : step.color.includes('white') ? '#ffffff' : '#94a3b8' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Arrow connector (mobile) */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center py-4">
                    <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <a
            href={EXTERNAL_LINKS.appEntry}
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg text-slate-900 bg-gradient-to-r from-[#f4b860] to-amber-400 hover:from-[#f5c87a] hover:to-amber-300 shadow-xl shadow-[#f4b860]/30 transition-all duration-300 hover:scale-105"
          >
            Start Your Free Trial
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <p className="mt-4 text-sm text-slate-500">
            No credit card required • Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
