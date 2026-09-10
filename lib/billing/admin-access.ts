import type { VerifiedFirebaseUser } from "@/lib/firebase/server-auth";

export function normalizeBillingAdminEmail(value: string) {
  return value.trim().toLowerCase();
}

export function parseBillingAdminEmails(value: string | undefined) {
  if (!value?.trim()) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(",")
      .map(normalizeBillingAdminEmail)
      .filter(Boolean),
  );
}

export function hasBillingAdminAccess(
  identity: Pick<VerifiedFirebaseUser, "email" | "emailVerified">,
  configuredEmails: string | undefined,
) {
  if (!identity.emailVerified || !identity.email) {
    return false;
  }

  return parseBillingAdminEmails(configuredEmails).has(
    normalizeBillingAdminEmail(identity.email),
  );
}
