import type { TrendingFeedFormat } from "@/lib/trending/feed-items";

export type TrendingDecisionOutboxEntry = {
  assignmentId: string;
  creativeId: string;
  decision: "accepted" | "rejected";
  format: TrendingFeedFormat;
  queuedAt: string;
};

const STORAGE_PREFIX = "ugc:trending-decision-outbox:v1";

export function getTrendingDecisionOutboxKey(userId: string) {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}`;
}

export function parseTrendingDecisionOutbox(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isTrendingDecisionOutboxEntry);
  } catch {
    return [];
  }
}

export function upsertTrendingDecisionOutboxEntry(
  entries: readonly TrendingDecisionOutboxEntry[],
  entry: TrendingDecisionOutboxEntry,
) {
  return [
    ...entries.filter(
      (candidate) => candidate.assignmentId !== entry.assignmentId,
    ),
    entry,
  ];
}

export function removeTrendingDecisionOutboxEntry(
  entries: readonly TrendingDecisionOutboxEntry[],
  assignmentId: string,
) {
  return entries.filter((entry) => entry.assignmentId !== assignmentId);
}

function isTrendingDecisionOutboxEntry(
  value: unknown,
): value is TrendingDecisionOutboxEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<TrendingDecisionOutboxEntry>;

  return (
    typeof entry.assignmentId === "string" &&
    Boolean(entry.assignmentId) &&
    typeof entry.creativeId === "string" &&
    Boolean(entry.creativeId) &&
    (entry.decision === "accepted" || entry.decision === "rejected") &&
    (entry.format === "carousel" ||
      entry.format === "hook_video" ||
      entry.format === "wall_text" ||
      entry.format === "reaction") &&
    typeof entry.queuedAt === "string" &&
    Boolean(entry.queuedAt)
  );
}
