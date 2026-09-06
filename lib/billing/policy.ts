export type BillingPlanKey = "free" | "starter" | "growth";

export const MAX_BILLING_USAGE_ATTEMPTS = 10;

export const INSTAGRAM_ACCOUNT_LIMITS: Record<BillingPlanKey, number> = {
  free: 1,
  growth: 5,
  starter: 3,
};

const MIN_BILLING_USAGE_RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_BILLING_USAGE_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

export function getSubscriptionEntitlementPlanKey(
  planKey: BillingPlanKey,
): "creator" | "free" | "pro" {
  if (planKey === "growth") return "creator";
  if (planKey === "starter") return "pro";
  return "free";
}

export function resolveDailyContentPieces(
  planKey: BillingPlanKey,
  isActive: boolean,
  configuredValue?: number | null,
) {
  const fallback =
    isActive && planKey === "growth"
      ? 50
      : isActive && planKey === "starter"
        ? 20
        : 10;
  const configured = toInteger(configuredValue, fallback);

  return configured > 0 ? configured : fallback;
}

export function resolveInstagramAccountLimit(
  planKey: BillingPlanKey,
  isActive: boolean,
) {
  const effectivePlanKey = isActive ? planKey : "free";

  return INSTAGRAM_ACCOUNT_LIMITS[effectivePlanKey];
}

export function getBillingUsageRetryDelayMs(attemptCount: number) {
  const normalizedAttempt = Math.max(1, Math.trunc(attemptCount));

  return Math.min(
    MIN_BILLING_USAGE_RETRY_DELAY_MS * 2 ** (normalizedAttempt - 1),
    MAX_BILLING_USAGE_RETRY_DELAY_MS,
  );
}

function toInteger(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;
}
