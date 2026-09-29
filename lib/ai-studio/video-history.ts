import type { AIStudioVideoResult } from "./media-results.ts";

export type VideoHistoryGroup = {
  label: string;
  videos: AIStudioVideoResult[];
};

export function filterAIStudioVideoHistory(
  videos: AIStudioVideoResult[],
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return videos;
  }

  return videos.filter((video) =>
    [video.prompt, video.title, video.modelLabel ?? "", video.resolution ?? ""]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

export function groupAIStudioVideoHistory(
  videos: AIStudioVideoResult[],
  now = new Date(),
): VideoHistoryGroup[] {
  const groups = new Map<string, AIStudioVideoResult[]>();

  for (const video of videos) {
    const label = getVideoHistoryDateLabel(video.createdAt, now);
    const current = groups.get(label) ?? [];
    current.push(video);
    groups.set(label, current);
  }

  return Array.from(groups, ([label, groupedVideos]) => ({
    label,
    videos: groupedVideos,
  }));
}

export function getVideoHistoryDateLabel(value: string, now = new Date()) {
  const createdAt = new Date(value);

  if (Number.isNaN(createdAt.getTime())) {
    return "Earlier";
  }

  const today = startOfDay(now);
  const createdDay = startOfDay(createdAt);
  const elapsedDays = Math.round(
    (today.getTime() - createdDay.getTime()) / (24 * 60 * 60 * 1_000),
  );

  if (elapsedDays === 0) {
    return "Today";
  }

  if (elapsedDays === 1) {
    return "Yesterday";
  }

  if (elapsedDays >= 2 && elapsedDays <= 7) {
    return "Last week";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: createdAt.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(createdAt);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
