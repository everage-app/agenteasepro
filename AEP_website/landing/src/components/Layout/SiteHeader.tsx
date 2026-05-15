import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EXTERNAL_LINKS } from '../../config/externalLinks';
import { Logo } from '../ui/Logo';

type HeaderNavItem =
  | { type: 'section'; sectionId: string; label: string }
  | { type: 'route'; to: string; label: string; featured?: boolean };

const headerNavItems: HeaderNavItem[] = [
  { type: 'section', sectionId: 'services', label: 'Features' },
  { type: 'section', sectionId: 'workflows', label: 'How It Works' },
  { type: 'section', sectionId: 'pricing', label: 'Pricing' },
  { type: 'route', to: '/compare', label: 'Compare', featured: true },
];

function isComparePath(pathname: string) {
  return pathname === '/compare' || pathname === '/comparison';
}

function buildSectionHref(pathname: string, sectionId: string) {
  return pathname === '/' ? `#${sectionId}` : `/#${sectionId}`;
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const solidHeader = scrolled || pathname !== '/';

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 after:absolute after:bottom-0 after:inset-x-0 after:h-px after:content-[''] after:bg-gradient-to-r after:from-transparent after:via-[#f4b860]/35 after:to-transparent after:opacity-0 ${
        solidHeader
          ? 'py-2 backdrop-blur-2xl bg-slate-950/88 shadow-2xl shadow-black/20 after:opacity-100'
          : 'py-3 backdrop-blur-xl bg-slate-950/30'
      }`}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            aria-label="AgentEasePro home"
            className="inline-flex rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b860]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span className="md:hidden">
              <Logo size="lg" showText={true} animated={false} />
            </span>
            <span className="hidden md:inline-flex">
              <Logo size="xl" showText={true} animated={false} />
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {headerNavItems.map((item) => {
              if (item.type === 'route') {
                const active = item.to === '/compare' && isComparePath(pathname);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`relative rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                      active
                        ? 'border-[#f4b860]/30 bg-[#f4b860]/14 text-[#f4b860] shadow-[0_0_0_1px_rgba(244,184,96,0.14)]'
                        : 'border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-[#f4b860]/25 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              }

              return (
                <a
                  key={item.sectionId}
                  href={buildSectionHref(pathname, item.sectionId)}
                  className="group relative px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                >
                  {item.label}
                  <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-[#f4b860]/0 via-[#f4b860] to-[#f4b860]/0 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              );
            })}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/book-demo"
              className="px-4 py-2 text-sm font-medium text-[#f4b860] transition-colors hover:text-amber-300"
            >
              Book a Demo
            </Link>
            <a
              href={`${EXTERNAL_LINKS.appEntry}/login`}
              className="px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              Log in
            </a>
            <a
              href={EXTERNAL_LINKS.appEntry}
              className="group relative overflow-hidden rounded-full bg-gradient-to-r from-amber-300 via-[#f4b860] to-amber-200 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(244,184,96,0.25),0_14px_35px_-18px_rgba(244,184,96,0.65)] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_0_1px_rgba(244,184,96,0.35),0_18px_45px_-18px_rgba(244,184,96,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b860]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.99]"
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-white/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
              <span className="relative">Get started</span>
            </a>
          </div>

          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl glass-hover md:hidden"
            aria-label="Toggle menu"
          >
            <svg
              className={`h-5 w-5 text-slate-300 transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        <div
          className={`overflow-hidden transition-all duration-500 ease-out md:hidden ${
            mobileMenuOpen ? 'mt-4 max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-1 rounded-2xl glass-card p-4">
            {headerNavItems.map((item) => {
              if (item.type === 'route') {
                const active = item.to === '/compare' && isComparePath(pathname);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`block rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                      active
                        ? 'border border-[#f4b860]/25 bg-[#f4b860]/10 text-[#f4b860]'
                        : 'border border-white/10 bg-white/[0.03] text-slate-200 hover:border-[#f4b860]/25 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              }

              return (
                <a
                  key={item.sectionId}
                  href={buildSectionHref(pathname, item.sectionId)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </a>
              );
            })}

            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <Link
                to="/book-demo"
                className="block rounded-xl border border-[#f4b860]/30 px-4 py-3 text-center text-sm font-medium text-[#f4b860] transition-all hover:bg-[#f4b860]/10"
              >
                Book a Demo
              </Link>
              <a
                href={`${EXTERNAL_LINKS.appEntry}/login`}
                className="block rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-medium text-slate-300 transition-all hover:bg-white/5"
              >
                Log in
              </a>
              <a
                href={EXTERNAL_LINKS.appEntry}
                className="group relative block overflow-hidden rounded-xl bg-gradient-to-r from-amber-300 via-[#f4b860] to-amber-200 px-4 py-3 text-center text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(244,184,96,0.25),0_14px_35px_-18px_rgba(244,184,96,0.65)] transition-all duration-300 active:scale-[0.99]"
              >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-white/10 to-transparent opacity-60" />
                <span className="relative">Get started</span>
              </a>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}