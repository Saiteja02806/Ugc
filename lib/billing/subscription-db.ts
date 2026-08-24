import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ingestDodoUsageEvent } from "@/lib/billing/dodo";
import {
  getBillingUsageRetryDelayMs,
  getSubscriptionEntitlementPlanKey,
  MAX_BILLING_USAGE_ATTEMPTS,
  resolveDailyContentPieces,
  resolveInstagramAccountLimit,
  type BillingPlanKey,
} from "@/lib/billing/policy";

export type { BillingPlanKey } from "@/lib/billing/policy";
export type BillingSubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "failed"
  | "free"
  | "on_hold"
  | "paused"
  | "pending";

export type UserSubscriptionInfo = {
  billingInterval: "monthly" | "yearly" | null;
  cancelAtPeriodEnd: boolean;
  connectedInstagramAccounts: number;
  creditsRemaining: number;
  creditsReserved: number;
  creditsUsed: number;
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
  dailyContentPieces: number | "Limited";
  displayName: "Free" | "Starter" | "Growth";
  instagramAccounts: number;
  isActive: boolean;
  planKey: BillingPlanKey;
  sharedMonthlyCredits: number;
  status: BillingSubscriptionStatus;
  updatedAt: string | null;
  userId: string;
};

export type DodoSubscriptionEventInput = {
  billingInterval: "monthly" | "yearly";
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  customerEmail: string;
  customerId: string;
  eventTimestamp: string;
  eventType: string;
  metadata: Record<string, unknown>;
  payload: Record<string, unknown>;
  periodEnd: string | null;
  periodStart: string | null;
  planKey: "starter" | "growth";
  productId: string;
  status: Exclude<BillingSubscriptionStatus, "free">;
  subscriptionId: string;
  userId: string;
  webhookId: string;
};

export class BillingAccessError extends Error {
  status: number;

  constructor(message: string, status = 402) {
    super(message);
    this.name = "BillingAccessError";
    this.status = status;
  }
}

let client: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}

function getClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Supabase is not configured for billing operations.");
  }

  client ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}

export function normalizeSubscriptionPlanKey(
  rawKey: string | null | undefined,
): BillingPlanKey {
  if (!rawKey) return "free";
  const normalized = rawKey.trim().toLowerCase();

  if (
    normalized === "growth" ||
    normalized === "creator" ||
    normalized === "ultra_pro"
  ) {
    return "growth";
  }

  if (normalized === "starter" || normalized === "pro") {
    return "starter";
  }

  return "free";
}

export function resolveSubscriptionEntitlements(
  planKey: BillingPlanKey,
  isActive: boolean,
  userId: string,
  updatedAt?: string | null,
  configuredDailyContentPieces?: number | null,
): UserSubscriptionInfo {
  const paidPlan = planKey;
  const sharedMonthlyCredits =
    isActive && paidPlan === "growth"
      ? 600
      : isActive && paidPlan === "starter"
        ? 200
        : 0;

  return {
    billingInterval: null,
    cancelAtPeriodEnd: false,
    connectedInstagramAccounts: 0,
    creditsRemaining: sharedMonthlyCredits,
    creditsReserved: 0,
    creditsUsed: 0,
    currentPeriodEnd: null,
    currentPeriodStart: null,
    dailyContentPieces: resolveDailyContentPieces(
      isActive ? paidPlan : "free",
      isActive,
      configuredDailyContentPieces,
    ),
    displayName:
      paidPlan === "growth"
        ? "Growth"
        : paidPlan === "starter"
          ? "Starter"
          : "Free",
    instagramAccounts: resolveInstagramAccountLimit(paidPlan, isActive),
    isActive: isActive && paidPlan !== "free",
    planKey: paidPlan,
    sharedMonthlyCredits,
    status: paidPlan === "free" ? "free" : isActive ? "active" : "pending",
    updatedAt: updatedAt ?? null,
    userId,
  };
}

export async function getUserSubscription(
  userId: string,
): Promise<UserSubscriptionInfo> {
  if (!userId.trim()) {
    return resolveSubscriptionEntitlements("free", false, "");
  }

  const db = getClient();
  const refreshResult = await db.rpc("refresh_billing_credit_balance", {
    p_user_id: userId,
  });

  if (refreshResult.error) {
    console.warn(
      `Could not refresh billing credit cycle for user ${userId}:`,
      refreshResult.error.message,
    );
  }

  const [
    subscriptionResult,
    creditsResult,
    accountsResult,
    entitlementsResult,
  ] = await Promise.all([
    db
      .from("billing_subscriptions")
      .select(
        "billing_interval,cancel_at_period_end,current_period_end,current_period_start,last_event_at,plan_key,status",
      )
      .eq("user_id", userId)
      .order("last_event_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("billing_credit_balances")
      .select("credit_limit,reserved_credits,used_credits")
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("social_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("platform", "instagram")
      .is("revoked_at", null),
    db
      .from("subscription_entitlements")
      .select("daily_trending_limit,plan_key")
      .in("plan_key", ["free", "pro", "creator"]),
  ]);

  if (subscriptionResult.error) {
    console.warn(
      `Could not fetch billing subscription for user ${userId}:`,
      subscriptionResult.error.message,
    );
    return resolveSubscriptionEntitlements("free", false, userId);
  }

  const row = subscriptionResult.data;
  const planKey = normalizeSubscriptionPlanKey(row?.plan_key);
  const status = normalizeSubscriptionStatus(row?.status);
  const isActive = status === "active";
  const entitlementPlanKey = getSubscriptionEntitlementPlanKey(
    isActive ? planKey : "free",
  );
  const configuredDailyContentPieces = entitlementsResult.data?.find(
    (entitlement) => entitlement.plan_key === entitlementPlanKey,
  )?.daily_trending_limit;

  if (entitlementsResult.error) {
    console.warn(
      `Could not fetch subscription entitlements for user ${userId}:`,
      entitlementsResult.error.message,
    );
  }

  const base = resolveSubscriptionEntitlements(
    planKey,
    isActive,
    userId,
    row?.last_event_at,
    configuredDailyContentPieces,
  );
  const creditLimit = Math.max(
    0,
    toInteger(creditsResult.data?.credit_limit, base.sharedMonthlyCredits),
  );
  const creditsUsed = Math.max(0, toInteger(creditsResult.data?.used_credits));
  const creditsReserved = Math.max(
    0,
    toInteger(creditsResult.data?.reserved_credits),
  );

  return {
    ...base,
    billingInterval:
      row?.billing_interval === "monthly" || row?.billing_interval === "yearly"
        ? row.billing_interval
        : null,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    connectedInstagramAccounts: Math.max(0, accountsResult.count ?? 0),
    creditsRemaining: base.isActive
      ? Math.max(creditLimit - creditsUsed - creditsReserved, 0)
      : 0,
    creditsReserved: base.isActive ? creditsReserved : 0,
    creditsUsed: base.isActive ? creditsUsed : 0,
    currentPeriodEnd: row?.current_period_end ?? null,
    currentPeriodStart: row?.current_period_start ?? null,
    sharedMonthlyCredits: base.isActive ? creditLimit : 0,
    status,
  };
}

export async function getBillingCustomerId(userId: string) {
  const { data, error } = await getClient()
    .from("billing_customers")
    .select("dodo_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load billing customer: ${error.message}`);
  }

  return typeof data?.dodo_customer_id === "string"
    ? data.dodo_customer_id
    : null;
}

export async function processDodoSubscriptionEvent(
  input: DodoSubscriptionEventInput,
) {
  const { data, error } = await getClient().rpc(
    "apply_dodo_subscription_event",
    {
      p_billing_interval: input.billingInterval,
      p_cancel_at_period_end: input.cancelAtPeriodEnd,
      p_cancelled_at: input.cancelledAt,
      p_customer_email: input.customerEmail,
      p_customer_id: input.customerId,
      p_event_timestamp: input.eventTimestamp,
      p_event_type: input.eventType,
      p_metadata: input.metadata,
      p_payload: input.payload,
      p_period_end: input.periodEnd,
      p_period_start: input.periodStart,
      p_plan_key: input.planKey,
      p_product_id: input.productId,
      p_status: input.status,
      p_subscription_id: input.subscriptionId,
      p_user_id: input.userId,
      p_webhook_id: input.webhookId,
    },
  );

  if (error) {
    throw new Error(`Could not apply Dodo subscription event: ${error.message}`);
  }

  return data;
}

export async function recordIgnoredDodoWebhookEvent(params: {
  eventTimestamp: string;
  eventType: string;
  payload: Record<string, unknown>;
  reason: string;
  webhookId: string;
}) {
  const { error } = await getClient().rpc("record_ignored_dodo_webhook_event", {
    p_event_timestamp: params.eventTimestamp,
    p_event_type: params.eventType,
    p_payload: params.payload,
    p_reason: params.reason,
    p_webhook_id: params.webhookId,
  });

  if (error) {
    throw new Error(`Could not record ignored Dodo webhook: ${error.message}`);
  }
}

export async function reserveBillingCredits(params: {
  amount: number;
  idempotencyKey: string;
  jobType: string;
  userId: string;
}) {
  const { data, error } = await getClient().rpc("reserve_billing_credits", {
    p_amount: params.amount,
    p_idempotency_key: params.idempotencyKey,
    p_job_type: params.jobType,
    p_user_id: params.userId,
  });

  if (error) {
    const normalized = error.message.toLowerCase();

    if (normalized.includes("insufficient_billing_credits")) {
      throw new BillingAccessError(
        "You do not have enough AI credits for this generation.",
      );
    }

    if (normalized.includes("paid_subscription_required")) {
      throw new BillingAccessError(
        "An active Starter or Growth subscription is required.",
      );
    }

    throw new Error(`Could not reserve billing credits: ${error.message}`);
  }

  return data;
}

export async function releaseBillingCredits(params: {
  idempotencyKey: string;
  userId: string;
}) {
  const { error } = await getClient().rpc(
    "settle_billing_credit_reservation",
    {
      p_background_job_id: null,
      p_commit: false,
      p_idempotency_key: params.idempotencyKey,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(`Could not release billing credits: ${error.message}`);
  }
}

export async function deliverBillingUsageForJob(jobId: string) {
  const db = getClient();
  const { data, error } = await db
    .from("billing_usage_outbox")
    .select(
      "attempt_count,credit_cost,dodo_customer_id,event_id,generation_kind,next_attempt_at,occurred_at,status,user_id",
    )
    .eq("background_job_id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load billing usage event: ${error.message}`);
  }

  if (
    !data ||
    data.status === "delivered" ||
    toInteger(data.attempt_count) >= MAX_BILLING_USAGE_ATTEMPTS ||
    isFutureTimestamp(data.next_attempt_at)
  ) {
    return;
  }

  const eventName =
    data.generation_kind === "video"
      ? process.env.DODO_VIDEO_USAGE_EVENT_NAME?.trim() ||
        "video.generation"
      : process.env.DODO_IMAGE_USAGE_EVENT_NAME?.trim() ||
        "image.generation";

  try {
    await ingestDodoUsageEvent({
      customerId: data.dodo_customer_id,
      eventId: data.event_id,
      eventName,
      metadata: {
        credits_cost: String(toInteger(data.credit_cost)),
        generation_kind: data.generation_kind,
        job_id: jobId,
        occurred_at: data.occurred_at,
        user_id: data.user_id,
      },
      timestamp: data.occurred_at,
    });

    const attemptedAt = new Date().toISOString();
    const { error: updateError } = await db
      .from("billing_usage_outbox")
      .update({
        attempt_count: toInteger(data.attempt_count) + 1,
        delivered_at: attemptedAt,
        last_attempt_at: attemptedAt,
        last_error: null,
        next_attempt_at: null,
        status: "delivered",
        updated_at: attemptedAt,
      })
      .eq("event_id", data.event_id);

    if (updateError) {
      throw new Error(`Could not mark Dodo usage as delivered: ${updateError.message}`);
    }
  } catch (usageError) {
    const attemptCount = toInteger(data.attempt_count) + 1;
    const attemptedAt = new Date();
    const nextAttemptAt =
      attemptCount >= MAX_BILLING_USAGE_ATTEMPTS
        ? null
        : new Date(
            attemptedAt.getTime() + getBillingUsageRetryDelayMs(attemptCount),
          ).toISOString();
    const { error: updateError } = await db
      .from("billing_usage_outbox")
      .update({
        attempt_count: attemptCount,
        last_attempt_at: attemptedAt.toISOString(),
        last_error:
          usageError instanceof Error
            ? usageError.message.slice(0, 1000)
            : "Dodo usage delivery failed.",
        next_attempt_at: nextAttemptAt,
        status: "failed",
        updated_at: attemptedAt.toISOString(),
      })
      .eq("event_id", data.event_id);

    if (updateError) {
      console.error("Could not record Dodo usage delivery failure:", {
        error: updateError.message,
        eventId: data.event_id,
      });
    }

    throw usageError;
  }
}

export async function flushPendingBillingUsageEvents(limit = 50) {
  const db = getClient();
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const { data, error } = await db
    .from("billing_usage_outbox")
    .select("background_job_id,event_id")
    .in("status", ["pending", "failed"])
    .lt("attempt_count", MAX_BILLING_USAGE_ATTEMPTS)
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(boundedLimit);

  if (error) {
    throw new Error(`Could not load pending billing usage: ${error.message}`);
  }

  let delivered = 0;
  let failed = 0;

  for (const event of data ?? []) {
    try {
      await deliverBillingUsageForJob(event.background_job_id);
      delivered += 1;
    } catch (usageError) {
      failed += 1;
      console.error("Pending Dodo usage delivery failed:", {
        error:
          usageError instanceof Error
            ? usageError.message
            : "Usage delivery failed.",
        eventId: event.event_id,
      });
    }
  }

  return {
    delivered,
    failed,
    inspected: data?.length ?? 0,
  };
}

export function getGenerationCreditCost(kind: "image" | "video") {
  const variableName =
    kind === "video"
      ? "BILLING_VIDEO_GENERATION_CREDITS"
      : "BILLING_IMAGE_GENERATION_CREDITS";
  const fallback = kind === "video" ? 10 : 1;
  const configured = Number.parseInt(process.env[variableName] ?? "", 10);

  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}

function normalizeSubscriptionStatus(value: unknown): BillingSubscriptionStatus {
  switch (value) {
    case "active":
    case "cancelled":
    case "expired":
    case "failed":
    case "on_hold":
    case "paused":
    case "pending":
      return value;
    default:
      return "free";
  }
}

function toInteger(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;
}

function isFutureTimestamp(value: unknown) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}
