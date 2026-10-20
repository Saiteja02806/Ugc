import type {
  ScheduledPost,
  ScheduledPostTarget,
} from "@/lib/scheduling/types";

export type YouTubePublicationActivityStatus =
  | "attention"
  | "draft"
  | "published"
  | "scheduled";

export type YouTubePublicationActivityRow = {
  connectionId: string;
  date: string;
  errorMessage: string | null;
  id: string;
  platformPostUrl: string | null;
  status: YouTubePublicationActivityStatus;
  title: string;
};

export type YouTubePublicationActivitySummary = {
  needsAttention: number;
  published: number;
  rows: YouTubePublicationActivityRow[];
  scheduled: number;
};

/**
 * Builds a user-facing audit trail from UGC Pilot's durable scheduling
 * records. This intentionally reports publishing state only; it does not
 * represent YouTube performance metrics such as views or watch time.
 */
export function buildYouTubePublicationActivity(
  schedules: ScheduledPost[],
  options: { connectionId?: string } = {},
): YouTubePublicationActivitySummary {
  const rows: YouTubePublicationActivityRow[] = [];
  let needsAttention = 0;
  let published = 0;
  let scheduled = 0;

  for (const schedule of schedules) {
    for (const target of schedule.targets) {
      if (target.platform !== "youtube") {
        continue;
      }

      if (
        options.connectionId &&
        target.socialConnectionId !== options.connectionId
      ) {
        continue;
      }

      const status = getYouTubePublicationActivityStatus(target);

      // Cancelled uploads remain part of the scheduling audit trail but are
      // intentionally not presented as active publishing activity.
      if (!status) {
        continue;
      }

      if (status === "published") {
        published += 1;
      } else if (status === "scheduled") {
        scheduled += 1;
      } else if (status === "attention") {
        needsAttention += 1;
      }

      rows.push({
        connectionId: target.socialConnectionId,
        date: getYouTubePublicationActivityDate(target),
        errorMessage:
          status === "attention" ? target.lastErrorMessage : null,
        id: `${schedule.id}:${target.id}`,
        platformPostUrl: target.platformPostUrl,
        status,
        title: schedule.title.trim() || "YouTube upload",
      });
    }
  }

  rows.sort((left, right) => Date.parse(right.date) - Date.parse(left.date));

  return {
    needsAttention,
    published,
    rows,
    scheduled,
  };
}

function getYouTubePublicationActivityStatus(
  target: ScheduledPostTarget,
): YouTubePublicationActivityStatus | null {
  if (target.status === "cancelled" || target.status === "skipped") {
    return null;
  }

  if (target.status === "published") {
    return "published";
  }

  if (target.status === "failed" || target.status === "action_required") {
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

function getYouTubePublicationActivityDate(target: ScheduledPostTarget) {
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
