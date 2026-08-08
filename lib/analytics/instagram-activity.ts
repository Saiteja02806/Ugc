import type {
  ScheduledPost,
  ScheduledPostTarget,
} from "@/lib/scheduling/types";

export type InstagramActivityStatus =
  | "attention"
  | "draft"
  | "published"
  | "scheduled";

export type InstagramActivityBucket = {
  dateKey: string;
  published: number;
  scheduled: number;
};

export type InstagramActivityRow = {
  accountName: string | null;
  date: string;
  id: string;
  platformPostUrl: string | null;
  status: InstagramActivityStatus;
  title: string;
};

export type InstagramAnalyticsSummary = {
  activityRows: InstagramActivityRow[];
  buckets: InstagramActivityBucket[];
  needsAttention: number;
  published: number;
  scheduled: number;
};

/**
 * Builds Analytics activity for the Instagram accounts that are still connected
 * to the workspace. Historical targets from revoked accounts must not change
 * the current account's counts or activity list.
 */
export function buildInstagramActivitySummary(params: {
  accountNames: ReadonlyMap<string, string | null>;
  dateKeys: readonly string[];
  schedules: ScheduledPost[];
  visibleConnectionIds: ReadonlySet<string>;
}): InstagramAnalyticsSummary {
  const rangeSet = new Set(params.dateKeys);
  const bucketMap = new Map(
    params.dateKeys.map((dateKey) => [
      dateKey,
      { dateKey, published: 0, scheduled: 0 } satisfies InstagramActivityBucket,
    ]),
  );
  const activityRows: InstagramActivityRow[] = [];
  let published = 0;
  let scheduled = 0;
  let needsAttention = 0;

  for (const schedule of params.schedules) {
    for (const target of schedule.targets) {
      if (
        target.platform !== "instagram" ||
        !params.visibleConnectionIds.has(target.socialConnectionId)
      ) {
        continue;
      }

      const status = getInstagramActivityStatus(target);

      // Cancelled posts are not useful publishing activity. They remain in the
      // scheduling audit trail, but never appear in Analytics history.
      if (!status) {
        continue;
      }

      const date = getTargetActivityDate(target);
      const dateKey = getDateKey(date);

      if (!dateKey || !rangeSet.has(dateKey)) {
        continue;
      }

      const bucket = bucketMap.get(dateKey);

      if (status === "published") {
        published += 1;
        if (bucket) {
          bucket.published += 1;
        }
      } else if (status === "scheduled") {
        scheduled += 1;
        if (bucket) {
          bucket.scheduled += 1;
        }
      } else if (status === "attention") {
        needsAttention += 1;
      }

      activityRows.push({
        accountName:
          params.accountNames.get(target.socialConnectionId) ?? null,
        date,
        id: `${schedule.id}:${target.id}`,
        platformPostUrl: target.platformPostUrl,
        status,
        title: schedule.title?.trim() || "Scheduled post",
      });
    }
  }

  activityRows.sort(
    (left, right) => Date.parse(right.date) - Date.parse(left.date),
  );

  return {
    activityRows: activityRows.slice(0, 6),
    buckets: Array.from(bucketMap.values()),
    needsAttention,
    published,
    scheduled,
  };
}

function getInstagramActivityStatus(
  target: ScheduledPostTarget,
): InstagramActivityStatus | null {
  if (target.status === "cancelled") {
    return null;
  }

  if (target.status === "published") {
    return "published";
  }

  if (
    target.status === "failed" ||
    target.status === "action_required"
  ) {
    return "attention";
  }

  if (
    target.status === "scheduled" ||
    target.status === "scheduling" ||
    target.status === "publishing"
  ) {
    return "scheduled";
  }

  return "draft";
}

function getTargetActivityDate(target: ScheduledPostTarget) {
  if (target.status === "published" && target.publishedAt) {
    return target.publishedAt;
  }

  if (
    target.status === "failed" ||
    target.status === "action_required"
  ) {
    return target.updatedAt;
  }

  return target.scheduledFor || target.updatedAt;
}

function getDateKey(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
}
