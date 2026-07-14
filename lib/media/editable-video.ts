import {
  createEditableVideo,
  normalizeEditableVideoDraftInput,
  type EditableVideo,
  type EditableVideoDraft,
  type EditableVideoSource,
} from "@/lib/edit/video-library";
import type { MediaAsset } from "@/lib/media/types";

export function mediaAssetToEditableVideo(asset: MediaAsset): EditableVideo {
  const draft = getDraft(asset.metadata.draft);

  return createEditableVideo({
    createdAt: asset.createdAt,
    draft,
    durationSeconds: asset.durationSeconds,
    id: asset.id,
    projectId: asset.projectId,
    ratio: asset.ratio === "other" ? "9:16" : asset.ratio,
    renderedVideoUrl: asset.sourceType === "edit_export" ? asset.url : null,
    source: getSource(asset),
    status: asset.sourceType === "edit_export" ? "rendered" : draft ? "draft" : "ready",
    thumbnailUrl: asset.thumbnailUrl,
    title: asset.title,
    videoUrl: asset.url,
  });
}

function getDraft(value: unknown): EditableVideoDraft | null {
  const draft = normalizeEditableVideoDraftInput(value);

  if (!draft || !value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const updatedAt = (value as Record<string, unknown>).updatedAt;

  return {
    ...draft,
    updatedAt: typeof updatedAt === "string" ? updatedAt : new Date().toISOString(),
  };
}

function getSource(asset: MediaAsset): EditableVideoSource {
  if (asset.sourceType === "generated_video") {
    return "hook";
  }

  if (asset.sourceType === "edit_export") {
    return "final";
  }

  return "demo";
}
