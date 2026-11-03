"use client";

import {
  CalendarClock,
  ChevronDown,
  Compass,
  Flame,
  HelpCircle,
  Layers3,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { ProductLogoMark, ProductWordmark } from "@/components/brand/product-logo";
import { FREE_TRIAL_CONTENT_DAYS, FREE_TRIAL_DAILY_CONTENT_PIECES } from "@/lib/billing/free-trial-policy";
import { PricingCatalog } from "@/components/pricing/pricing-catalog";
import { PricingComparison } from "@/components/pricing/pricing-comparison";
import { buttonVariants } from "@/components/ui/button";
import styles from "./pricing-page.module.css";
import { useAuth } from "@/contexts/auth-context";
import {
  displayedPricingPlans,
  pricingWorkflows,
  type BillingInterval,
} from "@/lib/pricing/plans";


const platformFeatures = pricingWorkflows.map((workflow, index) => ({
  ...workflow,
  icon: [Flame, Layers3, UserRound, CalendarClock][index],
}));

const faqs = [
  {
    question: "What does the free trial include?",
    answer: `Your ${FREE_TRIAL_CONTENT_DAYS}-day trial starts when you complete onboarding. Get ${FREE_TRIAL_DAILY_CONTENT_PIECES} daily slideshow concepts in Trending to review and edit. Hooks and text-led videos are separate Explore workflows. Connect one Instagram account and connect TikTok and YouTube after email verification. The trial does not include AI credits. No payment card is required, and the trial does not automatically become a paid subscription.`,
  },
  {
    question: "What happens when my trial ends?",
    answer: "Choose Starter, Growth, or Startup to keep receiving daily content. Signing in again does not restart an expired trial. A paid plan adds a monthly AI credit allowance.",
  },
  {
    question: "Are daily content concepts separate from AI credits?",
    answer: "Yes. Trending currently provides slideshow concepts based on your business context. Review the content before you keep it. These allowances are separate from custom image, video and character generation, which uses AI credits. Hook and Text on screen creation happens separately in Explore. A daily concept is not an additional custom AI video generation.",
  },
  {
    question: "How do Vidmake credits work?",
    answer: `Free accounts do not include AI credits. Starter includes 360 credits each month, Growth includes 720, and Startup includes 1,800, including on annual subscriptions. One second of video costs 4 credits, so those allowances make 30, 60, or 150 three-second hooks, or 15, 30, or 75 six-second videos. Check the displayed credit cost before generating.`,
  },
  {
    question: "Which workflows and platforms are included?",
    answer: "Review daily slideshows in Trending, create hooks, text-led videos and slideshows in Explore, and make custom images, videos and character images with AI credits. Connect Instagram, TikTok and YouTube; verify your email before connecting TikTok or YouTube. Instagram requires a professional account. YouTube supports video uploads; TikTok supports eligible videos and photo posts. Review the finished asset and download the version you approve.",
  },
  {
    question: "How do annual billing and plan changes work?",
    answer: "Annual plans charge $290 for Starter, $490 for Growth, or $999 for Startup upfront. Credits still refresh monthly. Existing subscribers can open the secure Dodo billing portal to manage their plan, payment details and cancellation. Your portal shows when any change takes effect.",
  },
];

type PricingPageProps = {
  initialBillingInterval: BillingInterval;
};

export function PricingPage({ initialBillingInterval }: PricingPageProps) {
  const { user, loading } = useAuth();

  return (
    <div className={`${styles.page} instagram-theme min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-foreground-strong`}>
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
            aria-label="Vidmake home"
          >
            <ProductLogoMark className="size-8" sizes="32px" />
            <ProductWordmark className="truncate text-[18px] text-foreground-strong" />
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
                    variant: "neutral",
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
                <span className="text-primary font-semibold">Plans for your content workflow</span>
                <span className="text-border-strong">•</span>
                <span className="text-muted font-normal">Made for your brand</span>
              </div>
              <h1
                id="pricing-title"
                className="text-balance text-3xl font-semibold leading-tight tracking-[-0.045em] text-foreground-strong sm:text-4xl lg:text-[44px]"
              >
                Your next post
                <span className="mt-1 block">starts here.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-sm font-normal leading-relaxed text-muted sm:text-base">
                Daily ideas for your brand. Custom AI images and videos.
                A workspace to review, edit and keep the finished asset.
              </p>
            </div>

            {/* Pricing Cards Catalog */}
            <PricingCatalog initialBillingInterval={initialBillingInterval} />
          </div>
        </section>

        {/* Product workflows */}
        <section
          aria-labelledby="features-title"
          className="border-b border-border bg-card-muted/20 px-5 py-14 sm:px-8 lg:px-10 lg:py-16"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Your workflows
              </p>
              <h2
                id="features-title"
                className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-3xl"
              >
                From the first idea to a finished asset
              </h2>
              <p className="mt-2 text-sm font-normal text-muted">
                Try daily slideshows for {FREE_TRIAL_CONTENT_DAYS} days. Free accounts do not include AI credits. Daily content allowances and custom AI credits are separate.
              </p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {platformFeatures.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-border-strong"
                  >
                    <div className="flex size-9 items-center justify-center rounded-xl bg-card-muted text-muted">
                      <Icon className="size-4.5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-3 text-base font-semibold leading-snug text-foreground-strong">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs font-normal leading-relaxed text-muted">
                      {item.description}
                    </p>
                    <p className="mt-auto pt-4 text-[11px] font-medium leading-relaxed text-muted">{item.access}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Feature Comparison Matrix */}
        <PricingComparison plans={displayedPricingPlans} />

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
                Understand daily slideshows, AI credits, and what happens after review.
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
            <ProductLogoMark className="size-5" sizes="20px" />
            <span className="font-semibold text-foreground-strong">Vidmake</span>
            <span>— Your content workspace</span>
          </div>
          <span>Prices in USD; applicable taxes shown at checkout. Billing by Dodo Payments.</span>
        </div>
      </footer>
    </div>
  );
}
