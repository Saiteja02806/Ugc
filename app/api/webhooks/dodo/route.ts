import { after, NextResponse } from "next/server";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";

import {
  getDodoApiKey,
  getDodoWebhookKey,
  resolveDodoProductConfig,
  unwrapDodoWebhook,
} from "@/lib/billing/dodo";
import {
  processDodoSubscriptionEvent,
  recordIgnoredDodoWebhookEvent,
} from "@/lib/billing/subscription-db";
import { dispatchPaidTrendingPrebuild } from "@/lib/billing/paid-trending-prebuild-dispatch";

export const runtime = "nodejs";

const SUBSCRIPTION_EVENT_TYPES = new Set([
  "subscription.active",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.failed",
  "subscription.on_hold",
  "subscription.paused",
  "subscription.plan_changed",
  "subscription.renewed",
  "subscription.unpaused",
  "subscription.update_payment_method",
  "subscription.updated",
]);

type SubscriptionEvent = Extract<
  UnwrapWebhookEvent,
  { type: `subscription.${string}` }
>;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const webhookId = request.headers.get("webhook-id")?.trim() ?? "";
  const webhookTimestamp =
    request.headers.get("webhook-timestamp")?.trim() ?? "";
  const webhookSignature =
    request.headers.get("webhook-signature")?.trim() ?? "";

  if (!getDodoWebhookKey() || !getDodoApiKey()) {
    console.error("Dodo webhook credentials are not configured.");
    return NextResponse.json(
      { error: "Webhook verification is not configured." },
      { status: 500 },
    );
  }

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return NextResponse.json(
      { error: "Missing required webhook signature headers." },
      { status: 401 },
    );
  }

  let event: UnwrapWebhookEvent;
  let payload: Record<string, unknown>;

  try {
    event = unwrapDodoWebhook({
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": webhookSignature,
        "webhook-timestamp": webhookTimestamp,
      },
      rawBody,
    });
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch (error) {
    console.warn("Invalid Dodo webhook rejected:", {
      error: error instanceof Error ? error.message : "Signature verification failed",
      webhookId,
    });
    return NextResponse.json(
      { error: "Invalid webhook signature or payload." },
      { status: 401 },
    );
  }

  try {
    if (!isSubscriptionEvent(event)) {
      await recordIgnoredDodoWebhookEvent({
        eventTimestamp: event.timestamp,
        eventType: event.type,
        payload,
        reason: "Event does not change application subscription state.",
        webhookId,
      });

      return NextResponse.json({ ignored: true, received: true });
    }

    const product = resolveDodoProductConfig(event.data.product_id);
    const userId = getMetadataString(event.data.metadata, "user_id");

    if (!product || !userId) {
      const reason = !product
        ? `Unknown Dodo product id: ${event.data.product_id}`
        : "Subscription metadata is missing user_id.";

      console.error("Dodo subscription event ignored:", {
        eventType: event.type,
        reason,
        webhookId,
      });
      await recordIgnoredDodoWebhookEvent({
        eventTimestamp: event.timestamp,
        eventType: event.type,
        payload,
        reason,
        webhookId,
      });

      return NextResponse.json({ ignored: true, received: true });
    }

    const result = await processDodoSubscriptionEvent({
      billingInterval: product.billingInterval,
      cancelAtPeriodEnd: event.data.cancel_at_next_billing_date,
      cancelledAt: event.data.cancelled_at ?? null,
      customerEmail: event.data.customer.email,
      customerId: event.data.customer.customer_id,
      eventTimestamp: event.timestamp,
      eventType: event.type,
      metadata: event.data.metadata,
      payload,
      periodEnd: event.data.next_billing_date ?? null,
      periodStart: event.data.previous_billing_date ?? null,
      planKey: product.planSlug,
      productId: product.productId,
      status: event.data.status,
      subscriptionId: event.data.subscription_id,
      userId,
      webhookId,
    });

    // The subscription transaction has already saved the prebuild job. Queue
    // delivery is deliberately best-effort here: Dodo gets its fast 200, and
    // the durable queued job remains available to recovery if Cloud Tasks is
    // briefly unavailable.
    if (event.data.status === "active") {
      after(() =>
        dispatchPaidTrendingPrebuild({
          periodStart: event.data.previous_billing_date ?? null,
          planKey: product.planSlug,
          subscriptionId: event.data.subscription_id,
          userId,
        }),
      );
    }

    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("Dodo webhook processing error:", {
      error: error instanceof Error ? error.message : "Webhook processing failed",
      eventType: event.type,
      webhookId,
    });
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}

function isSubscriptionEvent(
  event: UnwrapWebhookEvent,
): event is SubscriptionEvent {
  return SUBSCRIPTION_EVENT_TYPES.has(event.type);
}

function getMetadataString(
  metadata: Record<string, unknown>,
  key: string,
) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
