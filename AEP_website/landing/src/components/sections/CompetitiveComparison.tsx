import { Link } from 'react-router-dom';
import { EXTERNAL_LINKS } from '../../config/externalLinks';
import {
  commonStack,
  pricingDisclaimer,
} from '../../config/comparisonData';

export function CompetitiveComparison() {
  return (
    <section id="compare" className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#08111f] to-slate-950"></div>
      <div className="absolute top-12 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#f4b860]/10 blur-[120px]"></div>
      <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-sky-500/10 blur-[120px]"></div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid gap-10 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f4b860]/20 bg-white/[0.04] px-4 py-2 text-sm font-medium text-[#f4b860] backdrop-blur-xl">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Public entry pricing is not apples-to-apples
            </div>

            <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl lg:text-5xl">
              The cheapest-looking plan is usually not the full workflow.
            </h2>

            <p className="max-w-3xl text-lg leading-relaxed text-slate-300 md:text-xl">
              Follow Up Boss starts CRM-first. ProAgentWebsites starts website-first. Enterprise suites move into demo and package pricing.
              AgentEasePro gives Utah agents contracts, e-signatures, deadlines, CRM, listing marketing, and compliance in one place for $49.99/month.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/compare"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f4b860] via-amber-400 to-amber-300 px-8 py-4 font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(244,184,96,0.25),0_18px_45px_-18px_rgba(244,184,96,0.8)] transition-all duration-300 hover:scale-[1.03]"
              >
                See the full compare page
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              <a
                href={EXTERNAL_LINKS.appEntry}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-8 py-4 font-semibold text-slate-100 transition-all duration-300 hover:border-[#f4b860]/30 hover:text-white"
              >
                Start for $49.99/month
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: 'Follow Up Boss Grow',
                  body: 'From $58/user/mo, billed annually. CRM first.',
                },
                {
                  title: 'ProAgentWebsites Lite',
                  body: '$49.95/mo. Website only. CRM starts higher.',
                },
                {
                  title: 'AgentEasePro',
                  body: '$49.99/mo. Contracts, CRM, e-sign, deadlines, and marketing included.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl">
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 to-slate-800/50 p-7 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Common stack</p>
                <h3 className="mt-2 text-2xl font-bold text-white">{commonStack.headline}</h3>
              </div>
              <div className="rounded-2xl border border-[#f4b860]/20 bg-[#f4b860]/10 px-4 py-3 text-right">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#f4b860]">Save</div>
                <div className="text-3xl font-bold text-white">{commonStack.savingsPercent}</div>
              </div>
            </div>

            <div className="space-y-3">
              {commonStack.tools.map((tool) => (
                <div key={tool.name} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-4">
                  <div>
                    <div className="font-semibold text-white">{tool.name}</div>
                    <div className="text-sm text-slate-400">{tool.note}</div>
                  </div>
                  <div className="text-lg font-bold text-slate-200">{tool.price}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-slate-950/70 p-5">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Public starting total</span>
                <span className="text-xl font-bold text-white">{commonStack.total}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{commonStack.subheadline}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {commonStack.missingItems.map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                    Missing: {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#f4b860]/25 bg-gradient-to-r from-[#f4b860]/14 to-amber-500/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f4b860]">AgentEasePro</div>
                  <div className="mt-1 text-2xl font-bold text-white">$49.99/mo</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-300">Monthly savings</div>
                  <div className="text-2xl font-bold text-[#f4b860]">{commonStack.savings}</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                One workspace for contracts, deadlines, CRM, marketing, e-signatures, and compliance instead of paying entry pricing for partial systems.
              </p>
            </div>
            <p className="mt-6 text-xs leading-relaxed text-slate-500">{pricingDisclaimer}</p>
          </div>
        </div>
      </div>

    </section>
  );
}