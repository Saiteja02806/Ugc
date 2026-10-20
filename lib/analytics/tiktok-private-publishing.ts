import type { ScheduledPost } from "@/lib/scheduling/types";

export type TikTokPrivatePublishingRecord = {
  connectionId: string;
  id: string;
  publishedAt: string | null;
  title: string | null;
};

/**
 * TikTok's video-list response does not contain posts published with Only me
 * visibility. Keep those publishing records visible, but never represent an
 * unavailable provider metric as zero.
 */
export function getTikTokPrivatePublishingRecords(
  schedules: ScheduledPost[],
): TikTokPrivatePublishingRecord[] {
  return schedules
    .flatMap((schedule) =>
      schedule.targets.flatMap((target) => {
        if (
          target.platform !== "tiktok" ||
          target.status !== "published" ||
          target.settings.privacyLevel !== "SELF_ONLY"
        ) {
          return [];
        }

        return [{
          connectionId: target.socialConnectionId,
          id: target.id,
          publishedAt: target.publishedAt ?? schedule.publishedAt,
          title: schedule.title?.trim() || null,
        }];
      }),
    )
    .sort((left, right) => {
      const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
      const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;

      return rightTime - leftTime;
    })
    .slice(0, 20);
}
