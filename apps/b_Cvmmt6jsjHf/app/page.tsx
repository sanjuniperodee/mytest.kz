import { PromoBar } from "@/components/landing/promo-bar"
import { SiteHeader } from "@/components/landing/site-header"
import { Hero } from "@/components/landing/hero"
import { TrustBar } from "@/components/landing/trust-bar"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Subjects } from "@/components/landing/subjects"
import { Features } from "@/components/landing/features"
import { Testimonials } from "@/components/landing/testimonials"
import { Pricing } from "@/components/landing/pricing"
import { FAQ } from "@/components/landing/faq"
import { CTA } from "@/components/landing/cta"
import { SiteFooter } from "@/components/landing/site-footer"

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PromoBar />
      <SiteHeader />
      <Hero />
      <TrustBar />
      <HowItWorks />
      <Subjects />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
      <SiteFooter />
    </main>
  )
}
