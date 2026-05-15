import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';

export function BookDemo() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', brokerage: '', message: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

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
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-gradient-radial from-[#f4b860]/10 via-[#f4b860]/5 to-transparent blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-gradient-radial from-slate-500/10 to-transparent blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-50 py-4 backdrop-blur-xl bg-slate-950/80 border-b border-white/[0.06]">
        <nav className="max-w-5xl mx-auto px-4 flex items-center justify-between">
          <Link to="/" className="inline-flex rounded-xl">
            <Logo size="md" showText={true} animated={false} />
          </Link>
          <Link
            to="/"
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </nav>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: Sales copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-[#f4b860] mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Personal Demo
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              See AgentEasePro
              <br />
              <span className="gradient-text">in action</span>
            </h1>

            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              Get a personalized walkthrough of every feature — tailored to
              your business. Our team will show you exactly how AgentEasePro
              can help you close more deals and save hours every week.
            </p>

            <div className="space-y-5 mb-10">
              {[
                { title: '15 min personalized demo', desc: "We'll walk through the features that matter most to you" },
                { title: 'Live Q&A', desc: "Ask anything \u2014 pricing, migration, features, integrations" },
                { title: 'Free setup assistance', desc: "We'll help you import your clients and get started" },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#f4b860]/10 border border-[#f4b860]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-sm text-slate-400">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/[0.06]">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-[#f4b860]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-3">
                "The demo sold me instantly. They showed me how the REPC generator would
                save me 2 hours per contract. I signed up that same day."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f4b860] to-amber-400 flex items-center justify-center text-xs font-bold text-slate-900">
                  TW
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Tyler Walsh</div>
                  <div className="text-xs text-slate-500">Realtor®, Draper</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:sticky lg:top-24">
            <div className="rounded-3xl p-8 bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-[#f4b860]/20 backdrop-blur-xl"
              style={{ boxShadow: '0 25px 60px -12px rgba(0,0,0,0.5), 0 0 80px -20px rgba(244,184,96,0.15)' }}
            >
              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#f4b860]/20 flex items-center justify-center">
                    <svg className="w-10 h-10 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Demo request received!</h3>
                  <p className="text-slate-400 mb-6">
                    We'll reach out within 24 hours to schedule your personalized demo.
                  </p>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-[#f4b860] font-medium hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to home
                  </Link>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-1">Request a Demo</h2>
                  <p className="text-sm text-slate-400 mb-6">
                    Fill out the form and we'll be in touch within 24 hours.
                  </p>

                  <form
                    name="book-demo"
                    method="POST"
                    data-netlify="true"
                    netlify-honeypot="bot-field"
                    onSubmit={handleSubmit}
                    className="space-y-4"
                  >
                    <input type="hidden" name="form-name" value="book-demo" />
                    <p className="hidden">
                      <label>Don't fill this out: <input name="bot-field" /></label>
                    </p>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Jane Smith"
                        className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f4b860]/50 focus:border-[#f4b860]/40 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="jane@example.com"
                        className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f4b860]/50 focus:border-[#f4b860]/40 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="(801) 555-1234"
                        className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f4b860]/50 focus:border-[#f4b860]/40 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Brokerage</label>
                      <input
                        type="text"
                        name="brokerage"
                        value={form.brokerage}
                        onChange={handleChange}
                        placeholder="Your brokerage name"
                        className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f4b860]/50 focus:border-[#f4b860]/40 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Anything specific you'd like to see?</label>
                      <textarea
                        name="message"
                        rows={3}
                        value={form.message}
                        onChange={handleChange}
                        placeholder="E.g., REPC generation, e-signatures, marketing tools..."
                        className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f4b860]/50 focus:border-[#f4b860]/40 transition-all resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 rounded-xl font-semibold text-lg text-slate-900 bg-gradient-to-r from-[#f4b860] to-amber-400 hover:from-[#f5c87a] hover:to-amber-300 shadow-xl shadow-[#f4b860]/30 transition-all duration-300 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Sending...' : 'Request My Demo'}
                    </button>

                    <p className="text-center text-xs text-slate-500">
                      We'll never share your info. No spam, ever.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Simple footer */}
      <footer className="relative z-10 py-8 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} AgentEasePro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
