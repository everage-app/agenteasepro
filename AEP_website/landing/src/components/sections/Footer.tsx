import { Logo } from '../ui/Logo';
import { Link } from 'react-router-dom';
import { EXTERNAL_LINKS } from '../../config/externalLinks';

type ProductLink =
  | { href: string; label: string }
  | { to: string; label: string };

export function Footer() {
  const currentYear = new Date().getFullYear();
  const productLinks: ProductLink[] = [
    { href: '#services', label: 'Features' },
    { href: '#workflows', label: 'Workflows' },
    { href: '#pricing', label: 'Pricing' },
    { to: '/compare', label: 'Compare' },
    { href: '#utah', label: 'For Utah Agents' },
    { to: '/faq', label: 'FAQs' },
  ];

  return (
    <footer className="relative py-12 md:py-14 border-t border-white/[0.08]">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid md:grid-cols-4 gap-8 md:gap-10 mb-8 md:mb-10">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <div className="mb-5">
              <Logo size="lg" showText={true} />
            </div>
            <p className="text-slate-400 leading-relaxed max-w-md mb-5 text-sm md:text-base">
              The all-in-one workspace for Utah real estate agents. Draft REPCs, track deadlines, manage clients, and launch marketing from one beautiful interface.
            </p>
            <div className="flex items-center gap-4">
              <a 
                href="mailto:sales@agenteasepro.com" 
                className="w-10 h-10 rounded-xl glass-hover flex items-center justify-center text-slate-400 hover:text-[#f4b860] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={'to' in link ? link.to : link.href}>
                  {'to' in link ? (
                    <Link to={link.to} className="text-slate-400 text-sm md:text-base hover:text-[#f4b860] transition-colors flex items-center gap-2 group">
                      <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-[#f4b860] transition-colors"></span>
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="text-slate-400 text-sm md:text-base hover:text-[#f4b860] transition-colors flex items-center gap-2 group">
                      <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-[#f4b860] transition-colors"></span>
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/book-demo" className="text-slate-400 text-sm md:text-base hover:text-[#f4b860] transition-colors flex items-center gap-2 group">
                  <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-[#f4b860] transition-colors"></span>
                  Book a Demo
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-400 text-sm md:text-base hover:text-[#f4b860] transition-colors flex items-center gap-2 group">
                  <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-[#f4b860] transition-colors"></span>
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="mailto:sales@agenteasepro.com"
                  className="text-slate-400 text-sm md:text-base hover:text-[#f4b860] transition-colors flex items-center gap-2 group"
                >
                  <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-[#f4b860] transition-colors"></span>
                  sales@agenteasepro.com
                </a>
              </li>
              <li>
                <a
                  href={EXTERNAL_LINKS.appEntry}
                  className="text-slate-400 text-sm md:text-base hover:text-[#f4b860] transition-colors flex items-center gap-2 group"
                >
                  <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-[#f4b860] transition-colors"></span>
                  Launch App
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {currentYear} AgentEasePro. All rights reserved.
          </p>
          <div className="flex gap-8">
            <Link to="/terms-of-service" className="text-sm text-slate-500 hover:text-[#f4b860] transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy-policy" className="text-sm text-slate-500 hover:text-[#f4b860] transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
