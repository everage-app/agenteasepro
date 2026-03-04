export function TrustBadges() {
  const badges = [
    {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      label: 'SOC 2 Aligned',
      desc: 'Enterprise-grade security practices',
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      label: 'AES-256 Encryption',
      desc: 'Bank-level data protection',
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      label: '99.9% Uptime',
      desc: 'Reliable infrastructure on AWS',
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      label: 'Stripe Payments',
      desc: 'PCI-compliant billing',
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: '24/7 Monitoring',
      desc: 'Automated security auditing',
    },
  ];

  return (
    <section className="relative py-12 md:py-16 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-black"></div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            Trusted & Secure
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 md:gap-8">
          {badges.map((badge, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-900/40 border border-white/[0.04] hover:border-white/[0.08] transition-all"
            >
              <div className="text-[#f4b860]/70">{badge.icon}</div>
              <div>
                <div className="text-sm font-semibold text-white">{badge.label}</div>
                <div className="text-xs text-slate-500">{badge.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
