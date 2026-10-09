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

import { ProductLogoMark } from "@/components/brand/product-logo";
import { ONE_TIME_FREE_GENERATION_CREDITS } from "@/lib/billing/free-generation-credit-policy";
import { FREE_TRIAL_CONTENT_DAYS, FREE_TRIAL_DAILY_CONTENT_PIECES } from "@/lib/billing/free-trial-policy";
import { PricingCatalog } from "@/components/pricing/pricing-catalog";
import { PricingComparison } from "@/components/pricing/pricing-comparison";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  pricingPlans,
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
    answer: `Your ${FREE_TRIAL_CONTENT_DAYS}-day trial starts when you complete onboarding. Get ${FREE_TRIAL_DAILY_CONTENT_PIECES} daily content concepts, review and edit them, and schedule Instagram posts while the trial is active. Connect one Instagram account and connect YouTube to schedule videos. Your account also gets ${ONE_TIME_FREE_GENERATION_CREDITS} free AI Studio credits once. No payment card is required, and the trial does not automatically become a paid subscription.`,
  },
  {
    question: "What happens when my trial ends?",
    answer: "Choose Starter or Growth to keep receiving daily content and scheduling new Instagram posts. Signing in again does not restart an expired trial. Your one-time free AI credits remain available until you spend them. Choose a paid plan for a monthly AI credit allowance.",
  },
  {
    question: "Are daily content concepts separate from AI credits?",
    answer: "Yes. Daily content is your business-aware feed of hooks, Wall of Text videos and carousels. Starter includes 20 concepts per day and Growth includes 50. Your separate monthly AI credits cover custom image, video and character generation.",
  },
  {
    question: "How do UGCPilot credits work?",
    answer: `Free accounts receive ${ONE_TIME_FREE_GENERATION_CREDITS} credits once; these do not refill monthly. Starter includes 200 shared credits each month and Growth includes 600, including on annual subscriptions. Generation cost depends on the model, video duration and settings. Check the displayed credit cost before generating. If a generation costs more than your remaining credits, choose a paid plan to continue.`,
  },
  {
    question: "Which workflows and platforms are included?",
    answer: "Review daily content, make custom images and videos in AI Studio, create AI characters, and edit and schedule content from your library. Instagram scheduling is included during the free trial. YouTube channel connection and video scheduling are available on every plan after you verify your email. YouTube supports video uploads; destination options depend on the content format.",
  },
  {
    question: "How do annual billing and plan changes work?",
    answer: "Annual plans charge $190 for Starter or $490 for Growth upfront, equal to ten monthly payments. Credits still refresh monthly. Existing subscribers can open the secure Dodo billing portal to manage their plan, payment details and cancellation. Your portal shows when any change takes effect.",
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
                A workspace to review, edit and schedule it all.
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
                From the first idea to the scheduled post
              </h2>
              <p className="mt-2 text-sm font-normal text-muted">
                Try daily content for {FREE_TRIAL_CONTENT_DAYS} days and AI Studio with {ONE_TIME_FREE_GENERATION_CREDITS} free credits. Choose a paid plan for more capacity.
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
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4.5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-3 text-base font-semibold leading-snug text-foreground-strong">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs font-normal leading-relaxed text-muted">
                      {item.description}
                    </p>
                    <p className="mt-auto pt-4 text-[11px] font-medium leading-relaxed text-primary">{item.access}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Feature Comparison Matrix */}
        <PricingComparison plans={pricingPlans} />

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
            <span>— Your content workspace</span>
          </div>
          <span>Prices in USD; applicable taxes shown at checkout. Billing by Dodo Payments.</span>
        </div>
      </footer>
    </div>
  );
}
