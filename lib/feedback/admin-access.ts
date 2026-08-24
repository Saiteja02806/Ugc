export type ProductFeedbackAdminIdentity = {
  email: string | null;
  emailVerified: boolean;
};

export function normalizeProductFeedbackAdminEmail(value: string) {
  return value.trim().toLowerCase();
}

export function parseProductFeedbackAdminEmails(value: string | undefined) {
  if (!value?.trim()) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(",")
      .map(normalizeProductFeedbackAdminEmail)
      .filter(Boolean),
  );
}

export function hasProductFeedbackAdminAccess(
  identity: ProductFeedbackAdminIdentity,
  configuredEmails: string | undefined,
) {
  if (!identity.emailVerified || !identity.email) {
    return false;
  }

  return parseProductFeedbackAdminEmails(configuredEmails).has(
    normalizeProductFeedbackAdminEmail(identity.email),
  );
}
