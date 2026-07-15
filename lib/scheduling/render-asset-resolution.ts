import "server-only";

import {
  getDemoVideo,
  isDemoVideoStorageConfigured,
  type DemoVideoRow,
} from "@/lib/demo/demo-storage";
import {
  getEditableVideoForOwner,
  getLatestEditableVideoRenderForOwner,
  isEditRenderPersistenceConfigured,
} from "@/lib/edit/render-storage";
import {
  getLatestReadyMediaAssetForParent,
  type MediaAssetRow,
} from "@/lib/media/media-storage";
import type { MediaRatio } from "@/lib/media/types";

export type RenderableScheduleAsset = Pick<
  MediaAssetRow,
  "id" | "metadata" | "ratio" | "source_record_id" | "updated_at" | "url"
>;

export type RenderAssetResolution =
  | {
      asset: RenderableScheduleAsset;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

export async function resolveOpeningRenderAsset(params: {
  asset: MediaAssetRow;
  userId: string;
}): Promise<RenderAssetResolution> {
  if (params.asset.source_type === "edit_export") {
    return { asset: params.asset, ok: true };
  }

  const savedEdit = await getSavedEditRenderAsset({
    asset: params.asset,
    userId: params.userId,
  });

  if (savedEdit?.asset && isFreshForAssetDraft(params.asset, savedEdit.asset)) {
    return { asset: savedEdit.asset, ok: true };
  }

  const latestLegacyExport = await getLatestReadyMediaAssetForParent({
    parentAssetId: params.asset.id,
    sourceType: "edit_export",
    userId: params.userId,
  });

  if (
    latestLegacyExport &&
    isFreshForAssetDraft(params.asset, latestLegacyExport)
  ) {
    return { asset: latestLegacyExport, ok: true };
  }

  if (savedEdit?.status === "rendering") {
    return {
      ok: false,
      message:
        "Save is still in progress for the selected opening video. Wait until it shows Saved before scheduling.",
    };
  }

  if (savedEdit?.status === "failed") {
    return {
      ok: false,
      message:
        "Save failed for the selected opening video. Save it again before scheduling.",
    };
  }

  if (
    hasMeaningfulDraftEdits(savedEdit?.draft) ||
    hasMeaningfulDraftEdits(params.asset.metadata)
  ) {
    return {
      ok: false,
      message:
        "Save the selected opening video in Edit before scheduling so saved text and trim edits are included.",
    };
  }

  return { asset: params.asset, ok: true };
}

export async function resolveDemoRenderAsset(params: {
  asset: MediaAssetRow;
  projectId: string;
  userId: string;
}): Promise<RenderAssetResolution> {
  const demo = await getDemoForAsset(params);
  const savedDemo = demo ? getSavedDemoRenderAsset(params.asset, demo) : null;

  if (savedDemo && (!demo || isFreshForDemoDraft(demo, savedDemo))) {
    return { asset: savedDemo, ok: true };
  }

  const latestLegacyExport = await getLatestReadyMediaAssetForParent({
    parentAssetId: params.asset.id,
    sourceType: "edit_export",
    userId: params.userId,
  });

  if (
    latestLegacyExport &&
    (!demo || isFreshForDemoDraft(demo, latestLegacyExport))
  ) {
    return { asset: latestLegacyExport, ok: true };
  }

  if (demo?.status === "rendering") {
    return {
      ok: false,
      message:
        "Save is still in progress for the selected demo. Wait until it shows Saved before scheduling.",
    };
  }

  if (demo?.status === "failed") {
    return {
      ok: false,
      message: "Save failed for the selected demo. Save it again before scheduling.",
    };
  }

  if (demo && hasMeaningfulDraftEdits(demo.draft_json)) {
    return {
      ok: false,
      message:
        "Save the selected demo before scheduling so saved text and trim edits are included.",
    };
  }

  return { asset: params.asset, ok: true };
}

async function getSavedEditRenderAsset(params: {
  asset: MediaAssetRow;
  userId: string;
}) {
  if (!isEditRenderPersistenceConfigured()) {
    return null;
  }

  const [editableVideo, latestRender] = await Promise.all([
    getEditableVideoForOwner({
      sourceVideoId: params.asset.id,
      userId: params.userId,
    }),
    getLatestEditableVideoRenderForOwner({
      sourceVideoId: params.asset.id,
      userId: params.userId,
    }),
  ]);

  if (!editableVideo) {
    return null;
  }

  if (editableVideo.status !== "rendered") {
    return {
      draft: editableVideo.draft,
      status: editableVideo.status,
    };
  }

  if (latestRender && latestRender.status !== "completed") {
    return {
      draft: editableVideo.draft,
      status: latestRender.status,
    };
  }

  const renderedUrl =
    getString(latestRender?.output_url) ?? getString(editableVideo.renderedVideoUrl);

  if (!renderedUrl) {
    return {
      draft: editableVideo.draft,
      status: editableVideo.status,
    };
  }

  const renderId = getString(latestRender?.render_id);
  const updatedAt =
    getString(latestRender?.completed_at) ??
    getString(latestRender?.updated_at) ??
    getString(editableVideo.draft?.updatedAt) ??
    getString(editableVideo.createdAt) ??
    params.asset.updated_at;

  return {
    asset: {
      id: `edit:${params.asset.id}:${renderId ?? updatedAt}`,
      metadata: params.asset.metadata,
      ratio: editableVideo.ratio,
      source_record_id: renderId,
      updated_at: updatedAt,
      url: renderedUrl,
    } satisfies RenderableScheduleAsset,
    draft: editableVideo.draft,
    status: editableVideo.status,
  };
}

async function getDemoForAsset(params: {
  asset: MediaAssetRow;
  projectId: string;
  userId: string;
}) {
  if (!isDemoVideoStorageConfigured()) {
    return null;
  }

  const demoId =
    getString(params.asset.source_record_id) ??
    getString(getObjectValue(params.asset.metadata, "demoId"));

  if (!demoId) {
    return null;
  }

  try {
    return await getDemoVideo({
      demoId,
      projectId: params.asset.project_id ?? params.projectId,
      userId: params.userId,
    });
  } catch (error) {
    console.error("Could not load demo draft before schedule render:", error);
    return null;
  }
}

function getSavedDemoRenderAsset(
  sourceAsset: MediaAssetRow,
  demo: DemoVideoRow,
): RenderableScheduleAsset | null {
  const renderedUrl = getString(demo.rendered_video_url);

  if (demo.status !== "rendered" || !renderedUrl) {
    return null;
  }

  const renderId = getString(demo.latest_render_id);

  return {
    id: `demo:${sourceAsset.id}:${renderId ?? demo.updated_at}`,
    metadata: sourceAsset.metadata,
    ratio: normalizeMediaRatio(demo.ratio, sourceAsset.ratio),
    source_record_id: renderId,
    updated_at: demo.updated_at,
    url: renderedUrl,
  };
}

function isFreshForAssetDraft(
  sourceAsset: MediaAssetRow,
  outputAsset: RenderableScheduleAsset,
) {
  const draft = getDraftRecord(sourceAsset.metadata);
  const draftUpdatedAt = getString(draft?.updatedAt);

  if (!draftUpdatedAt) {
    return true;
  }

  return (
    new Date(outputAsset.updated_at).getTime() >=
    new Date(draftUpdatedAt).getTime()
  );
}

function isFreshForDemoDraft(
  demo: { latest_render_id: string | null; updated_at: string },
  outputAsset: RenderableScheduleAsset,
) {
  if (demo.latest_render_id) {
    return outputAsset.source_record_id === demo.latest_render_id;
  }

  return (
    new Date(outputAsset.updated_at).getTime() >=
    new Date(demo.updated_at).getTime()
  );
}

function hasMeaningfulDraftEdits(value: unknown) {
  const draft = getDraftRecord(value);

  if (!draft) {
    return false;
  }

  const trimStartSeconds = getNumberFromValue(draft.trimStartSeconds);
  const trimEndSeconds = getNumberFromValue(draft.trimEndSeconds);

  return (
    (trimStartSeconds ?? 0) > 0 ||
    trimEndSeconds !== null ||
    getTextOverlayCount(draft.textOverlays) > 0
  );
}

function getDraftRecord(value: unknown) {
  const record = getRecord(value);
  const nestedDraft = getRecord(record?.draft);

  return nestedDraft ?? record;
}

function getTextOverlayCount(value: unknown) {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.filter((overlay) => {
    const record = getRecord(overlay);

    return typeof record?.text === "string" && record.text.trim().length > 0;
  }).length;
}

function normalizeMediaRatio(value: unknown, fallback: MediaRatio): MediaRatio {
  return value === "9:16" ||
    value === "1:1" ||
    value === "4:5" ||
    value === "16:9" ||
    value === "other"
    ? value
    : fallback;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getObjectValue(value: unknown, key: string) {
  return getRecord(value)?.[key];
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumberFromValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
