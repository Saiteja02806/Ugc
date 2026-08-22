import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { BillingSubscription } from "@/components/billing/use-billing-subscription";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  formatPricingAmount,
  getPlanPricing,
  type BillingInterval,
  type PricingPlan,
} from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";

type PricingCardProps = {
  billingInterval: BillingInterval;
  isSubscriptionLoading: boolean;
  plan: PricingPlan;
  subscription: BillingSubscription | null;
};

export function PricingCard({
  billingInterval,
  isSubscriptionLoading,
  plan,
  subscription,
}: PricingCardProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pricing = getPlanPricing(plan, billingInterval);
  const isFree = plan.slug === "free";
  const isGrowth = plan.highlighted;
  const currentPlanSlug = subscription?.planKey ?? (user ? "free" : null);
  const isCurrentPlan = Boolean(
    user &&
      (subscription?.isActive
        ? currentPlanSlug === plan.slug
        : plan.slug === "free"),
  );
  const hasManagedSubscription = Boolean(
    subscription && subscription.status !== "free",
  );
  const ctaHref = `/sign-in?plan=${plan.slug}&billing=${billingInterval}`;
  const ctaText = getCtaText({
    hasPaidSubscription: hasManagedSubscription,
    isCurrentPlan,
    isFree,
    isSubscriptionLoading,
    planName: plan.name,
    signedIn: Boolean(user),
  });

  async function handleAction() {
    if (!user) {
      router.push(ctaHref);
      return;
    }

    if (isSubscriptionLoading) {
      return;
    }

    if (isFree && !hasManagedSubscription) {
      router.push("/dashboard");
      return;
    }

    setIsWorking(true);
    setActionError(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in again before continuing to billing.");
      }

      const endpoint = hasManagedSubscription
        ? "/api/billing/portal"
        : "/api/billing/checkout";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: hasManagedSubscription
          ? undefined
          : JSON.stringify({ billingInterval, planSlug: plan.slug }),
      });
      const data = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; error?: string; portalUrl?: string }
        | null;
      const destination = hasManagedSubscription
        ? data?.portalUrl
        : data?.checkoutUrl;

      if (!response.ok || !destination) {
        throw new Error(data?.error || "Could not open secure billing.");
      }

      window.location.assign(destination);
    } catch (error) {
      setIsWorking(false);
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not open secure billing. Try again.",
      );
    }
  }

  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all duration-200",
        isGrowth
          ? "border-primary shadow-md md:-translate-y-2"
          : "border-border hover:border-border-strong hover:shadow-md",
      )}
    >
      {/* Most Popular Pill with Gradient */}
      {plan.badgeLabel ? (
        <div className="absolute -top-3 right-6 z-10">
          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-orange-500 via-rose-500 to-primary px-3 py-0.5 text-[11px] font-bold text-white shadow-xs">
            {plan.badgeLabel}
          </span>
        </div>
      ) : null}

      {/* 1. Header: Plan Name & Audience */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground-strong">
            {plan.name}
          </h2>
          {isCurrentPlan ? (
            <Badge
              variant="outline"
              className="border-success/40 bg-success/10 text-xs font-semibold text-success"
            >
              Current plan
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted font-medium">{plan.bestFor}</p>
      </div>

      {/* 2. Price Header */}
      <div className="mt-4">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-4xl font-bold tracking-tight text-foreground-strong">
            {formatPricingAmount(pricing.monthlyEquivalent)}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            / month
          </span>
        </div>
        <p className="mt-1 min-h-4 text-xs text-muted">
          {isFree
            ? "Free forever · No card required"
            : pricing.savings > 0
              ? `${pricing.billingSummary} (Save ${formatPricingAmount(pricing.savings)}/yr)`
              : pricing.billingSummary}
        </p>
      </div>

      {/* 3. CTA Button (Positioned at top) */}
      <div className="mt-5">
        {!loading && user ? (
          <button
            type="button"
            onClick={() => void handleAction()}
            disabled={isWorking || isSubscriptionLoading || isCurrentPlan}
            aria-label={`${ctaText} for ${plan.name} plan`}
            className={cn(
              "group flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer",
              isCurrentPlan
                ? "border border-border bg-card-muted text-muted cursor-default"
                : isGrowth
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm"
                  : "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            {isWorking || isSubscriptionLoading ? (
              <LoaderCircle
                data-icon="inline-start"
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            <span>{isWorking ? "Opening checkout…" : ctaText}</span>
            {!isWorking && !isSubscriptionLoading && !isCurrentPlan ? (
              <ArrowRight
                data-icon="inline-end"
                className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            ) : null}
          </button>
        ) : (
          <Link
            href={ctaHref}
            aria-label={`${ctaText} for ${plan.name} plan`}
            className={cn(
              "group flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150",
              isGrowth
                ? "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm"
                : "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            <span>{ctaText}</span>
            <ArrowRight
              data-icon="inline-end"
              className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        )}

        {actionError ? (
          <p className="mt-2 text-center text-xs font-medium text-destructive" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>

      {/* 4. Deliverable Callout Pill */}
      {plan.capacityLabel ? (
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card-muted/60 px-3 py-2 text-xs font-semibold text-foreground-strong">
            <span>{plan.capacityLabel}</span>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {plan.description}
      </p>

      <Separator className="my-4" />

      {/* 5. Features Checklist */}
      <div className="flex flex-1 flex-col">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Included
        </p>
        <ul className="mt-3 flex flex-1 flex-col gap-2.5 text-xs">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <Check
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="font-medium text-foreground leading-snug">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-4">
          <p className="text-center text-[11px] text-muted">
            {isFree
              ? "No payment method required."
              : "Secured checkout · Cancel anytime"}
          </p>
        </div>
      </div>
    </article>
  );
}

function getCtaText(params: {
  hasPaidSubscription: boolean;
  isCurrentPlan: boolean;
  isFree: boolean;
  isSubscriptionLoading: boolean;
  planName: string;
  signedIn: boolean;
}) {
  if (params.isSubscriptionLoading && params.signedIn) {
    return "Checking plan…";
  }

  if (params.hasPaidSubscription) {
    if (params.isFree) {
      return "Manage billing";
    }

    return params.isCurrentPlan ? "Manage current plan" : "Change plan";
  }

  if (params.isFree) {
    return params.signedIn ? "Go to dashboard" : "Start for free";
  }

  return `Get ${params.planName}`;
}
