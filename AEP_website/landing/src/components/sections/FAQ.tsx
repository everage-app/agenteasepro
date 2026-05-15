import { useState } from 'react';

const faqs = [
  {
    q: "Is AgentEasePro only for Utah agents?",
    a: "We\u2019re built specifically for Utah right now \u2014 with native REPC forms, Utah-specific deadline rules, and local MLS integration. We\u2019re expanding to other states soon. If you\u2019re a Utah agent, you\u2019ll feel right at home on day one.",
  },
  {
    q: "What\u2019s included in the $49.99/month plan?",
    a: "Everything. Unlimited clients, deals, e-signatures, REPC generation, deadline tracking, marketing tools, listing management, AI-powered insights, and priority support. No tiers, no hidden fees, no per-user charges.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No card is required to create your account and start exploring. AgentEasePro includes a 7-day full-access trial, then continues at $49.99/month when you activate billing.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. Cancel with one click from your settings \u2014 no calls, no hoops, no cancellation fees. Plus we offer a 30-day money-back guarantee if you\u2019re not satisfied.",
  },
  {
    q: "How is this different from Follow Up Boss, ProAgentWebsites, or larger suites like BoomTown?",
    a: "Those public prices are usually base plans, not full workflows. Follow Up Boss starts CRM-first. ProAgentWebsites starts website-first. Larger suites move into demo and package pricing. AgentEasePro gives Utah agents contracts, e-signatures, deadline tracking, CRM, listing marketing, and compliance in one workspace for $49.99/month.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. We use bank-level encryption (AES-256), SOC 2-aligned security practices, email verification, rate limiting, and regular security audits. Your client data is protected with the same standards used by financial institutions.",
  },
  {
    q: "Can my team use it too?",
    a: "Yes! Each agent gets their own workspace with their own login, client database, and deal pipeline. Brokerage team features are coming soon.",
  },
  {
    q: "How do e-signatures work?",
    a: "Create a contract, add signature fields, and send a signing link to your client via email or text. They sign on any device \u2014 no app download required. You get notified instantly when it\u2019s complete.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-16 md:py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-slate-950"></div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-card text-xs md:text-sm font-medium text-[#f4b860] mb-5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Common Questions
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Got questions? <span className="gradient-text">We've got answers.</span>
          </h2>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto">
            Quick answers on pricing, features, and getting started with AgentEasePro.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-8 md:mb-10">
          <div className="rounded-xl border border-white/[0.08] bg-slate-900/45 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Includes</p>
            <p className="mt-1 text-sm font-semibold text-white">Contracts, CRM, and marketing</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-slate-900/45 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Built For</p>
            <p className="mt-1 text-sm font-semibold text-white">Utah workflows and REPC forms</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-slate-900/45 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Pricing</p>
            <p className="mt-1 text-sm font-semibold text-white">$49.99/month, no tier traps</p>
          </div>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`rounded-2xl border transition-all duration-300 ${
                  isOpen
                    ? 'bg-gradient-to-br from-slate-900/90 to-slate-800/50 border-[#f4b860]/20 shadow-[0_0_40px_-12px_rgba(244,184,96,0.15)]'
                    : 'bg-slate-900/40 border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-4 md:p-5 text-left"
                >
                  <span className={`text-base font-semibold pr-4 transition-colors ${isOpen ? 'text-[#f4b860]' : 'text-white'}`}>
                    {faq.q}
                  </span>
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isOpen ? 'bg-[#f4b860]/20 rotate-180' : 'bg-white/5'
                  }`}>
                    <svg className="w-4 h-4 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="px-4 md:px-5 pb-4 md:pb-5 text-sm md:text-base text-slate-400 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Still have questions */}
        <div className="mt-8 md:mt-10 text-center rounded-2xl border border-white/[0.08] bg-slate-900/50 px-6 py-6">
          <p className="text-slate-300 mb-4">Still have questions? Talk to our team directly.</p>
          <a
            href="mailto:sales@agenteasepro.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 hover:border-white/20 transition-all"
          >
            <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email us at sales@agenteasepro.com
          </a>
        </div>
      </div>
    </section>
  );
}
