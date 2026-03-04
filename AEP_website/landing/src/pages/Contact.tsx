import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';

export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

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
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-[#f4b860]/8 to-transparent blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-gradient-radial from-slate-500/8 to-transparent blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-50 py-4 backdrop-blur-xl bg-slate-950/80 border-b border-white/[0.06]">
        <nav className="max-w-4xl mx-auto px-4 flex items-center justify-between">
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

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Get in <span className="gradient-text">Touch</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            Have a question, feedback, or need support? We'd love to hear from you.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Contact cards */}
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.06] hover:border-white/[0.12] transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#f4b860]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Email Us</h3>
              <a href="mailto:hello@agenteasepro.com" className="text-sm text-[#f4b860] hover:underline">
                hello@agenteasepro.com
              </a>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.06] hover:border-white/[0.12] transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#f4b860]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Support</h3>
              <a href="mailto:support@agenteasepro.com" className="text-sm text-[#f4b860] hover:underline">
                support@agenteasepro.com
              </a>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.06] hover:border-white/[0.12] transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#f4b860]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Location</h3>
              <p className="text-sm text-slate-400">Salt Lake City, Utah</p>
            </div>
          </div>

          {/* Contact form */}
          <div className="md:col-span-2">
            <div className="rounded-3xl p-8 bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-white/[0.08] backdrop-blur-xl">
              {submitted ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#f4b860]/20 flex items-center justify-center">
                    <svg className="w-10 h-10 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Message sent!</h3>
                  <p className="text-slate-400">We'll get back to you as soon as possible.</p>
                </div>
              ) : (
                <form
                  name="contact"
                  method="POST"
                  data-netlify="true"
                  netlify-honeypot="bot-field"
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  <input type="hidden" name="form-name" value="contact" />
                  <p className="hidden">
                    <label>Don't fill this out: <input name="bot-field" /></label>
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Name *</label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={form.name}
                        onChange={handleChange}
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
                        className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f4b860]/50 focus:border-[#f4b860]/40 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Subject</label>
                    <select
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#f4b860]/50 focus:border-[#f4b860]/40 transition-all"
                    >
                      <option value="">Select a topic</option>
                      <option value="general">General inquiry</option>
                      <option value="support">Technical support</option>
                      <option value="billing">Billing question</option>
                      <option value="partnership">Partnership</option>
                      <option value="feedback">Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Message *</label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f4b860]/50 focus:border-[#f4b860]/40 transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 rounded-xl font-semibold text-lg text-slate-900 bg-gradient-to-r from-[#f4b860] to-amber-400 hover:from-[#f5c87a] hover:to-amber-300 shadow-xl shadow-[#f4b860]/30 transition-all duration-300 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-8 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} AgentEasePro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
