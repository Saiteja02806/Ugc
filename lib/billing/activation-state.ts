import type { BillingSubscriptionStatus } from "@/lib/billing/subscription-db";

export function shouldPollForSubscriptionActivation(
  status: BillingSubscriptionStatus | undefined,
) {
  // A checkout can return before Dodo has created its subscription record, so
  // "free" still needs a short wait. Every other non-active paid status is a
  // result the user should see immediately, not a reason to keep spinning.
  return status === undefined || status === "free" || status === "pending";
}

export function getSubscriptionActivationFailure(
  status: BillingSubscriptionStatus | undefined,
) {
  switch (status) {
    case "failed":
      return {
        description:
          "Dodo Payments could not complete the payment. Your subscription was not activated.",
        title: "Payment failed",
      };
    case "cancelled":
      return {
        description:
          "This subscription was cancelled. Your subscription is not active.",
        title: "Subscription cancelled",
      };
    case "expired":
      return {
        description:
          "This checkout expired before the subscription could be activated.",
        title: "Checkout expired",
      };
    case "on_hold":
      return {
        description:
          "This subscription needs payment attention before it can be activated.",
        title: "Payment needs attention",
      };
    case "paused":
      return {
        description:
          "This subscription is paused and cannot be activated right now.",
        title: "Subscription paused",
      };
    default:
      return null;
  }
}
