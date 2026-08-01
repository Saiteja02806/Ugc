import {
  CalendarSync,
  Check,
  ImageIcon,
  ShieldCheck,
  Video,
} from "lucide-react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { PricingCard } from "@/components/pricing/pricing-card";
import { PricingComparison } from "@/components/pricing/pricing-comparison";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pricingPlans } from "@/lib/pricing/plans";

const creditGuideItems = [
  {
    icon: ImageIcon,
    title: "Image credits",
    description: "Used only when an image variation is created.",
    iconClassName: "bg-brand-soft text-primary",
  },
  {
    icon: Video,
    title: "Video credits",
    description: "Used only when a video output is created.",
    iconClassName: "bg-card-muted text-muted",
  },
  {
    icon: CalendarSync,
    title: "Monthly renewal",
    description: "The plan allowance refreshes on each billing date.",
    iconClassName: "bg-success/10 text-success",
  },
];

export function PricingPage() {
  return (
    <div className="instagram-theme min-h-screen bg-background text-foreground">
      <Link
        href="#pricing-content"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:not-sr-only focus:rounded-control focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground-strong focus:ring-2 focus:ring-focus"
      >
        Skip to pricing
      </Link>
      <main className="min-h-screen">
        <header className="border-b border-border bg-background/95 px-5 py-3.5 backdrop-blur sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="UGCPilot home"
          >
            <ProductLogoMark
              className="size-9 rounded-small bg-primary p-2"
              imageClassName="brightness-0 invert"
              sizes="36px"
            />
            <span className="truncate text-[16px] font-semibold text-foreground-strong">
              UGCPilot
            </span>
          </Link>

          <nav
            aria-label="Pricing navigation"
            className="flex items-center gap-2"
          >
            <span className="hidden text-sm font-medium text-muted sm:inline">
              Already have an account?
            </span>
            <Link
              href="/sign-in"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
              })}
            >
              Sign in
            </Link>
          </nav>
        </div>
        </header>

        <section
          id="pricing-content"
          aria-labelledby="pricing-title"
          className="px-5 pb-16 pt-9 sm:px-8 sm:pt-11 lg:px-10"
          tabIndex={-1}
        >
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary">Monthly plans</Badge>
            <h1
              id="pricing-title"
              className="mt-4 text-balance text-3xl font-bold leading-tight tracking-normal text-foreground-strong sm:text-4xl"
            >
              Choose the right plan for your workflow
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm font-medium leading-6 text-muted sm:text-base">
              Generate more images and videos each month with a plan built for
              your publishing cadence.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-foreground">
              {[
                "Credits refresh monthly",
                "Commercial usage",
                "Watermark-free exports",
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check className="size-4 text-success" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div
            aria-label="Pricing plans"
            className="mt-8 grid items-stretch gap-5 md:grid-cols-2"
          >
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.slug} plan={plan} />
            ))}
          </div>
        </div>
        </section>

        <PricingComparison plans={pricingPlans} />

        <section
          aria-labelledby="credits-title"
          className="px-5 py-12 sm:px-8 lg:px-10"
        >
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
            <div className="max-w-md">
              <p className="text-xs font-bold uppercase text-primary">
                Credit guide
              </p>
              <h2
                id="credits-title"
                className="mt-3 text-2xl font-bold leading-tight tracking-normal text-foreground-strong sm:text-3xl"
              >
                How credits work
              </h2>
              <p className="mt-3 text-sm font-medium leading-6 text-muted">
                Credits stay tied to their generation type. Unused credits
                expire when the billing period ends.
              </p>
            </div>

            <div className="grid border-y border-border sm:grid-cols-3">
              {creditGuideItems.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className="border-b border-border py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-small",
                        item.iconClassName,
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-sm font-bold text-foreground-strong">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm font-medium leading-6 text-muted">
                      {item.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-5 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 size-5 shrink-0 text-success"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-foreground-strong">
                  Need help choosing?
                </p>
                <p className="mt-1 text-sm font-medium text-muted">
                  Tell us your publishing cadence and we will recommend a plan.
                </p>
              </div>
            </div>
            <Link
              href="/contact"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "w-full sm:w-auto",
              })}
            >
              Contact support
            </Link>
          </div>
        </div>
        </section>

        <footer className="border-t border-border px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 text-xs font-medium text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>UGCPilot monthly plans</span>
          <span>Prices shown in USD. Taxes may apply.</span>
        </div>
        </footer>
      </main>
    </div>
  );
}
