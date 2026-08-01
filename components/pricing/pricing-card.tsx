import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Gauge,
} from "lucide-react";
import Link from "next/link";

import { PricingCreditSummary } from "@/components/pricing/pricing-credit-summary";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  formatPricingAmount,
  type PricingPlan,
} from "@/lib/pricing/plans";

type PricingCardProps = {
  plan: PricingPlan;
};

export function PricingCard({ plan }: PricingCardProps) {
  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-card border bg-card shadow-card",
        plan.highlighted
          ? "border-primary/55 shadow-[0_18px_48px_rgb(0_0_0_/_0.24)]"
          : "border-border",
      )}
    >
      <div className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex min-h-6 items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase text-muted">
            {plan.bestFor}
          </p>
          {plan.badgeLabel ? (
            <Badge variant="secondary">
              <BadgeCheck data-icon="inline-start" aria-hidden="true" />
              {plan.badgeLabel}
            </Badge>
          ) : null}
        </div>

        <div className="mt-5">
          <h2 className="text-2xl font-bold leading-none tracking-normal text-foreground-strong">
            {plan.name}
          </h2>
          <p className="mt-3 max-w-md text-sm font-medium leading-6 text-muted">
            {plan.description}
          </p>
        </div>

        <div className="mt-6 flex items-end gap-2">
          <span className="text-4xl font-bold leading-none tracking-normal text-foreground-strong sm:text-5xl">
            {formatPricingAmount(plan.monthlyPrice)}
          </span>
          <span className="pb-1.5 text-sm font-semibold text-muted">
            {plan.billingText}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gauge className="size-4 text-primary" aria-hidden="true" />
          <span>{plan.capacityLabel}</span>
        </div>

        <div className="mt-6">
          <p className="text-xs font-bold uppercase text-muted">
            Monthly production allowance
          </p>
          <div className="mt-2 border-y border-border">
            <PricingCreditSummary
              amount={plan.imageCredits}
              kind="image"
            />
            <Separator />
            <PricingCreditSummary
              amount={plan.videoCredits}
              kind="video"
            />
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/sign-in"
            aria-label={`${plan.buttonLabel}, ${formatPricingAmount(plan.monthlyPrice)} per month`}
            className={buttonVariants({
              variant: plan.highlighted ? "default" : "outline",
              size: "lg",
              className: "h-11 w-full text-sm font-semibold",
            })}
          >
            {plan.buttonLabel}
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
          <p className="mt-2.5 text-center text-xs font-medium text-muted-subtle">
            Sign in to continue to checkout
          </p>
        </div>

        <Separator className="my-6" />

        <ul className="grid gap-3">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex gap-3 text-sm font-semibold leading-6 text-foreground"
            >
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-hidden="true"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <p className="mt-auto pt-6 text-xs font-medium leading-5 text-muted-subtle">
          Billed monthly. Applicable taxes may be added at checkout.
        </p>
      </div>
    </article>
  );
}
