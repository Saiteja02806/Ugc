export type CarouselAdminIdentity = {
  email: string | null;
  emailVerified: boolean;
};

export function normalizeCarouselAdminEmail(value: string) {
  return value.trim().toLowerCase();
}
export function parseCarouselAdminEmails(value: string | undefined) {
  if (!value?.trim()) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(",")
      .map(normalizeCarouselAdminEmail)
      .filter(Boolean),
  );
}

export function hasCarouselAdminAccess(
  identity: CarouselAdminIdentity,
  configuredEmails: string | undefined,
) {
  if (!identity.emailVerified || !identity.email) {
    return false;
  }

  return parseCarouselAdminEmails(configuredEmails).has(
    normalizeCarouselAdminEmail(identity.email),
  );
}
