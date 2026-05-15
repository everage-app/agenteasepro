import type { ReactNode } from 'react';

interface WorkflowStep {
  title: string;
  description: string;
  icon: ReactNode;
}

function WorkflowStepCard({
  step,
  tone,
  showConnector,
}: {
  step: WorkflowStep;
  tone: 'old' | 'new';
  showConnector: boolean;
}) {
  const isOld = tone === 'old';

  return (
    <div className="relative pl-16">
      {showConnector ? (
        <div
          className={`absolute left-6 top-14 bottom-[-28px] w-px ${
            isOld
              ? 'bg-gradient-to-b from-rose-300/35 to-transparent'
              : 'bg-gradient-to-b from-[#f4b860]/40 to-transparent'
          }`}
        />
      ) : null}

      <div
        className={`absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-2xl border ${
          isOld
            ? 'border-white/10 bg-white/[0.04] text-rose-200'
            : 'border-[#f4b860]/18 bg-gradient-to-br from-[#f4b860]/18 to-amber-500/8 text-[#f4b860]'
        }`}
      >
        {step.icon}
      </div>

      <div
        className={`rounded-3xl border p-5 backdrop-blur-xl ${
          isOld
            ? 'border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.02]'
            : 'border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-[#f4b860]/[0.04]'
        }`}
      >
        <h4 className="text-lg font-semibold text-white">{step.title}</h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.description}</p>
      </div>
    </div>
  );
}

export function ProblemSolution() {
  const oldWaySteps: WorkflowStep[] = [
    {
      title: 'Lead details split from the real deal work',
      description:
        'Buyer notes, property context, and next actions get scattered between the CRM, inbox, phone, and whatever tab is open first.',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M17 20h5v-1a4 4 0 00-5-3.87M17 20H7m10 0v-1c0-1.1-.22-2.15-.62-3.11M7 20H2v-1a4 4 0 015-3.87M7 20v-1c0-1.1.22-2.15.62-3.11M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM5 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      title: 'Contracts and signatures require handoffs',
      description:
        'The REPC, addenda, signatures, uploads, and task reminders jump between separate tools before the file even feels stable.',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3-3m-3 3 3 3"
          />
        </svg>
      ),
    },
    {
      title: 'Critical Utah dates get rebuilt by hand',
      description:
        'Due diligence, earnest money, financing, appraisal, and settlement dates depend on calendar math, memory, and who remembered to set the reminder.',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      title: 'Closeout becomes a cleanup project',
      description:
        'Signed docs, compliance items, listing tasks, and follow-up all need to be gathered back together when clients want fast answers.',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M3 7.5A2.5 2.5 0 015.5 5H10l2 2h6.5A2.5 2.5 0 0121 9.5v7A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-9z"
          />
        </svg>
      ),
    },
  ];

  const newWaySteps: WorkflowStep[] = [
    {
      title: 'Open the deal once inside one workspace',
      description:
        'Lead, client, property, contract, docs, reminders, and next actions start from the same Utah-ready record instead of scattering immediately.',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M4 6h7v7H4V6zm9 0h7v4h-7V6zM4 15h4v3H4v-3zm6-2h10v5H10v-5z"
          />
        </svg>
      ),
    },
    {
      title: 'Generate the REPC with connected dates',
      description:
        'Forms, addenda, signatures, and deadline logic stay attached to the deal instead of being rebuilt across PDFs, inboxes, and side notes.',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      title: 'See every next action automatically',
      description:
        'Earnest money, due diligence, financing, appraisal, settlement, reminders, and follow-up populate without manual setup or guesswork.',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      title: 'Close with the full file already intact',
      description:
        'Marketing tasks, signed docs, compliance history, and the audit trail stay organized from first call to close instead of becoming end-stage cleanup.',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z"
          />
        </svg>
      ),
    },
  ];

  const proofPoints = [
    {
      value: '5 min',
      label: 'to generate a Utah-ready REPC',
      detail: 'No starting from old PDFs or rebuilding the same contract by hand.',
    },
    {
      value: '0',
      label: 'manual deadline rebuilds',
      detail: 'Key dates appear automatically the moment the deal is created.',
    },
    {
      value: '1',
      label: 'workspace from lead to close',
      detail: 'CRM, docs, reminders, marketing, and compliance stay connected.',
    },
    {
      value: '100%',
      label: 'deadline visibility',
      detail: 'The next move is visible without digging through inboxes or side notes.',
    },
  ];

  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#070b13] to-black"></div>
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="absolute left-[-10%] top-24 h-[420px] w-[420px] rounded-full bg-sky-500/8 blur-[130px]"></div>
      <div className="absolute right-[-8%] top-10 h-[540px] w-[540px] rounded-full bg-[#f4b860]/12 blur-[150px]"></div>
      <div className="absolute bottom-0 left-1/2 h-[300px] w-[900px] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#f4b860]/80">
            How Utah agents actually work
          </p>
          <h2 className="mt-5 text-3xl font-bold text-white md:text-5xl lg:text-6xl">
            From chaos to <span className="gradient-text">clarity</span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-400 md:text-xl">
            The job does not break on one big task. It breaks in the handoffs between contracts, signatures,
            dates, follow-up, marketing, and compliance. AgentEasePro removes those handoffs.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-[0.94fr_1.06fr]">
          <div className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-gradient-to-br from-slate-900/92 via-[#19131a]/92 to-slate-900/80 p-8 shadow-[0_32px_90px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl md:p-10">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-300/40 to-transparent"></div>
            <div className="absolute -left-16 top-16 h-40 w-40 rounded-full bg-rose-400/10 blur-[100px]"></div>

            <div className="flex flex-col gap-6 border-b border-white/[0.08] pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Fragmented stack</p>
                <h3 className="mt-3 text-2xl font-bold text-white md:text-3xl">
                  Every accepted offer creates more places to check.
                </h3>
              </div>
              <div className="md:text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Typical reality</div>
                <div className="mt-2 text-4xl font-bold text-white">5+</div>
                <div className="text-sm text-slate-500">tools touched to keep one file moving</div>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
              Once the deal turns real, most agents are bouncing between inboxes, contract tools, calendars,
              spreadsheets, signature apps, and memory. The work gets done, but the workflow fights back.
            </p>

            <div className="mt-8 space-y-7">
              {oldWaySteps.map((step, index) => (
                <WorkflowStepCard
                  key={step.title}
                  step={step}
                  tone="old"
                  showConnector={index < oldWaySteps.length - 1}
                />
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-white/[0.08] bg-black/20 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">What that feels like</p>
              <p className="mt-3 text-lg font-medium leading-relaxed text-white">
                More manual date math, slower response, scattered notes, and more room for missed details right when the client expects calm.
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-[#f4b860]/16 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-[#14161f] p-8 shadow-[0_36px_120px_-48px_rgba(244,184,96,0.4)] backdrop-blur-xl md:p-10">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f4b860]/50 to-transparent"></div>
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#f4b860]/10 blur-[120px]"></div>
            <div className="absolute -bottom-10 left-8 h-40 w-40 rounded-full bg-amber-300/8 blur-[100px]"></div>

            <div className="flex flex-col gap-6 border-b border-white/[0.08] pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#f4b860]/75">Connected workflow</p>
                <h3 className="mt-3 text-2xl font-bold text-white md:text-3xl">
                  One deal becomes one command center.
                </h3>
              </div>
              <div className="md:text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">AgentEasePro</div>
                <div className="mt-2 text-4xl font-bold gradient-text">1</div>
                <div className="text-sm text-slate-400">workspace from lead to close</div>
              </div>
            </div>

            <p className="mt-6 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">
              Instead of managing handoffs between separate systems, the deal itself becomes the operating system.
              Contracts, dates, signatures, reminders, marketing, and compliance stay tied to the same record the whole way through.
            </p>

            <div className="mt-8 space-y-7">
              {newWaySteps.map((step, index) => (
                <WorkflowStepCard
                  key={step.title}
                  step={step}
                  tone="new"
                  showConnector={index < newWaySteps.length - 1}
                />
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-[#f4b860]/18 bg-gradient-to-r from-[#f4b860]/12 via-amber-400/8 to-white/[0.03] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f4b860]/80">What that feels like</p>
              <p className="mt-3 text-lg font-medium leading-relaxed text-white">
                Faster contracts, visible next steps, cleaner files, calmer clients, and a daily workflow that finally feels guided instead of reactive.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {proofPoints.map((point) => (
            <div
              key={point.label}
              className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 to-slate-800/35 p-6 shadow-[0_24px_60px_-34px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Proof point</div>
              <div className="mt-4 text-4xl font-bold gradient-text">{point.value}</div>
              <div className="mt-2 text-base font-semibold text-white">{point.label}</div>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{point.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
