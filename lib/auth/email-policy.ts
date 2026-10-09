import { parsePurchaseIntent } from "../billing/purchase-intent";

export const PASSWORD_RESET_MESSAGE =
  "If an account exists for this email, we've sent password reset instructions.";

export type AuthEmailKind = "verification" | "password-reset";
export type EmailPurchaseIntent = { plan?: string; billing?: string };

export class AuthEmailError extends Error {
  constructor(
    message: string,
    readonly status = 503,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "AuthEmailError";
  }
}

export function getEmailAuthAppUrl(env = process.env) {
  const url = new URL(
    env.EMAIL_AUTH_APP_URL?.trim() || env.UGC_INTERNAL_APP_URL?.trim() ||
      "https://getugcpilot.com",
  );
  const isLocal = env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password ||
      (url.protocol !== "https:" && !(isLocal && url.protocol === "http:"))) {
    throw new AuthEmailError("Email authentication is not configured.");
  }
  return url.origin;
}

export function getEmailSignInPath(intent: EmailPurchaseIntent = {}) {
  const params = new URLSearchParams();
  const purchase = parsePurchaseIntent(new URLSearchParams({
    plan: intent.plan ?? "", billing: intent.billing ?? "",
  }));
  if (purchase) {
    params.set("plan", purchase.planSlug);
    if (purchase.billingInterval === "yearly") params.set("billing", "yearly");
  }
  return `/sign-in${params.size ? `?${params}` : ""}`;
}

export function getEmailVerificationPath(intent: EmailPurchaseIntent = {}) {
  return getEmailSignInPath(intent).replace("/sign-in", "/verify-email");
}

// Preserve only our purchase intent. Never navigate to an arbitrary continue URL.
export function getSafeEmailContinuePath(continueUrl: string | null, origin: string) {
  try {
    const url = new URL(continueUrl || "/sign-in", origin);
    if (url.origin !== origin || url.pathname !== "/sign-in") return "/sign-in";
    return getEmailSignInPath({
      plan: url.searchParams.get("plan") ?? undefined,
      billing: url.searchParams.get("billing") ?? undefined,
    });
  } catch {
    return "/sign-in";
  }
}

export function buildBrandedEmailActionLink(
  firebaseLink: string,
  appUrl: string,
  kind: AuthEmailKind,
  intent: EmailPurchaseIntent = {},
) {
  const source = new URL(firebaseLink);
  const mode = kind === "verification" ? "verifyEmail" : "resetPassword";
  if (source.searchParams.get("mode") !== mode || !source.searchParams.get("oobCode")) {
    throw new AuthEmailError("Could not prepare the email link. Please try again.");
  }
  const target = new URL("/auth/action", appUrl);
  for (const key of ["mode", "oobCode", "apiKey", "lang"]) {
    const value = source.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  target.searchParams.set("continueUrl", new URL(getEmailSignInPath(intent), appUrl).href);
  return target.href;
}

export function normalizeAuthEmail(value: unknown) {
  if (typeof value !== "string") throw new AuthEmailError("Enter a valid email address.", 400);
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthEmailError("Enter a valid email address.", 400);
  }
  return email;
}
