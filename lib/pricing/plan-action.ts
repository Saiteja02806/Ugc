import type { BillingSubscription } from "@/components/billing/use-billing-subscription";
import { FREE_TRIAL_CONTENT_DAYS } from "@/lib/billing/free-trial-policy";
import type { BillingInterval, PricingPlan } from "@/lib/pricing/plans";

type SubscriptionForPricing = Pick<
  BillingSubscription,
  "accessSource" | "billingInterval" | "isActive" | "isDodoManaged" | "planKey" | "status" | "trial"
>;

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
      label: plan.slug === "free" ? `Start ${FREE_TRIAL_CONTENT_DAYS}-day trial` : `Get ${plan.name}`,
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
    const currentTrial = !subscription.isActive && subscription.trial.status === "active";
    const expiredTrial = !subscription.isActive && subscription.trial.status === "expired";
    return {
      badgeLabel: currentTrial ? "Trial active" : expiredTrial ? "Trial ended" : null,
      badgeTone: expiredTrial ? "neutral" : "success",
      destination: "workspace",
      disabled: false,
      label: "Open workspace",
    };
  }

  return { ...base, destination: "checkout", disabled: false, label: `Get ${plan.name}` };
}
