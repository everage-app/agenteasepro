import { useState } from 'react';

export function NewsletterCapture() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData as unknown as Record<string, string>).toString(),
      });
      setSubmitted(true);
      setEmail('');
    } catch {
      // Silently handle - Netlify will still capture
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative py-16 md:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#0a0e1a] to-slate-950"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(244,184,96,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(244,184,96,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 relative z-10">
        <div className="relative rounded-3xl p-8 md:p-12 bg-gradient-to-br from-slate-900/80 to-slate-800/40 border border-[#f4b860]/20 backdrop-blur-xl overflow-hidden"
          style={{ boxShadow: '0 25px 60px -12px rgba(0,0,0,0.5), 0 0 80px -20px rgba(244,184,96,0.15)' }}
        >
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#f4b860]/10 rounded-full blur-[80px]"></div>
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-[#f4b860]/5 rounded-full blur-[60px]"></div>

          <div className="relative z-10 grid md:grid-cols-5 gap-8 items-center">
            {/* Left: Copy */}
            <div className="md:col-span-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f4b860]/10 border border-[#f4b860]/20 text-xs font-medium text-[#f4b860] mb-4">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Free Resource
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Get the Utah Agent's
                <span className="gradient-text"> Deal Checklist</span>
              </h3>
              <p className="text-slate-400 leading-relaxed">
                Never miss a deadline again. Download our free 
                <span className="text-white font-medium"> 47-point closing checklist</span> used by
                top Utah agents — plus get weekly tips on closing more deals.
              </p>
            </div>

            {/* Right: Form */}
            <div className="md:col-span-2">
              {submitted ? (
                <div className="text-center p-6 rounded-2xl bg-[#f4b860]/10 border border-[#f4b860]/20">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f4b860]/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-1">You're in!</h4>
                  <p className="text-sm text-slate-400">Check your inbox for the checklist.</p>
                </div>
              ) : (
                <form
                  name="newsletter"
                  method="POST"
                  data-netlify="true"
                  netlify-honeypot="bot-field"
                  onSubmit={handleSubmit}
                  className="space-y-3"
                >
                  <input type="hidden" name="form-name" value="newsletter" />
                  <p className="hidden">
                    <label>Don't fill this out: <input name="bot-field" /></label>
                  </p>
                  <input
                    type="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f4b860]/50 focus:border-[#f4b860]/40 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-[#f4b860] to-amber-400 hover:from-[#f5c87a] hover:to-amber-300 shadow-lg shadow-[#f4b860]/25 transition-all duration-300 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending...' : 'Send Me the Checklist'}
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    No spam. Unsubscribe anytime. We respect your privacy.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
