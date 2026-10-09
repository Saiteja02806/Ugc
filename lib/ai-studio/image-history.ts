import type { AIStudioImageResult } from "./media-results.ts";
import { getAIStudioSessionResults, isAIStudioSessionCompletion } from "./generation-session.ts";

export type ImageHistoryGroup = {
  label: string;
  images: AIStudioImageResult[];
};

export function mergeAIStudioImageHistory(
  loadedImages: AIStudioImageResult[],
  reconciledImages: readonly AIStudioImageResult[],
) {
  const loadedIds = new Set(loadedImages.map((image) => image.id));
  const recoveredById = new Map(reconciledImages.map((image) => [image.id, image]));
  return [
    ...reconciledImages.filter((image) => !loadedIds.has(image.id)),
    ...loadedImages.map((image) => {
      const recoveredPrompt = recoveredById.get(image.id)?.prompt;
      return recoveredPrompt ? { ...image, prompt: recoveredPrompt } : image;
    }),
  ];
}

export function isImageCompletionForeground(
  jobId: string,
  completionEpoch: number,
  currentEpoch: number,
  foregroundJobIds: ReadonlySet<string>,
) {
  return isAIStudioSessionCompletion(jobId, completionEpoch, currentEpoch, foregroundJobIds);
}

export function getVisibleAIStudioImages(
  images: AIStudioImageResult[],
  currentResultIds: readonly string[],
  selectedHistoryImageId: string | null,
) {
  return getAIStudioSessionResults(images, currentResultIds, selectedHistoryImageId);
}

export function filterAIStudioImageHistory(
  images: AIStudioImageResult[],
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return images;

  return images.filter((image) =>
    [image.title, image.prompt ?? "", image.aspectRatio].join(" ").toLocaleLowerCase().includes(normalizedQuery),
  );
}

export function groupAIStudioImageHistory(
  images: AIStudioImageResult[],
  now = new Date(),
): ImageHistoryGroup[] {
  const sortedImages = [...images].sort((left, right) =>
    validDateTime(right.createdAt) - validDateTime(left.createdAt),
  );
  const groups = new Map<string, AIStudioImageResult[]>();

  for (const image of sortedImages) {
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

function validDateTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}
