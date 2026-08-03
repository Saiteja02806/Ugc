export type DemoDisplayStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "draft"
  | "rendering"
  | "rendered"
  | "failed";

type DemoPlaybackRecord = {
  rendered_video_url: string | null;
  source_video_url: string;
  status: DemoDisplayStatus;
};

const playableSourceStatuses = new Set<DemoDisplayStatus>([
  "ready",
  "draft",
  "rendering",
  "rendered",
]);

const activeDemoStatuses = new Set<DemoDisplayStatus>([
  "uploading",
  "processing",
  "rendering",
]);

export function getDemoPlaybackUrl(demo: DemoPlaybackRecord) {
  const renderedVideoUrl = getCurrentDemoRenderedVideoUrl(demo);

  if (renderedVideoUrl) {
    return renderedVideoUrl;
  }

  if (playableSourceStatuses.has(demo.status) && demo.source_video_url.trim()) {
    return demo.source_video_url.trim();
  }

  return null;
}

export function getCurrentDemoRenderedVideoUrl(demo: DemoPlaybackRecord) {
  if (demo.status !== "rendered") {
    return null;
  }

  return demo.rendered_video_url?.trim() || null;
}

export function isActiveDemoStatus(status: DemoDisplayStatus) {
  return activeDemoStatuses.has(status);
}
