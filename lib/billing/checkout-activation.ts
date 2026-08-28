import "server-only";

import type { VerifiedFirebaseUser } from "@/lib/firebase/server-auth";

import { isVerifiedCheckoutActivation } from "./checkout-activation-logic";
import { getDodoClient, resolveDodoProductConfig } from "./dodo";
import type { PaidTrendingPrebuildDispatchParams } from "./paid-trending-prebuild-dispatch";
import {
  getUserSubscription,
  processDodoSubscriptionEvent,
  type UserSubscriptionInfo,
} from "./subscription-db";

export type CheckoutActivationResult = {
  prebuildDispatch: PaidTrendingPrebuildDispatchParams | null;
  status: "active" | "pending" | "unavailable";
  subscription: UserSubscriptionInfo;
};

/**
 * Reconciles a just-completed Dodo checkout before its webhook arrives. Dodo's
 * authenticated API response, not the browser cookie, is what authorizes the
 * durable entitlement update.
 */
export async function reconcileCheckoutActivation(params: {
  checkoutSessionIds: string[];
  user: VerifiedFirebaseUser;
}): Promise<CheckoutActivationResult> {
  const currentSubscription = await getUserSubscription(params.user.uid);

  if (currentSubscription.isActive) {
    return {
      prebuildDispatch: null,
      status: "active",
      subscription: currentSubscription,
    };
  }

  if (params.checkoutSessionIds.length === 0) {
    return {
      prebuildDispatch: null,
      status: "unavailable",
      subscription: currentSubscription,
    };
  }

  const dodo = getDodoClient();
  let sawPendingCheckout = false;

  for (const checkoutSessionId of params.checkoutSessionIds) {
    try {
      const result = await reconcileSingleCheckoutActivation({
        checkoutSessionId,
        currentSubscription,
        dodo,
        user: params.user,
      });

      if (result.status === "active") {
        return result;
      }

      sawPendingCheckout ||= result.status === "pending";
    } catch (error) {
      // A stale or temporarily unavailable session must not prevent another
      // recent checkout from being checked. Keep the cookie for a retry and
      // let the signed webhook remain the durable fallback.
      sawPendingCheckout = true;
      console.warn("Could not reconcile one pending Dodo checkout:", {
        checkoutSessionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    prebuildDispatch: null,
    status: sawPendingCheckout ? "pending" : "unavailable",
    subscription: currentSubscription,
  };
}

async function reconcileSingleCheckoutActivation(params: {
  checkoutSessionId: string;
  currentSubscription: UserSubscriptionInfo;
  dodo: ReturnType<typeof getDodoClient>;
  user: VerifiedFirebaseUser;
}): Promise<CheckoutActivationResult> {
  const checkout = await params.dodo.checkoutSessions.retrieve(
    params.checkoutSessionId,
  );

  if (
    checkout.id !== params.checkoutSessionId ||
    checkout.payment_status !== "succeeded" ||
    !checkout.payment_id
  ) {
    return {
      prebuildDispatch: null,
      status: "pending",
      subscription: params.currentSubscription,
    };
  }

  const payment = await params.dodo.payments.retrieve(checkout.payment_id);

  if (!payment.subscription_id) {
    return {
      prebuildDispatch: null,
      status: "pending",
      subscription: params.currentSubscription,
    };
  }

  const subscription = await params.dodo.subscriptions.retrieve(
    payment.subscription_id,
  );
  const product = resolveDodoProductConfig(subscription.product_id);
  const metadataUserId = getMetadataString(subscription.metadata, "user_id");
  const isVerified = isVerifiedCheckoutActivation({
    checkout: {
      id: checkout.id,
      paymentId: checkout.payment_id,
      paymentStatus: checkout.payment_status,
    },
    currentUser: { email: params.user.email, uid: params.user.uid },
    hasRecognizedProduct: Boolean(product),
    payment: {
      checkoutSessionId: payment.checkout_session_id,
      customerEmail: payment.customer.email,
      customerId: payment.customer.customer_id,
      id: payment.payment_id,
      status: payment.status,
      subscriptionId: payment.subscription_id,
    },
    requestedCheckoutSessionId: params.checkoutSessionId,
    subscription: {
      customerEmail: subscription.customer.email,
      customerId: subscription.customer.customer_id,
      id: subscription.subscription_id,
      metadataUserId,
      status: subscription.status,
    },
  });

  if (!isVerified || !product) {
    return {
      prebuildDispatch: null,
      status: "unavailable",
      subscription: params.currentSubscription,
    };
  }

  await processDodoSubscriptionEvent({
    billingInterval: product.billingInterval,
    cancelAtPeriodEnd: subscription.cancel_at_next_billing_date,
    cancelledAt: subscription.cancelled_at ?? null,
    customerEmail: subscription.customer.email,
    customerId: subscription.customer.customer_id,
    // Preserve Dodo's event ordering. Using the browser-return time here could
    // incorrectly make a delayed cancellation webhook look stale.
    eventTimestamp: payment.updated_at ?? subscription.created_at,
    eventType: "checkout.reconciled",
    metadata: subscription.metadata,
    payload: {
      checkoutSessionId: checkout.id,
      paymentId: payment.payment_id,
      source: "checkout-reconciliation",
      subscriptionId: subscription.subscription_id,
    },
    periodEnd: subscription.next_billing_date ?? null,
    periodStart: subscription.previous_billing_date ?? null,
    planKey: product.planSlug,
    productId: subscription.product_id,
    status: "active",
    subscriptionId: subscription.subscription_id,
    userId: params.user.uid,
    webhookId: `checkout-reconcile:${checkout.id}`,
  });

  const reconciledSubscription = await getUserSubscription(params.user.uid);

  return {
    prebuildDispatch: reconciledSubscription.isActive
      ? {
          periodStart: subscription.previous_billing_date ?? null,
          planKey: product.planSlug,
          subscriptionId: subscription.subscription_id,
          userId: params.user.uid,
        }
      : null,
    status: reconciledSubscription.isActive ? "active" : "pending",
    subscription: reconciledSubscription,
  };
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
