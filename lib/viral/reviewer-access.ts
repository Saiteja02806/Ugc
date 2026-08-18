export type ViralReviewerAccessState =
  | "checking"
  | "error"
  | "locked"
  | "reviewer"
  | "unavailable";

export type ViralReviewerIdentity = {
  email: string | null;
  emailVerified: boolean;
};

export function normalizeViralReviewerEmail(value: string) {
  return value.trim().toLowerCase();
}

export function parseViralReviewerEmails(value: string | undefined) {
  if (!value?.trim()) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(",")
      .map(normalizeViralReviewerEmail)
      .filter(Boolean),
  );
}

export function hasViralReviewerAccess(
  identity: ViralReviewerIdentity,
  configuredEmails: string | undefined,
) {
  if (!identity.emailVerified || !identity.email) {
    return false;
  }

  const reviewerEmails = parseViralReviewerEmails(configuredEmails);

  if (reviewerEmails.size === 0) {
    return false;
  }

  return reviewerEmails.has(normalizeViralReviewerEmail(identity.email));
}
