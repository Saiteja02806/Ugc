export const PENDING_CHECKOUT_COOKIE_NAME =
  "ugc-pilot-pending-checkout";
export const PENDING_CHECKOUT_MAX_AGE_SECONDS = 3 * 60 * 60;
export const MAX_PENDING_CHECKOUTS = 3;

export function isPendingCheckoutSessionId(
  value: string | undefined,
): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{8,200}$/.test(value));
}

/**
 * The cookie is only a short-lived browser hint. Keep a small, bounded list so
 * opening another checkout cannot make an earlier successful checkout
 * impossible to reconcile when it returns.
 */
export function getPendingCheckoutSessionIds(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(".")
        .filter(isPendingCheckoutSessionId),
    ),
  ).slice(0, MAX_PENDING_CHECKOUTS);
}

export function serializePendingCheckoutSessionIds(sessionIds: string[]) {
  return getPendingCheckoutSessionIds(sessionIds.join("."))
    .join(".");
}
