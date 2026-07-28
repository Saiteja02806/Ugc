export type AIStudioAccessState = "checking" | "locked" | "pro";

export type AIStudioAccessIdentity = {
  email: string | null;
  emailVerified: boolean;
};

export function normalizeAIStudioEmail(value: string) {
  return value.trim().toLowerCase();
}

export function parseAIStudioAllowedEmails(value: string | undefined) {
  if (!value?.trim()) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(",")
      .map(normalizeAIStudioEmail)
      .filter(Boolean),
  );
}

export function hasAIStudioProAccess(
  identity: AIStudioAccessIdentity,
  configuredEmails: string | undefined,
) {
  if (!identity.emailVerified || !identity.email) {
    return false;
  }

  const allowedEmails = parseAIStudioAllowedEmails(configuredEmails);

  if (allowedEmails.size === 0) {
    return false;
  }

  return allowedEmails.has(normalizeAIStudioEmail(identity.email));
}
