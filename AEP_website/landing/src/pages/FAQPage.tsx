import { SiteHeader } from '../components/Layout/SiteHeader';
import { Footer } from '../components/sections/Footer';
import { FAQ } from '../components/sections/FAQ';

export function FAQPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-gradient-radial from-slate-500/10 via-slate-600/5 to-transparent blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-gradient-radial from-amber-500/15 via-[#f4b860]/10 to-transparent blur-3xl"></div>
      </div>

      <SiteHeader />

      <main className="relative pt-20 md:pt-24 lg:pt-28">
        <FAQ />
      </main>

      <Footer />
    </div>
  );
}
