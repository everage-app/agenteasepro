export function ProblemSolution() {
  const problems = [
    { text: 'Hunting through emails for contract deadlines', icon: '📧' },
    { text: 'Juggling DocuSign, Excel, and 5 other apps', icon: '🔀' },
    { text: 'Manually tracking due diligence dates', icon: '📅' },
    { text: 'Generic CRMs that don\'t speak Utah', icon: '🤷' },
    { text: 'Forgetting to follow up with leads', icon: '💸' },
  ];

  const solutions = [
    { text: 'All deadlines auto-created from your contracts', icon: '✨' },
    { text: 'One workspace for everything', icon: '🎯' },
    { text: 'SMS + email reminders before each milestone', icon: '🔔' },
    { text: 'Built specifically for Utah REPC workflow', icon: '🏔️' },
    { text: 'Daily task list tells you who to contact', icon: '📌' },
  ];

  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#0a0a0f] to-black"></div>
      
      {/* Decorative elements */}
      <div className="absolute top-1/2 left-0 w-1/3 h-[500px] bg-gradient-to-r from-red-500/5 to-transparent -translate-y-1/2"></div>
      <div className="absolute top-1/2 right-0 w-1/3 h-[500px] bg-gradient-to-l from-[#f4b860]/5 to-transparent -translate-y-1/2"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-slate-300 mb-6">
            <svg className="w-4 h-4 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            The AgentEasePro Difference
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            From chaos to <span className="gradient-text">clarity</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            See how AgentEasePro transforms the way Utah agents work
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Before - Problems */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-red-500/10 to-orange-500/5 rounded-3xl blur-xl"></div>
            <div className="relative rounded-2xl p-8 bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-red-500/20 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">The Old Way</h3>
                  <p className="text-sm text-red-300/70">Scattered, stressful, easy to miss things</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {problems.map((problem, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-red-500/5 border border-red-500/10 transition-all hover:bg-red-500/10 hover:border-red-500/20">
                    <span className="text-2xl">{problem.icon}</span>
                    <span className="text-slate-300">{problem.text}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-300 text-center">
                  <span className="font-semibold">Result:</span> Missed deadlines, lost deals, constant stress
                </p>
              </div>
            </div>
          </div>

          {/* After - Solutions */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-[#f4b860]/10 to-amber-500/5 rounded-3xl blur-xl"></div>
            <div className="relative rounded-2xl p-8 bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-[#f4b860]/20 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-[#f4b860]/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">The AgentEasePro Way</h3>
                  <p className="text-sm text-[#f4b860]/70">Organized, automated, crystal clear</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {solutions.map((solution, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-[#f4b860]/5 border border-[#f4b860]/10 transition-all hover:bg-[#f4b860]/10 hover:border-[#f4b860]/20">
                    <span className="text-2xl">{solution.icon}</span>
                    <span className="text-slate-300">{solution.text}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-[#f4b860]/20 to-amber-500/20 border border-[#f4b860]/30">
                <p className="text-sm text-[#f4b860] text-center">
                  <span className="font-semibold">Result:</span> More closed deals, zero missed deadlines, peace of mind
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Banner */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: '5 min', label: 'to create a REPC', icon: '⚡' },
            { value: '100%', label: 'deadline visibility', icon: '👁️' },
            { value: '1', label: 'platform for everything', icon: '🏠' },
            { value: '∞', label: 'time saved', icon: '⏰' },
          ].map((stat, i) => (
            <div key={i} className="text-center p-6 rounded-2xl glass-card border border-white/[0.06]">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
