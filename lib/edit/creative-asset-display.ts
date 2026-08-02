import type { EditableVideo, EditableVideoStatus } from "@/lib/edit/video-library";

export type CreativeAssetDisplayStatus = EditableVideoStatus | "ready";

export function getCreativeAssetDisplayState(
  assetUrl: string,
  editProject: EditableVideo | null | undefined,
) {
  const renderedVideoUrl = editProject?.renderedVideoUrl?.trim() || null;

  return {
    isRendering: editProject?.status === "rendering",
    playbackUrl: renderedVideoUrl || assetUrl,
    status: editProject?.status ?? ("ready" as const),
  };
}

export function hasRenderingEditProjects(projects: Iterable<EditableVideo>) {
  for (const project of projects) {
    if (project.status === "rendering") {
      return true;
    }
  }

  return false;
}

export function indexLatestEditProjectsByAssetId(
  projectsNewestFirst: Iterable<EditableVideo>,
) {
  const projectsByAssetId = new Map<string, EditableVideo>();

  for (const project of projectsNewestFirst) {
    if (!projectsByAssetId.has(project.id)) {
      projectsByAssetId.set(project.id, project);
    }
  }

  return projectsByAssetId;
}
