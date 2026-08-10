import {
  ArrowRight,
  BadgeCheck,
  Gauge,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatPricingAmount,
  getPlanPricing,
  type BillingInterval,
  type PricingPlan,
} from "@/lib/pricing/plans";

type PricingCardProps = {
  billingInterval: BillingInterval;
  plan: PricingPlan;
};

export function PricingCard({ billingInterval, plan }: PricingCardProps) {
  const pricing = getPlanPricing(plan, billingInterval);
  const intervalLabel = billingInterval === "monthly" ? "monthly" : "yearly";

  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-card border bg-card shadow-card",
        plan.highlighted
          ? "border-primary/55 ring-1 ring-primary/10"
          : "border-border",
      )}
    >
      <div className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex min-h-6 items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase text-foreground">
            {plan.bestFor}
          </p>
          {plan.badgeLabel ? (
            <Badge variant="secondary">
              <BadgeCheck data-icon="inline-start" aria-hidden="true" />
              {plan.badgeLabel}
            </Badge>
          ) : null}
        </div>

        <div className="mt-4 min-h-24">
          <h2 className="text-2xl font-bold leading-none tracking-normal text-foreground-strong">
            {plan.name}
          </h2>
          <p className="mt-3 max-w-md text-sm font-medium leading-6 text-muted">
            {plan.description}
          </p>
        </div>

        <div className="mt-5 min-h-20">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold leading-none tracking-normal text-foreground-strong sm:text-5xl">
              {formatPricingAmount(pricing.monthlyEquivalent)}
            </span>
            <span className="pb-1 text-sm font-semibold text-muted">
              / month
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-muted">
            {pricing.billingSummary}
            {pricing.savings > 0
              ? ` - save ${formatPricingAmount(pricing.savings)} per year`
              : null}
          </p>
        </div>

        <div className="mt-5 rounded-small border border-border bg-card-muted p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-small bg-brand-soft text-primary">
                <Gauge className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground-strong">
                  Shared generation credits
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-muted">
                  Use one balance across image and short-video generation.
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xl font-semibold tabular-nums text-foreground-strong">
                {plan.sharedMonthlyCredits}
              </p>
              <p className="text-xs font-semibold text-muted">per month</p>
            </div>
          </div>
          <p className="mt-3 border-t border-border pt-3 text-xs font-semibold text-foreground">
            {plan.capacityLabel}
          </p>
        </div>

        <div className="mt-auto pt-5">
          <Link
            href="/sign-in"
            aria-label={`Sign in to choose ${plan.name}, ${pricing.billingSummary.toLowerCase()}`}
            className={buttonVariants({
              variant: plan.highlighted ? "default" : "outline",
              size: "lg",
              className: "h-11 w-full text-sm font-semibold",
            })}
          >
            Choose {plan.name}
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
          <p className="mt-2.5 text-center text-xs font-medium text-muted">
            Sign in is required before plan activation.
          </p>
          <p className="mt-3 text-center text-xs font-medium leading-5 text-muted-subtle">
            Prices are in USD. Taxes may apply to the {intervalLabel} charge.
          </p>
        </div>
      </div>
    </article>
  );
}
