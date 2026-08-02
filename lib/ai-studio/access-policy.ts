export type AIStudioAccessState = "checking" | "error" | "locked" | "pro";

export function getAIStudioAccessMessage(state: AIStudioAccessState) {
  switch (state) {
    case "checking":
      return "Checking generation access…";
    case "error":
      return "Generation access could not be verified. Refresh to try again.";
    case "locked":
      return "Generation is available to approved Pro accounts.";
    case "pro":
      return null;
  }
}

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
