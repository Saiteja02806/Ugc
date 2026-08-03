import "server-only";

import {
  findDemoVideo,
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
import {
  hasMeaningfulDraftEdits,
  isDemoRenderCurrent,
  isOpeningRenderCurrent,
} from "@/lib/scheduling/render-asset-policy";

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
      status: 404 | 409 | 503;
    };

export async function resolveOpeningRenderAsset(params: {
  asset: MediaAssetRow;
  userId: string;
}): Promise<RenderAssetResolution> {
  if (params.asset.source_type === "edit_export") {
    return { asset: params.asset, ok: true };
  }

  let savedEdit: Awaited<ReturnType<typeof getSavedEditRenderAsset>>;

  try {
    savedEdit = await getSavedEditRenderAsset({
      asset: params.asset,
      userId: params.userId,
    });
  } catch (error) {
    console.error("Could not verify saved opening clip before scheduling:", error);

    return {
      message:
        "We could not verify the latest saved opening clip. Try again before scheduling.",
      ok: false,
      status: 503,
    };
  }

  if (
    savedEdit?.asset &&
    isOpeningRenderCurrent({
      draftSources: [savedEdit.draft, params.asset.metadata],
      outputUpdatedAt: savedEdit.asset.updated_at,
    })
  ) {
    return { asset: savedEdit.asset, ok: true };
  }

  const openingHasEdits =
    hasMeaningfulDraftEdits(savedEdit?.draft) ||
    hasMeaningfulDraftEdits(params.asset.metadata);

  if (savedEdit?.status === "queued" || savedEdit?.status === "rendering") {
    return {
      ok: false,
      message:
        "Save is still in progress for the selected opening clip. Wait until it shows Saved before scheduling.",
      status: 409,
    };
  }

  if (savedEdit?.status === "failed") {
    return {
      ok: false,
      message:
        "Save failed for the selected opening clip. Save it again before scheduling.",
      status: 409,
    };
  }

  if (savedEdit?.status === "ready" || savedEdit?.status === "draft") {
    if (openingHasEdits) {
      return {
        ok: false,
        message:
          "Edit and save the selected opening clip in Creative Assets before scheduling so text and trim changes are included.",
        status: 409,
      };
    }

    return { asset: params.asset, ok: true };
  }

  let latestLegacyExport: Awaited<
    ReturnType<typeof getLatestReadyMediaAssetForParent>
  >;

  try {
    latestLegacyExport = await getLatestReadyMediaAssetForParent({
      parentAssetId: params.asset.id,
      sourceType: "edit_export",
      userId: params.userId,
    });
  } catch (error) {
    console.error("Could not verify opening clip exports before scheduling:", error);

    return {
      message:
        "We could not verify the latest saved opening clip. Try again before scheduling.",
      ok: false,
      status: 503,
    };
  }

  if (
    latestLegacyExport &&
    isOpeningRenderCurrent({
      draftSources: [savedEdit?.draft, params.asset.metadata],
      outputUpdatedAt: latestLegacyExport.updated_at,
    })
  ) {
    return { asset: latestLegacyExport, ok: true };
  }

  if (
    savedEdit?.status === "unresolved" ||
    savedEdit?.status === "rendered" ||
    latestLegacyExport
  ) {
    return {
      ok: false,
      message:
        "The latest saved opening clip could not be resolved. Open it from Creative Assets and save it again.",
      status: 409,
    };
  }

  if (openingHasEdits) {
    return {
      ok: false,
      message:
        "Edit and save the selected opening clip in Creative Assets before scheduling so text and trim changes are included.",
      status: 409,
    };
  }

  return { asset: params.asset, ok: true };
}

export async function resolveDemoRenderAsset(params: {
  asset: MediaAssetRow;
  projectId: string;
  userId: string;
}): Promise<RenderAssetResolution> {
  const demoLookup = await getDemoForAsset(params);

  if (demoLookup.kind === "missing") {
    return {
      message:
        "The selected scheduled video is no longer available. Choose another video.",
      ok: false,
      status: 404,
    };
  }

  if (demoLookup.kind === "unavailable") {
    return {
      message:
        "We could not verify the selected scheduled video right now. Try again before scheduling.",
      ok: false,
      status: 503,
    };
  }

  const demo = demoLookup.demo;
  const savedDemo = getSavedDemoRenderAsset(params.asset, demo);

  if (
    savedDemo &&
    isDemoRenderCurrent({
      latestRenderId: demo.latest_render_id,
      outputSourceRecordId: savedDemo.source_record_id,
    })
  ) {
    return { asset: savedDemo, ok: true };
  }

  if (demo.status === "rendering") {
    return {
      ok: false,
      message:
        "Save is still in progress for the selected scheduled video. Wait until it shows Saved before scheduling.",
      status: 409,
    };
  }

  if (demo.status === "failed") {
    return {
      ok: false,
      message:
        "Save failed for the selected scheduled video. Save it again before scheduling.",
      status: 409,
    };
  }

  if (demo.status === "uploading" || demo.status === "processing") {
    return {
      ok: false,
      message:
        "The selected scheduled video is still being prepared. Wait until it is ready before scheduling.",
      status: 409,
    };
  }

  if (demo.status === "ready" || demo.status === "draft") {
    if (hasMeaningfulDraftEdits(demo.draft_json)) {
      return {
        ok: false,
        message:
          "Save the selected scheduled video before scheduling so saved text and trim edits are included.",
        status: 409,
      };
    }

    return { asset: params.asset, ok: true };
  }

  let latestLegacyExport: Awaited<
    ReturnType<typeof getLatestReadyMediaAssetForParent>
  >;

  try {
    latestLegacyExport = await getLatestReadyMediaAssetForParent({
      parentAssetId: params.asset.id,
      sourceType: "edit_export",
      userId: params.userId,
    });
  } catch (error) {
    console.error(
      "Could not verify scheduled video exports before scheduling:",
      error,
    );

    return {
      message:
        "We could not verify the selected scheduled video right now. Try again before scheduling.",
      ok: false,
      status: 503,
    };
  }

  if (
    latestLegacyExport &&
    isDemoRenderCurrent({
      latestRenderId: demo.latest_render_id,
      outputSourceRecordId: latestLegacyExport.source_record_id,
    })
  ) {
    return { asset: latestLegacyExport, ok: true };
  }

  if (demo.status === "rendered" || latestLegacyExport) {
    return {
      ok: false,
      message:
        "The latest saved scheduled video could not be resolved. Open the video and save it again.",
      status: 409,
    };
  }

  return {
    ok: false,
    message:
      "The selected scheduled video is not ready to schedule. Choose it again.",
    status: 409,
  };
}

async function getSavedEditRenderAsset(params: {
  asset: MediaAssetRow;
  userId: string;
}) {
  if (!isEditRenderPersistenceConfigured()) {
    throw new Error("Edit render persistence is not configured.");
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

  if (!latestRender) {
    return {
      draft: editableVideo.draft,
      status: "unresolved" as const,
    };
  }

  if (latestRender.status !== "completed") {
    return {
      draft: editableVideo.draft,
      status: latestRender.status,
    };
  }

  const renderedUrl = getString(latestRender.output_url);

  if (!renderedUrl) {
    return {
      draft: editableVideo.draft,
      status: "unresolved" as const,
    };
  }

  const renderId = getString(latestRender.render_id);
  const updatedAt =
    getString(latestRender.completed_at) ??
    getString(latestRender.updated_at) ??
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
    return { kind: "unavailable" as const };
  }

  const demoId =
    getString(params.asset.source_record_id) ??
    getString(getObjectValue(params.asset.metadata, "demoId"));

  if (!demoId) {
    return { kind: "missing" as const };
  }

  try {
    const demo = await findDemoVideo({
      demoId,
      projectId: params.asset.project_id ?? params.projectId,
      userId: params.userId,
    });

    return demo
      ? { demo, kind: "found" as const }
      : { kind: "missing" as const };
  } catch (error) {
    console.error("Could not load demo draft before schedule render:", error);
    return { kind: "unavailable" as const };
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
