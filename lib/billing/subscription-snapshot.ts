/** Client-only snapshot of the pricing plan action's subscription subset.
 * It hydrates the pricing CTAs before the periodic billing refetch returns;
 * the fresh server response always wins, and the server still verifies every
 * checkout call. */

import type { PricingSubscription } from "@/lib/pricing/plan-action";

export type SubscriptionSnapshot = {
  ownerId: string;
  storedAt: number;
  subscription: PricingSubscription;
};

export type SubscriptionSnapshotFields = PricingSubscription;

const STORAGE_KEY = "vidmake.billing.plan-snapshot.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1_000;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isSubscriptionSnapshotFields(
  value: unknown,
): value is SubscriptionSnapshotFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const subscription = value as Record<string, unknown>;
  const trial = subscription.trial as { status?: unknown } | null | undefined;
  return (
    (subscription.accessSource === "complimentary" ||
      subscription.accessSource === "dodo" ||
      subscription.accessSource === "free") &&
    (subscription.billingInterval === "monthly" ||
      subscription.billingInterval === "yearly" ||
      subscription.billingInterval === null) &&
    typeof subscription.isActive === "boolean" &&
    typeof subscription.isDodoManaged === "boolean" &&
    (subscription.planKey === "free" ||
      subscription.planKey === "starter" ||
      subscription.planKey === "growth" ||
      subscription.planKey === "startup") &&
    (subscription.status === "active" ||
      subscription.status === "cancelled" ||
      subscription.status === "expired" ||
      subscription.status === "failed" ||
      subscription.status === "free" ||
      subscription.status === "on_hold" ||
      subscription.status === "paused" ||
      subscription.status === "pending") &&
    Boolean(
      trial &&
        typeof trial === "object" &&
        (trial.status === "active" ||
          trial.status === "expired" ||
          trial.status === "unavailable"),
    )
  );
}

export function readSubscriptionSnapshot(
  ownerId: string | null | undefined,
): SubscriptionSnapshotFields | null {
  if (!ownerId) return null;
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const snapshot = parsed as Record<string, unknown>;
  if (
    snapshot.ownerId !== ownerId ||
    typeof snapshot.storedAt !== "number" ||
    !Number.isFinite(snapshot.storedAt) ||
    snapshot.storedAt > Date.now() ||
    Date.now() - snapshot.storedAt > MAX_AGE_MS ||
    !isSubscriptionSnapshotFields(snapshot.subscription)
  ) {
    return null;
  }
  return snapshot.subscription;
}

export function writeSubscriptionSnapshot(
  ownerId: string,
  subscription: SubscriptionSnapshotFields,
): void {
  const store = storage();
  if (!store) return;
  const snapshot: SubscriptionSnapshot = {
    ownerId,
    storedAt: Date.now(),
    subscription,
  };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // A full or blocked cache is acceptable; the next fetch still wins.
  }
}
