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
    a: "No. Start your 14-day free trial instantly \u2014 no credit card required. You only pay when you decide to continue after the trial.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. Cancel with one click from your settings \u2014 no calls, no hoops, no cancellation fees. Plus we offer a 30-day money-back guarantee if you\u2019re not satisfied.",
  },
  {
    q: "How is this different from Dotloop, Follow Up Boss, or kvCORE?",
    a: "Those tools do one thing well \u2014 we do everything. AgentEasePro combines CRM, contract management, e-signatures, deadline tracking, listing marketing, and AI tools into one workspace. And at $49.99/mo, it\u2019s a fraction of what you\u2019d pay cobbling together multiple tools.",
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
    <section id="faq" className="relative py-20 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-slate-950"></div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-[#f4b860] mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            FAQ
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Got questions? <span className="gradient-text">We've got answers.</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Everything you need to know before getting started
          </p>
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
                  className="w-full flex items-center justify-between p-5 md:p-6 text-left"
                >
                  <span className={`font-semibold pr-4 transition-colors ${isOpen ? 'text-[#f4b860]' : 'text-white'}`}>
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
                <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="px-5 md:px-6 pb-5 md:pb-6 text-slate-400 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Still have questions */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 mb-4">Still have questions?</p>
          <a
            href="mailto:hello@agenteasepro.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 hover:border-white/20 transition-all"
          >
            <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email us at hello@agenteasepro.com
          </a>
        </div>
      </div>
    </section>
  );
}
