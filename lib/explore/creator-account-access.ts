/** Initial creator-account pilot: use a verified server identity at API boundaries. */
export function canAccessCreatorAccounts(user: { email?: string | null; emailVerified?: boolean } | null | undefined) {
  return user?.emailVerified === true && user.email?.trim().toLowerCase() === "vtu19403@veltech.edu.in";
}

export function isCreatorAccountReference(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("creator-account-");
}
