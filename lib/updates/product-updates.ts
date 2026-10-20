export type ProductUpdateKind = "fix" | "improvement" | "new";

export type ProductUpdate = {
  id: string;
  kind: ProductUpdateKind;
  notifyExistingUsersOnly: boolean;
  noticeEligibleAccountCreatedBefore: string | null;
  publishedAt: string;
  releasedOn: string;
  releasedOnLabel: string;
  title: string;
  summary: string;
  details: string;
  highlights: readonly string[];
};

// Keep release notes here so the in-app notice and the full update history
// always describe the same release.
export const PRODUCT_UPDATES: readonly ProductUpdate[] = [
  {
    id: "instagram-account-connection",
    kind: "fix",
    // This is an existing-user fix: people who signed up after the release
    // started with the corrected connection flow and do not need a notice.
    notifyExistingUsersOnly: true,
    noticeEligibleAccountCreatedBefore: "2026-09-11T00:00:00.000Z",
    publishedAt: "2026-09-11T00:00:00.000Z",
    releasedOn: "2026-09-11",
    releasedOnLabel: "September 11, 2026",
    title: "Instagram account connection fixed",
    summary: "You can connect your Instagram account again.",
    details:
      "We corrected an issue that stopped some people from completing the Instagram account connection flow.",
    highlights: [
      "Connect your Instagram account from Settings → Connected accounts.",
      "The connection flow now returns you to UGC Pilot after you approve access.",
    ],
  },
];

export const LATEST_PRODUCT_UPDATE = PRODUCT_UPDATES[0];

export function shouldShowProductUpdateNotice(
  update: ProductUpdate,
  accountCreatedAt: string | null,
) {
  if (!update.notifyExistingUsersOnly) {
    return true;
  }

  if (!accountCreatedAt || !update.noticeEligibleAccountCreatedBefore) {
    return false;
  }

  const accountCreatedAtMs = Date.parse(accountCreatedAt);
  const cutoffMs = Date.parse(update.noticeEligibleAccountCreatedBefore);

  return (
    Number.isFinite(accountCreatedAtMs) &&
    Number.isFinite(cutoffMs) &&
    accountCreatedAtMs < cutoffMs
  );
}
