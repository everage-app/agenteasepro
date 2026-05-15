import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/Layout/SiteHeader';
import { EXTERNAL_LINKS } from '../config/externalLinks';
import {
  agenteaseIncludedFeatures,
  comparisonProducts,
  comparisonRows,
  commonStack,
  fullComparisonProductIds,
  pricingDisclaimer,
  type ComparisonTone,
  type ProductId,
} from '../config/comparisonData';

const statusStyles: Record<ComparisonTone, string> = {
  included: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
  limited: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
  missing: 'border-white/10 bg-white/[0.04] text-slate-300',
  quote: 'border-sky-400/20 bg-sky-500/10 text-sky-100',
};

const productAccent: Record<ProductId, string> = {
  agenteasepro: 'border-[#f4b860]/30 bg-gradient-to-br from-[#f4b860]/14 to-amber-500/6',
  followupboss: 'border-sky-400/20 bg-gradient-to-br from-sky-500/10 to-slate-900/50',
  proagentwebsites: 'border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-900/50',
  boomtown: 'border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-slate-900/50',
  boldtrail: 'border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 to-slate-900/50',
};

function getProduct(productId: ProductId) {
  return comparisonProducts.find((product) => product.id === productId)!;
}

function StatusChip({ tone, label }: { tone: ComparisonTone; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusStyles[tone]}`}
    >
      {label}
    </span>
  );
}

export function Compare() {
  const products = fullComparisonProductIds.map(getProduct);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-1/4 top-0 h-[460px] w-[460px] rounded-full bg-[#f4b860]/10 blur-[140px]"></div>
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-sky-500/10 blur-[140px]"></div>
        <div className="absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/[0.03] blur-[150px]"></div>
      </div>

      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 md:pb-24 md:pt-28 lg:pt-32">
        <section className="grid gap-10 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
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
              Public entry pricing snapshot • April 2026
            </div>

            <h1 className="max-w-4xl text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
              Most competitor prices are base plans. AgentEasePro is the full workflow.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 md:text-xl">
              Follow Up Boss Grow is CRM-first. ProAgentWebsites starts at website-only. BoomTown and BoldTrail sell package-led systems with demo or quote friction.
              AgentEasePro gives Utah agents contracts, deadlines, CRM, e-signatures, marketing, and compliance together in one workspace for $49.99/month.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { value: commonStack.savingsPercent, label: 'less than the public CRM + website starting point' },
                { value: '0', label: 'core add-ons needed for contracts, deadlines, and e-sign' },
                { value: 'Utah', label: 'workflow built in instead of patched on later' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl">
                  <div className="text-3xl font-bold text-white">{item.value}</div>
                  <div className="mt-2 text-sm leading-relaxed text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href={EXTERNAL_LINKS.appEntry}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#f4b860] via-amber-400 to-amber-300 px-8 py-4 font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(244,184,96,0.25),0_18px_45px_-18px_rgba(244,184,96,0.8)] transition-all duration-300 hover:scale-[1.03]"
              >
                Move to AgentEasePro
              </a>
              <Link
                to="/book-demo"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-8 py-4 font-semibold text-slate-100 transition-all duration-300 hover:border-[#f4b860]/30 hover:text-white"
              >
                Book a demo
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 to-slate-800/50 p-7 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">What agents piece together</p>
                <h2 className="mt-2 text-2xl font-bold text-white">{commonStack.headline}</h2>
              </div>
              <div className="rounded-2xl border border-[#f4b860]/20 bg-[#f4b860]/10 px-4 py-3 text-right">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#f4b860]">Monthly savings</div>
                <div className="text-3xl font-bold text-white">{commonStack.savings}</div>
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
                <div className="rounded-full border border-[#f4b860]/20 bg-[#f4b860]/10 px-3 py-1 text-sm font-medium text-[#f4b860]">
                  Full workflow included
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                Built for agents who want fewer handoffs, fewer missed details, faster deals, and a platform that speaks Utah instead of forcing Utah into a generic base plan.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">Everything already included in AgentEasePro</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                This is what prospects should understand instantly: $49.99 is not a teaser tier. It is the operating system Utah agents actually use every day.
              </p>
            </div>
            <div className="rounded-full border border-[#f4b860]/20 bg-[#f4b860]/10 px-4 py-2 text-sm font-semibold text-[#f4b860]">
              $49.99/mo all in
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {agenteaseIncludedFeatures.map((feature) => (
              <div key={feature} className="rounded-2xl border border-[#f4b860]/14 bg-gradient-to-br from-[#f4b860]/10 to-white/[0.02] p-4 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <svg className="h-4 w-4 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">What the entry price really buys</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                These public numbers are the starting line, not an apples-to-apples replacement for what AgentEasePro includes.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Verified from vendor pages</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <article
                key={product.id}
                className={`rounded-3xl border p-6 backdrop-blur-xl ${productAccent[product.id]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-bold text-white">{product.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{product.positioning}</div>
                  </div>
                  {product.id === 'agenteasepro' ? (
                    <span className="rounded-full border border-[#f4b860]/25 bg-[#f4b860]/10 px-3 py-1 text-xs font-medium text-[#f4b860]">
                      The move
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 text-3xl font-bold text-white">{product.price}</div>
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-slate-300">
                  {product.priceNote}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-slate-300">{product.summary}</p>
                <p className="mt-4 text-sm leading-relaxed text-slate-400">{product.watchout}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/70 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-white/[0.08] px-6 py-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">Full competitive breakdown</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                The decision should be obvious: keep paying entry pricing for partial tools, or move into one Utah-ready operating system.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Scroll horizontally on smaller screens</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1220px] w-full">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-left">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">What matters</th>
                  {products.map((product) => (
                    <th key={product.id} className="px-6 py-4 text-sm font-semibold text-white">
                      <div>{product.name}</div>
                      <div className="mt-1 text-xs font-normal text-slate-500">{product.price}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.06] last:border-b-0">
                    <td className="px-6 py-4 text-sm font-medium text-slate-300">{row.label}</td>
                    {products.map((product) => {
                      const status = row.values[product.id];

                      return (
                        <td key={`${row.label}-${product.id}`} className="px-6 py-4 align-middle">
                          <StatusChip tone={status.tone} label={status.label} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Utah closings stay visible',
              body: 'AgentEasePro is the only option here that publicly leads with Utah REPC workflows and deadline tracking rather than treating Utah like an afterthought.',
            },
            {
              title: 'Prospects feel the simplicity',
              body: 'One workspace is easier to say yes to than CRM-first pricing, website-first pricing, or quote-led package sales that still need stitching together.',
            },
            {
              title: 'The price story lands fast',
              body: 'When public starting pricing is already at $137.95/month before transaction and Utah workflow tools, $49.99/month reads like the obvious switch.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl">
              <h3 className="text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-[#f4b860]/20 bg-gradient-to-br from-[#f4b860]/14 to-amber-500/6 p-8 backdrop-blur-xl md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f4b860]">The bottom line</div>
              <h2 className="mt-2 text-3xl font-bold text-white">Prospects should feel the difference in ten seconds.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-200">
                AgentEasePro is the strongest pitch when you want to show one price, one login, one workflow, and a platform that actually understands Utah real estate without hiding the essentials behind higher tiers or add-ons.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={EXTERNAL_LINKS.appEntry}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-7 py-4 font-semibold text-[#f4b860] transition-colors hover:text-amber-300"
              >
                Start your free trial
              </a>
              <Link
                to="/book-demo"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-7 py-4 font-semibold text-white transition-colors hover:border-white/25"
              >
                Book a live walkthrough
              </Link>
            </div>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-slate-300/80">{pricingDisclaimer}</p>
        </section>
      </main>
    </div>
  );
}