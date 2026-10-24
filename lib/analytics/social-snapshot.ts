import "server-only";

import { readAnalyticsSnapshot } from "./snapshot-service";

// Keep callers on the same resilient snapshot/refresh service as the UI routes.
export { refreshAnalyticsSnapshot as readOrRefreshSocialAnalytics } from "./snapshot-service";

/**
 * Reads only the last durable analytics result for the owner's currently
 * connected account. Never queues work or calls a provider.
 */
export async function readSavedSocialAnalytics(params: {
  userId: string;
  operation: "tiktok_videos" | "youtube_channel" | "instagram_insights" | "instagram_content";
  days?: 7 | 30 | 90;
}) {
  const snapshot = await readAnalyticsSnapshot(params);
  return {
    accounts: snapshot.data.accounts,
    hasSavedSnapshot: snapshot.data.accounts.length > 0,
    refreshRecommended: snapshot.needsRefresh,
    savedAt: snapshot.lastAttemptAt > 0 ? new Date(snapshot.lastAttemptAt).toISOString() : null,
  };
}
