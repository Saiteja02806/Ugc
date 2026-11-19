import type { BillingSubscription } from "@/components/billing/use-billing-subscription";
import type { BillingInterval, PricingPlan } from "@/lib/pricing/plans";

export type SubscriptionForPricing = Pick<
  BillingSubscription,
  "accessSource" | "billingInterval" | "isActive" | "isDodoManaged" | "planKey" | "status"
> & { trial: Pick<BillingSubscription["trial"], "status"> };
export type PricingSubscription = SubscriptionForPricing;

export type PricingPlanAction = {
  badgeLabel: string | null;
  badgeTone: "attention" | "neutral" | "success";
  destination: "checkout" | "none" | "portal" | "sign-in" | "workspace";
  disabled: boolean;
  label: string;
};

export function resolvePricingPlanAction(params: {
  authLoading?: boolean;
  billingInterval: BillingInterval;
  isSubscriptionError?: boolean;
  isSubscriptionLoading: boolean;
  plan: Pick<PricingPlan, "name" | "slug">;
  signedIn: boolean;
  subscription: SubscriptionForPricing | null;
}): PricingPlanAction {
  const { plan, signedIn, subscription } = params;
  const base = { badgeLabel: null, badgeTone: "success" } as const;

  if (params.authLoading) {
    return { ...base, destination: "none", disabled: true, label: "Checking account…" };
  }

  if (!signedIn) {
    return {
      ...base,
      destination: "sign-in",
      disabled: false,
      label: plan.slug === "free" ? "Start free" : `Get ${plan.name}`,
    };
  }

  if (params.isSubscriptionError) {
    return { ...base, destination: "none", disabled: true, label: "Billing unavailable" };
  }

  if (params.isSubscriptionLoading || !subscription) {
    return { ...base, destination: "none", disabled: true, label: "Checking plan…" };
  }

  const matchesPaidPlan = subscription.planKey !== "free" && subscription.planKey === plan.slug;
  const isCurrentPaidPlan = subscription.isActive && matchesPaidPlan;

  if (subscription.isDodoManaged) {
    const needsPayment = subscription.status === "on_hold" || subscription.status === "failed";
    const paused = subscription.status === "paused";
    const intervalChanged = isCurrentPaidPlan &&
      subscription.billingInterval !== null &&
      subscription.billingInterval !== params.billingInterval;

    return {
      badgeLabel: matchesPaidPlan && needsPayment
        ? "Payment needed"
        : matchesPaidPlan && paused
          ? "Paused"
          : isCurrentPaidPlan ? "Current plan" : null,
      badgeTone: needsPayment || paused ? "attention" : "success",
      destination: "portal",
      disabled: false,
      label: plan.slug === "free"
        ? "Manage billing"
        : needsPayment
          ? "Update payment method"
          : paused
            ? "Resume subscription"
            : intervalChanged
              ? `Switch to ${params.billingInterval === "yearly" ? "annual" : "monthly"} billing`
              : isCurrentPaidPlan ? "Manage current plan" : "Change plan",
    };
  }

  if (isCurrentPaidPlan && subscription.accessSource === "complimentary") {
    return {
      badgeLabel: "Complimentary",
      badgeTone: "success",
      destination: "workspace",
      disabled: false,
      label: "Open workspace",
    };
  }

  if (plan.slug === "free") {
    return {
      badgeLabel: null,
      badgeTone: "success",
      destination: "workspace",
      disabled: false,
      label: "Open workspace",
    };
  }

  return { ...base, destination: "checkout", disabled: false, label: `Get ${plan.name}` };
}
