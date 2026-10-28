import type { TrendingContentMixPreference } from "./unified-daily-feed-db";

/** Future feed snapshots may follow active automation without overwriting the
 * user's manual Adjust preference or rewriting a pack already reserved. */
export function resolveAutomationGenerationMix(preference: TrendingContentMixPreference, row: { status?: string; config?: unknown } | null) {
  if (row?.status !== "active") return preference;
  const counts = (row.config as { counts?: { dailyTotal: number; educationalTipsCount: number; productStoriesCount: number } } | null)?.counts;
  if (!counts || ![counts.dailyTotal, counts.educationalTipsCount, counts.productStoriesCount].every(Number.isInteger)
    || counts.dailyTotal < 1 || counts.dailyTotal > 5 || counts.educationalTipsCount < 0 || counts.productStoriesCount < 0
    || counts.educationalTipsCount + counts.productStoriesCount !== counts.dailyTotal) throw new Error("Active automation has invalid content counts.");
  // Generation reserves whole batches of five. With two available batches,
  // a posting ratio such as 1:4 can round the minority structure down to zero.
  // Supply both structures evenly; automation still posts its exact saved counts.
  const helpfulTips = counts.educationalTipsCount === 0 ? 0 : counts.productStoriesCount === 0 ? 100 : 50;
  return { ...preference, slideshowStyleMix: { helpfulTips, productStoriesCta: 100 - helpfulTips } };
}
