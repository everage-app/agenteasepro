import { Hero } from '../sections/Hero';
import { ProblemSolution } from '../sections/ProblemSolution';
import { FeaturesGrid } from '../sections/FeaturesGrid';
import { HowItWorks } from '../sections/HowItWorks';
import { Testimonials } from '../sections/Testimonials';
import { ForUtahAgents } from '../sections/ForUtahAgents';
import { Pricing } from '../sections/Pricing';
import { FAQ } from '../sections/FAQ';
import { TrustBadges } from '../sections/TrustBadges';
import { NewsletterCapture } from '../sections/NewsletterCapture';
import { CTA } from '../sections/CTA';
import { Footer } from '../sections/Footer';
import { Logo } from '../ui/Logo';
import { useState, useEffect } from 'react';
import { EXTERNAL_LINKS } from '../../config/externalLinks';

export function SiteShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-gradient-radial from-slate-500/10 via-slate-600/5 to-transparent blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-gradient-radial from-amber-500/15 via-[#f4b860]/10 to-transparent blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-conic from-slate-500/3 via-amber-500/5 to-slate-500/3 blur-3xl"></div>
      </div>

      {/* Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[#f4b860]/35 after:to-transparent after:opacity-0 ${
        scrolled 
          ? 'py-2 backdrop-blur-2xl bg-slate-950/85 shadow-2xl shadow-black/20 after:opacity-100' 
          : 'py-3 backdrop-blur-xl bg-slate-950/30'
      }`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a
              href="/"
              aria-label="AgentEasePro home"
              className="inline-flex rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b860]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <Logo size="md" showText={true} animated={false} />
            </a>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { href: '#services', label: 'Services' },
                { href: '#workflows', label: 'Workflows' },
                { href: '#utah', label: 'For Utah agents' },
                { href: '#pricing', label: 'Pricing' },
                { href: '#faq', label: 'FAQ' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors group"
                >
                  {link.label}
                  <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-[#f4b860]/0 via-[#f4b860] to-[#f4b860]/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <a
                href="/book-demo"
                className="px-4 py-2 text-sm font-medium text-[#f4b860] hover:text-amber-300 transition-colors"
              >
                Book a Demo
              </a>
              <a
                href={EXTERNAL_LINKS.appEntry}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Log in
              </a>
              <a
                href={EXTERNAL_LINKS.appEntry}
                className="group relative px-5 py-2.5 text-sm font-semibold text-slate-950 rounded-full overflow-hidden bg-gradient-to-r from-amber-300 via-[#f4b860] to-amber-200 shadow-[0_0_0_1px_rgba(244,184,96,0.25),0_14px_35px_-18px_rgba(244,184,96,0.65)] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_0_1px_rgba(244,184,96,0.35),0_18px_45px_-18px_rgba(244,184,96,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b860]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.99]"
              >
                <span className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-80 bg-gradient-to-b from-white/35 via-white/10 to-transparent" />
                <span className="relative">Get started</span>
              </a>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden relative w-10 h-10 flex items-center justify-center rounded-xl glass-hover"
            >
              <svg className={`w-5 h-5 text-slate-300 transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile menu */}
          <div className={`md:hidden overflow-hidden transition-all duration-500 ease-out ${
            mobileMenuOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
          }`}>
            <div className="glass-card rounded-2xl p-4 space-y-1">
              {[
                { href: '#services', label: 'Services' },
                { href: '#workflows', label: 'Workflows' },
                { href: '#utah', label: 'For Utah agents' },
                { href: '#pricing', label: 'Pricing' },
                { href: '#faq', label: 'FAQ' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
                <a
                  href="/book-demo"
                  className="block px-4 py-3 text-sm font-medium text-center text-[#f4b860] border border-[#f4b860]/30 rounded-xl hover:bg-[#f4b860]/10 transition-all"
                >
                  Book a Demo
                </a>
                <a
                  href={EXTERNAL_LINKS.appEntry}
                  className="block px-4 py-3 text-sm font-medium text-center text-slate-300 border border-white/20 rounded-xl hover:bg-white/5 transition-all"
                >
                  Log in
                </a>
                <a
                  href={EXTERNAL_LINKS.appEntry}
                  className="group relative block px-4 py-3 text-sm font-semibold text-center text-slate-950 rounded-xl overflow-hidden bg-gradient-to-r from-amber-300 via-[#f4b860] to-amber-200 shadow-[0_0_0_1px_rgba(244,184,96,0.25),0_14px_35px_-18px_rgba(244,184,96,0.65)] transition-all duration-300 active:scale-[0.99]"
                >
                  <span className="pointer-events-none absolute inset-0 opacity-60 bg-gradient-to-b from-white/35 via-white/10 to-transparent" />
                  <span className="relative">Get started</span>
                </a>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="relative pt-20 md:pt-24 lg:pt-28">
        <Hero />
        <ProblemSolution />
        <FeaturesGrid />
        <HowItWorks />
        <Testimonials />
        <ForUtahAgents />
        <Pricing />
        <FAQ />
        <NewsletterCapture />
        <CTA />
        <TrustBadges />
      </main>

      <Footer />
    </div>
  );
}
