import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { PricingCard } from "@/components/pricing/pricing-card";
import { pricingPlans } from "@/lib/pricing/plans";

export function PricingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            aria-label="UGC Pilot home"
          >
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-small bg-brand">
              <ProductLogoMark
                className="size-7"
                imageClassName="brightness-0 invert"
                sizes="28px"
              />
            </span>
            <span className="truncate text-[15px] font-bold text-foreground-strong">
              UGC Pilot
            </span>
          </Link>

          <nav className="flex items-center gap-4 text-sm font-semibold text-muted">
            <Link
              href="/"
              className="hidden rounded-control px-2 py-1.5 transition hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:inline-flex"
            >
              Home
            </Link>
            <Link
              href="/sign-in"
              className="rounded-control bg-foreground-strong px-3 py-2 text-white transition hover:bg-deep-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <div className="px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-18 lg:px-10">
        <section className="mx-auto max-w-4xl text-center" aria-labelledby="pricing-title">
          <p className="mx-auto w-fit rounded-full border border-primary/15 bg-brand-soft px-4 py-2 text-sm font-black text-primary">
            Monthly credits
          </p>
          <h1
            id="pricing-title"
            className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-[1.02] tracking-normal text-foreground-strong sm:text-5xl lg:text-6xl"
          >
            Choose the right plan for your content workflow
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-muted sm:text-lg sm:leading-8">
            Generate UGC-style images and videos with monthly credits designed
            for different levels of usage.
          </p>
          <p className="mt-4 text-sm font-semibold leading-6 text-muted-subtle">
            All plans are billed monthly. Applicable taxes may be added at
            checkout.
          </p>
        </section>

        <section
          aria-label="Pricing plans"
          className="mx-auto mt-10 grid max-w-5xl items-stretch gap-5 md:grid-cols-2"
        >
          {pricingPlans.map((plan) => (
            <PricingCard key={plan.slug} plan={plan} />
          ))}
        </section>

        <section
          aria-labelledby="credits-title"
          className="mx-auto mt-8 max-w-5xl rounded-[var(--radius-panel)] border border-border bg-card-muted p-5 sm:p-6"
        >
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-primary">
                Credit guide
              </p>
              <h2
                id="credits-title"
                className="mt-2 text-2xl font-black leading-tight tracking-normal text-foreground-strong"
              >
                How credits work
              </h2>
            </div>
            <div className="grid gap-3 text-sm font-semibold leading-6 text-muted sm:grid-cols-2">
              <p>Image Generation Credits are used only for image creation.</p>
              <p>Video Generation Credits are used only for video creation.</p>
              <p>Credits refresh with each monthly billing cycle.</p>
              <p>Unused credits expire at the end of the billing period.</p>
            </div>
          </div>
        </section>

        <footer className="mx-auto mt-8 max-w-5xl text-center text-sm font-semibold text-muted">
          Need help choosing a plan?{" "}
          <Link
            href="/contact"
            className="font-black text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Contact support
          </Link>
          .
        </footer>
      </div>
    </main>
  );
}
