import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { BillingSubscription } from "@/components/billing/use-billing-subscription";
import { CreditIcon } from "@/components/icons/credit-icon";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { FREE_TRIAL_CONTENT_DAYS } from "@/lib/billing/free-trial-policy";
import { resolvePricingPlanAction } from "@/lib/pricing/plan-action";
import {
  formatPricingAmount,
  getPlanPricing,
  type BillingInterval,
  type PricingPlan,
} from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";

type PricingCardProps = {
  billingInterval: BillingInterval;
  isSubscriptionError?: boolean;
  isSubscriptionLoading: boolean;
  plan: PricingPlan;
  subscription: BillingSubscription | null;
};

export function PricingCard({
  billingInterval,
  isSubscriptionError = false,
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
  const ctaHref = `/sign-in?plan=${plan.slug}&billing=${billingInterval}`;
  const action = resolvePricingPlanAction({
    authLoading: loading,
    billingInterval,
    isSubscriptionError,
    isSubscriptionLoading,
    plan,
    signedIn: Boolean(user),
    subscription,
  });
  const ctaText = action.label;
  const isDisabled = isWorking || action.disabled;

  async function handleAction() {
    if (isDisabled) {
      return;
    }

    if (action.destination === "sign-in") {
      router.push(ctaHref);
      return;
    }

    if (action.destination === "workspace") {
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

      const endpoint = action.destination === "portal"
        ? "/api/billing/portal"
        : "/api/billing/checkout";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: action.destination === "portal"
          ? undefined
          : JSON.stringify({ billingInterval, planSlug: plan.slug }),
      });
      const data = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; error?: string; portalUrl?: string }
        | null;
      const destination = data?.portalUrl ?? data?.checkoutUrl;

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
      {/* Plan capacity badge */}
      {plan.badgeLabel ? (
        <div className="absolute -top-3 right-6 z-10">
          <span className="inline-flex items-center rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-[#1f1f1f] shadow-xs">
            {plan.badgeLabel}
          </span>
        </div>
      ) : null}

      {/* 1. Header: Plan Name & Audience */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-foreground-strong">
            {plan.name}
          </h2>
          {action.badgeLabel ? (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-medium",
                action.badgeTone === "attention"
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : action.badgeTone === "neutral"
                    ? "border-border bg-card-muted text-muted"
                    : "border-success/40 bg-success/10 text-success",
              )}
            >
              {action.badgeLabel}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs font-normal text-muted">{plan.bestFor}</p>
      </div>

      {/* 2. Price Header */}
      <div className="mt-4">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-4xl font-bold tracking-tight text-foreground-strong">
            {formatPricingAmount(pricing.monthlyEquivalent)}
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            {isFree ? `for ${FREE_TRIAL_CONTENT_DAYS} days` : "/ month"}
          </span>
        </div>
        <p className="mt-1 min-h-4 text-xs font-normal text-muted">
          {isFree
            ? `${pricing.billingSummary} · No card required`
            : pricing.savings > 0
              ? `${pricing.billingSummary} (Save ${formatPricingAmount(pricing.savings)}/yr)`
              : pricing.billingSummary}
        </p>
      </div>

      {/* 3. CTA Button (Positioned at top) */}
      <div className="mt-5">
        {action.destination !== "sign-in" ? (
          <button
            type="button"
            onClick={() => void handleAction()}
            disabled={isDisabled}
            aria-busy={isWorking || (action.disabled && !isSubscriptionError)}
            aria-label={`${ctaText} for ${plan.name} plan`}
            className={cn(
              "group flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default",
              isDisabled
                ? "border border-border bg-card-muted text-muted cursor-default"
                : isGrowth
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm"
                  : "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            {isWorking || (action.disabled && !isSubscriptionError) ? (
              <LoaderCircle
                data-icon="inline-start"
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            <span>
              {isWorking
                ? action.destination === "portal"
                  ? "Opening billing…"
                  : "Opening checkout…"
                : ctaText}
            </span>
            {!isDisabled ? (
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
              "group flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
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
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card-muted/60 px-3 py-2 text-xs font-medium text-foreground-strong">
            <CreditIcon className="size-5" />
            <span>{plan.capacityLabel}</span>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs font-normal leading-relaxed text-muted">
        {plan.description}
      </p>

      <Separator className="my-4" />

      {/* 5. Features Checklist */}
      <div className="flex flex-1 flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Included
        </p>
        <ul className="mt-3 flex flex-1 flex-col gap-2.5 text-xs">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <Check
                className="mt-0.5 size-3.5 shrink-0 text-success"
                aria-hidden="true"
              />
              <span className="font-normal text-foreground leading-snug">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-4">
          <p className="text-center text-[11px] font-normal text-muted">
            {isFree
              ? "No payment method required."
              : "Secured checkout · Cancel anytime"}
          </p>
        </div>
      </div>
    </article>
  );
}
