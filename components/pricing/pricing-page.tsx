"use client";

import {
  CalendarClock,
  ChevronDown,
  Compass,
  Flame,
  HelpCircle,
  Layers3,
} from "lucide-react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { PricingCatalog } from "@/components/pricing/pricing-catalog";
import { PricingComparison } from "@/components/pricing/pricing-comparison";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  pricingPlans,
  type BillingInterval,
} from "@/lib/pricing/plans";

const platformFeatures = [
  {
    icon: Flame,
    title: "Daily Viral Formats",
    description:
      "Fresh Reel hooks, Wall-of-text videos, and swipeable carousels engineered from proven high-engagement Instagram patterns.",
  },
  {
    icon: Layers3,
    title: "AI Creative Studio",
    description:
      "Turn your product features, screens, and value propositions into custom AI image assets and presenter avatar clips.",
  },
  {
    icon: CalendarClock,
    title: "1-Click Auto-Publishing",
    description:
      "Connect your Instagram Professional accounts, inspect copy and visuals with 100% human control, and schedule instantly.",
  },
];

const faqs = [
  {
    question: "How does UGCPilot automate my Instagram marketing?",
    answer:
      "UGCPilot analyzes your product, screenshots, and value proposition to generate daily ready-to-post content in proven viral Instagram formats (Reel hooks, Wall-of-text videos, and multi-slide carousels). You simply review, tweak if needed, and schedule in seconds so you can focus on building.",
  },
  {
    question: "What is the daily ready-to-post replenishment limit?",
    answer:
      "Every single day, UGCPilot automatically delivers fresh creative ideas tailored to your business profile. Starter delivers 20 ready-to-post drops daily, while Growth delivers 50 drops daily.",
  },
  {
    question: "How do shared AI generation credits work?",
    answer:
      "In addition to your daily ready-to-post content drops, credits give you extra flexibility for generating custom AI images and avatar presenter videos in AI Studio. Credits refresh every month on both monthly and annual plans.",
  },
  {
    question: "How many Instagram accounts can I connect?",
    answer:
      "Free allows 1 connected Instagram Professional account. Starter unlocks up to 3 connected accounts, while Growth supports up to 5 for managing and auto-publishing across multiple brands.",
  },
  {
    question: "Can I upgrade, downgrade, or cancel anytime?",
    answer:
      "Yes. Paid customers can open the secure billing portal from Settings to change plans, update payment details, or cancel immediately or at the next billing date.",
  },
  {
    question: "Is there any credit card required for the Free plan?",
    answer:
      "No credit card is required. You can sign up with email or Google to explore trending formats, browse daily hooks, and preview ready-to-post concepts completely free.",
  },
];

type PricingPageProps = {
  initialBillingInterval: BillingInterval;
};

export function PricingPage({ initialBillingInterval }: PricingPageProps) {
  const { user, loading } = useAuth();

  return (
    <div className="instagram-theme min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-foreground-strong">
      <Link
        href="#pricing-content"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:not-sr-only focus:rounded-control focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground-strong focus:ring-2 focus:ring-focus"
      >
        Skip to pricing
      </Link>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 px-5 py-3.5 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2.5 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="UGCPilot home"
          >
            <ProductLogoMark
              className="size-8 rounded-xl bg-primary p-1.5 shadow-xs"
              imageClassName="brightness-0 invert"
              sizes="32px"
            />
            <span className="truncate text-base font-semibold tracking-tight text-foreground-strong">
              UGCPilot
            </span>
          </Link>

          <nav aria-label="Pricing navigation" className="flex items-center gap-3">
            {!loading && user ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-xs font-medium text-muted sm:inline">
                  {user.displayName || user.email?.split("@")[0] || "Logged in"}
                </span>
                <Link
                  href="/dashboard"
                  className={buttonVariants({
                    variant: "default",
                    size: "sm",
                    className: "h-8 rounded-lg text-xs font-semibold shadow-xs",
                  })}
                >
                  <Compass className="size-3.5" data-icon="inline-start" aria-hidden="true" />
                  <span>Open workspace</span>
                </Link>
              </div>
            ) : (
              <>
                <span className="hidden text-xs font-medium text-muted sm:inline">
                  Already have an account?
                </span>
                <Link
                  href="/sign-in"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "h-8 rounded-lg text-xs font-semibold",
                  })}
                >
                  Sign in
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="relative">
        {/* Hero Section */}
        <section
          id="pricing-content"
          aria-labelledby="pricing-title"
          className="px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:px-10"
          tabIndex={-1}
        >
          <div className="mx-auto max-w-5xl">
            {/* Hero Header */}
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-foreground shadow-sm">
                <span className="text-primary font-semibold">Marketing on Autopilot</span>
                <span className="text-border-strong">•</span>
                <span className="text-muted font-normal">For Builders</span>
              </div>
              <h1
                id="pricing-title"
                className="text-balance text-3xl font-semibold leading-tight tracking-[-0.045em] text-foreground-strong sm:text-4xl lg:text-[44px]"
              >
                Focus on building.
                <span className="block mt-1">Put your Instagram marketing on autopilot.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-sm font-normal leading-relaxed text-muted sm:text-base">
                Turn your product features, screens, and value prop into daily ready-to-post Reel hooks,
                Wall-of-text videos, and swipeable carousels.
              </p>
            </div>

            {/* Pricing Cards Catalog */}
            <PricingCatalog initialBillingInterval={initialBillingInterval} />
          </div>
        </section>

        {/* Feature Comparison Matrix */}
        <PricingComparison plans={pricingPlans} />

        {/* 3-Card Platform Features */}
        <section
          aria-labelledby="features-title"
          className="border-b border-border bg-card-muted/20 px-5 py-14 sm:px-8 lg:px-10 lg:py-16"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Complete Platform
              </p>
              <h2
                id="features-title"
                className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-3xl"
              >
                Everything you need to grow on Instagram
              </h2>
              <p className="mt-2 text-sm font-normal text-muted">
                Every plan includes our complete creative engine. Scale capacity as you grow.
              </p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {platformFeatures.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-border-strong"
                  >
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4.5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-3 text-base font-semibold leading-snug text-foreground-strong">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs font-normal leading-relaxed text-muted">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Grouped Accordion FAQ Section */}
        <section
          aria-labelledby="faq-title"
          className="bg-card-muted/40 px-5 py-14 sm:px-8 lg:px-10 lg:py-18"
        >
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-xs">
                <HelpCircle className="size-3.5 text-primary" aria-hidden="true" />
                <span>Got Questions?</span>
              </div>
              <h2
                id="faq-title"
                className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-3xl"
              >
                Frequently asked questions
              </h2>
              <p className="mt-2 text-sm font-normal text-muted">
                Everything you need to know about plans, AI credits, and automated scheduling.
              </p>
            </div>

            <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card p-1 shadow-xs">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group p-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-card-muted/40"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-foreground-strong [&::-webkit-details-marker]:hidden sm:text-base">
                    <span>{faq.question}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-xs font-normal leading-relaxed text-muted sm:text-sm">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 text-xs font-normal text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ProductLogoMark className="size-4.5 rounded-md bg-primary p-1" imageClassName="brightness-0 invert" sizes="18px" />
            <span className="font-semibold text-foreground-strong">UGCPilot</span>
            <span>— Instagram Marketing on Autopilot</span>
          </div>
          <span>Prices shown in USD. Secured by Dodo Payments.</span>
        </div>
      </footer>
    </div>
  );
}
