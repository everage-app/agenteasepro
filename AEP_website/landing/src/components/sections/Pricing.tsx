import { EXTERNAL_LINKS } from '../../config/externalLinks';

export function Pricing() {
  const features = [
    { name: "Unlimited clients & deals", included: true },
    { name: "Utah REPC generator", included: true },
    { name: "E-signatures (unlimited)", included: true },
    { name: "Auto deadline tracking", included: true },
    { name: "SMS & email reminders", included: true },
    { name: "Daily task list", included: true },
    { name: "Marketing blast tools", included: true },
    { name: "Listing management", included: true },
    { name: "Deal pipeline", included: true },
    { name: "Mobile app access", included: true },
    { name: "Priority support", included: true },
    { name: "Free updates forever", included: true },
  ];

  const comparisons = [
    { name: "Dotloop", price: "$31.99/mo", note: "No Utah forms" },
    { name: "Follow Up Boss", price: "$69/mo", note: "CRM only" },
    { name: "BoomTown", price: "$1,000+/mo", note: "Enterprise pricing" },
    { name: "kvCORE", price: "$499+/mo", note: "Lead gen focus" },
  ];

  return (
    <section id="pricing" className="relative py-20 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-black to-slate-950"></div>
      
      {/* Decorative elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-radial from-[#f4b860]/10 to-transparent rounded-full blur-[100px]"></div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-[#f4b860] mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Simple, Transparent Pricing
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            One price. <span className="gradient-text">Everything included.</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            No hidden fees. No tiered limits. No surprises. Just one low monthly price.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-xl mx-auto mb-16">
          <div className="relative rounded-3xl p-8 md:p-10 bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-[#f4b860]/30 backdrop-blur-xl"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 100px -20px rgba(244, 184, 96, 0.3)'
            }}
          >
            {/* Popular badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-gradient-to-r from-[#f4b860] to-amber-400 text-slate-900 text-sm font-bold shadow-xl shadow-[#f4b860]/30">
              🎉 Launch Special
            </div>

            {/* Header */}
            <div className="text-center mb-8 pt-4">
              <h3 className="text-2xl font-bold text-white mb-2">Professional Plan</h3>
              <p className="text-slate-400">Everything you need to close more deals</p>
            </div>

            {/* Price */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl text-slate-500 line-through">$99</span>
                <span className="px-2 py-1 rounded-full bg-[#f4b860]/20 text-[#f4b860] text-xs font-medium">50% OFF</span>
              </div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-6xl md:text-7xl font-bold text-white">$49</span>
                <span className="text-2xl text-slate-400">.99</span>
                <span className="text-lg text-slate-500 ml-2">/month</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                Billed monthly • Cancel anytime
              </p>
            </div>

            {/* Features grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-8">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#f4b860] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-slate-300">{feature.name}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <a
              href={EXTERNAL_LINKS.appEntry}
              className="block w-full py-4 rounded-2xl font-semibold text-lg text-center text-slate-900 bg-gradient-to-r from-[#f4b860] to-amber-400 hover:from-[#f5c87a] hover:to-amber-300 shadow-xl shadow-[#f4b860]/30 transition-all duration-300 hover:scale-[1.02]"
            >
              Start Free 14-Day Trial
            </a>

            <p className="mt-4 text-center text-sm text-slate-500">
              💳 No credit card required to start
            </p>

            {/* Guarantee */}
            <div className="mt-6 p-4 rounded-xl bg-slate-800/50 border border-white/5 text-center">
              <div className="flex items-center justify-center gap-2 text-[#f4b860] mb-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="font-semibold">30-Day Money-Back Guarantee</span>
              </div>
              <p className="text-xs text-slate-500">Not happy? Get a full refund, no questions asked.</p>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold text-white mb-6">Compare to other solutions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {comparisons.map((comp, index) => (
              <div key={index} className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.06]">
                <div className="font-medium text-slate-400 mb-1">{comp.name}</div>
                <div className="text-lg font-bold text-white">{comp.price}</div>
                <div className="text-xs text-red-400/80 mt-1">{comp.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AgentEasePro comparison */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#f4b860]/10 to-amber-500/10 border border-[#f4b860]/20">
            <div className="text-2xl font-bold text-[#f4b860]">AgentEasePro</div>
            <div className="text-2xl font-bold text-white">$49.99/mo</div>
            <div className="px-3 py-1 rounded-full bg-[#f4b860]/20 text-[#f4b860] text-sm font-medium">
              Everything included ✓
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
