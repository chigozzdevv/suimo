import { Hero } from "./hero";
import { FeatureGrid } from "./feature-grid";
import { TheProblem } from "./the-problem";
import { HowItWorks } from "./how-it-works";
import { PreviewMarkets } from "./preview-markets";
import { CtaBand } from "./cta-band";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { SectionDivider } from "./section-divider";
import { WhySuimo } from "./why-suimo";
import { FAQ } from "./faq";

export function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="relative min-h-screen w-full overflow-hidden section-bg text-parchment">
      <SiteHeader />
      <main className="relative z-10">
        <Hero />

        <div className="container-outer py-16 md:py-20">
          <FeatureGrid />
        </div>
        <div className="container-outer py-16 md:py-20">
          <PreviewMarkets />
        </div>
        <div className="container-outer">
          <SectionDivider className="my-16 md:my-20" />
        </div>

        <div className="container-outer py-16 md:py-20">
          <TheProblem />
        </div>
        <div className="container-outer">
          <SectionDivider className="my-16 md:my-20" />
        </div>

        <div className="container-outer py-16 md:py-20">
          <WhySuimo />
        </div>
        <div className="container-outer">
          <SectionDivider className="my-16 md:my-20" />
        </div>

        <div className="container-outer py-16 md:py-20">
          <HowItWorks />
        </div>
        <div className="container-outer">
          <SectionDivider className="my-16 md:my-20" />
        </div>

        <div className="container-outer py-16 md:py-20">
          <FAQ />
        </div>
        <div className="container-outer">
          <SectionDivider className="my-16 md:my-20" />
        </div>

        <div className="container-outer py-16 md:py-20">
          <CtaBand />
        </div>
      </main>
      <SiteFooter year={year} />
    </div>
  );
}
