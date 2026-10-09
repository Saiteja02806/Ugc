import type { AIStudioImageResult } from "./media-results.ts";

export type ImageHistoryGroup = {
  label: string;
  images: AIStudioImageResult[];
};

export function getTodayAIStudioImages(images: AIStudioImageResult[], now = new Date()) {
  const today = startOfDay(now).getTime();
  return images.filter((image) => startOfDay(new Date(image.createdAt)).getTime() === today);
}

export function filterAIStudioImageHistory(images: AIStudioImageResult[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return images;

  return images.filter((image) =>
    [image.title, image.aspectRatio].join(" ").toLocaleLowerCase().includes(normalizedQuery),
  );
}

export function groupAIStudioImageHistory(
  images: AIStudioImageResult[],
  now = new Date(),
): ImageHistoryGroup[] {
  const groups = new Map<string, AIStudioImageResult[]>();

  for (const image of images) {
    const label = getImageHistoryDateLabel(image.createdAt, now);
    const current = groups.get(label) ?? [];
    current.push(image);
    groups.set(label, current);
  }

  return Array.from(groups, ([label, groupedImages]) => ({ label, images: groupedImages }));
}

export function getImageHistoryDateLabel(value: string, now = new Date()) {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return "Earlier";

  const elapsedDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(createdAt).getTime()) / (24 * 60 * 60 * 1_000),
  );
  if (elapsedDays === 0) return "Today";
  if (elapsedDays === 1) return "Yesterday";
  if (elapsedDays >= 2 && elapsedDays <= 7) return "Last week";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: createdAt.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(createdAt);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
