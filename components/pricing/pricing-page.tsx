import {
  BarChart3,
  Layers3,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { PricingCatalog } from "@/components/pricing/pricing-catalog";
import { PricingComparison } from "@/components/pricing/pricing-comparison";
import { buttonVariants } from "@/components/ui/button";
import {
  pricingPlans,
  type BillingInterval,
} from "@/lib/pricing/plans";

const workflowItems = [
  {
    icon: Layers3,
    label: "Discover formats",
  },
  {
    icon: SlidersHorizontal,
    label: "Create and edit",
  },
  {
    icon: RefreshCw,
    label: "Schedule content",
  },
  {
    icon: BarChart3,
    label: "Review performance",
  },
];

type PricingPageProps = {
  initialBillingInterval: BillingInterval;
};

export function PricingPage({ initialBillingInterval }: PricingPageProps) {
  return (
    <div className="instagram-theme min-h-screen bg-background text-foreground">
      <Link
        href="#pricing-content"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:not-sr-only focus:rounded-control focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground-strong focus:ring-2 focus:ring-focus"
      >
        Skip to pricing
      </Link>

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

          <nav aria-label="Pricing navigation" className="flex items-center gap-2">
            <span className="hidden text-sm font-medium text-muted sm:inline">
              Already have an account?
            </span>
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section
          id="pricing-content"
          aria-labelledby="pricing-title"
          className="px-5 pb-14 pt-9 sm:px-8 sm:pt-11 lg:px-10"
          tabIndex={-1}
        >
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase text-foreground">
                Simple pricing
              </p>
              <h1
                id="pricing-title"
                className="mt-3 text-balance text-3xl font-bold leading-tight tracking-normal text-foreground-strong sm:text-4xl"
              >
                Turn content ideas into published posts
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-sm font-medium leading-6 text-muted sm:text-base">
                Every plan includes UGCPilot&apos;s complete workflow. Choose
                how much monthly generation capacity you need and how often
                you want to pay.
              </p>
            </div>

            <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4 sm:grid-cols-4">
              {workflowItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-center gap-2 text-xs font-semibold text-foreground sm:text-sm"
                  >
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>

            <PricingCatalog initialBillingInterval={initialBillingInterval} />
          </div>
        </section>

        <PricingComparison plans={pricingPlans} />

        <section
          aria-labelledby="credits-title"
          className="px-5 py-10 sm:px-8 lg:px-10 lg:py-12"
        >
          <div className="mx-auto grid max-w-5xl gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <div className="max-w-md">
              <p className="text-xs font-bold uppercase text-foreground">
                Usage model
              </p>
              <h2
                id="credits-title"
                className="mt-2 text-2xl font-bold leading-tight tracking-normal text-foreground-strong sm:text-3xl"
              >
                One balance for generation
              </h2>
              <p className="mt-3 text-sm font-medium leading-6 text-muted">
                Image and short-video generation draw from the same monthly
                credit balance, so you can use the plan around your actual
                content mix.
              </p>
            </div>

            <dl className="divide-y divide-border border-y border-border">
              <div className="grid gap-1 py-4 sm:grid-cols-[0.55fr_1fr] sm:gap-6">
                <dt className="text-sm font-bold text-foreground-strong">
                  Monthly refresh
                </dt>
                <dd className="text-sm font-medium leading-6 text-muted">
                  Credits refresh every month, including on annual plans.
                </dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[0.55fr_1fr] sm:gap-6">
                <dt className="text-sm font-bold text-foreground-strong">
                  Usage by output
                </dt>
                <dd className="text-sm font-medium leading-6 text-muted">
                  Credit cost varies by generation type and model. Video uses
                  more credits than an image.
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 text-xs font-medium text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>UGCPilot Creator and Pro plans</span>
          <span>Prices shown in USD. Taxes may apply.</span>
        </div>
      </footer>
    </div>
  );
}
