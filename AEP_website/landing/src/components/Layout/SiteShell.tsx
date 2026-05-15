import { Hero } from '../sections/Hero';
import { ProblemSolution } from '../sections/ProblemSolution';
import { FeaturesGrid } from '../sections/FeaturesGrid';
import { CompetitiveComparison } from '../sections/CompetitiveComparison';
import { HowItWorks } from '../sections/HowItWorks';
import { Testimonials } from '../sections/Testimonials';
import { ForUtahAgents } from '../sections/ForUtahAgents';
import { Pricing } from '../sections/Pricing';
import { TrustBadges } from '../sections/TrustBadges';
import { CTA } from '../sections/CTA';
import { Footer } from '../sections/Footer';
import { SiteHeader } from './SiteHeader';

export function SiteShell() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-gradient-radial from-slate-500/10 via-slate-600/5 to-transparent blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-gradient-radial from-amber-500/15 via-[#f4b860]/10 to-transparent blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-conic from-slate-500/3 via-amber-500/5 to-slate-500/3 blur-3xl"></div>
      </div>

      <SiteHeader />

      {/* Main content */}
      <main className="relative pt-20 md:pt-24 lg:pt-28">
        <Hero />
        <ProblemSolution />
        <FeaturesGrid />
        <CompetitiveComparison />
        <HowItWorks />
        <Testimonials />
        <ForUtahAgents />
        <Pricing />
        <CTA />
        <TrustBadges />
      </main>

      <Footer />
    </div>
  );
}
