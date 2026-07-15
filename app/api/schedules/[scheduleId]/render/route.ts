import { NextResponse } from "next/server";

import {
  getMissingSqsEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/aws/sqs";
import {
  attachAwsMessageToBackgroundJob,
  createBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";
import {
  getLatestReadyMediaAssetForParent,
  getMediaAssetForOwner,
  getMissingMediaStorageEnvVars,
  type MediaAssetRow,
} from "@/lib/media/media-storage";
import {
  getDemoVideo,
  isDemoVideoStorageConfigured,
} from "@/lib/demo/demo-storage";
import type { MediaRatio } from "@/lib/media/types";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMissingScheduleDbEnvVars,
  getScheduledPostForUser,
  updateScheduledPostRenderState,
} from "@/lib/scheduling/db";
import { isTrustedStorageUrl } from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMBINATION_RENDER_JOB_TYPE = "render_schedule_combination";
const videoRatios = new Set<MediaRatio>(["9:16", "1:1", "4:5", "16:9"]);
type CombinationRenderRatio = "9:16" | "1:1" | "4:5" | "16:9";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error, "Sign in before rendering this schedule.");
  }

  const missingRuntimeEnv = Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingMediaStorageEnvVars(),
      ...getMissingScheduleDbEnvVars(),
      ...getMissingSqsEnvVars([COMBINATION_RENDER_JOB_TYPE]),
    ]),
  );

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Combination rendering is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
      },
      501,
    );
  }

  const { scheduleId } = await params;
  const schedule = await getScheduledPostForUser({
    postId: scheduleId,
    userId,
  });

  if (!schedule) {
    return jsonResponse(
      {
        ok: false,
        message: "This schedule was not found.",
      },
      404,
    );
  }

  const metadata = schedule.metadata;
  const existingStatus = getString(metadata.combinedRenderStatus);

  if (
    (existingStatus === "queued" || existingStatus === "rendering") &&
    getString(metadata.combinedRenderJobId)
  ) {
    return jsonResponse({
      jobId: getString(metadata.combinedRenderJobId),
      ok: true,
      schedule,
      status: existingStatus,
    });
  }

  const hookMediaId = getString(metadata.hookMediaId);
  const demoMediaId = getString(metadata.demoMediaId) ?? schedule.mediaAssetId;

  if (!hookMediaId || !demoMediaId) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose one opening video and one demo video before rendering.",
      },
      409,
    );
  }

  const [hookAsset, demoAsset] = await Promise.all([
    getMediaAssetForOwner({ assetId: hookMediaId, userId }),
    getMediaAssetForOwner({ assetId: demoMediaId, userId }),
  ]);

  if (!hookAsset || !isHookAsset(hookAsset)) {
    return jsonResponse(
      {
        ok: false,
        message: "The selected opening video is no longer available.",
      },
      404,
    );
  }

  if (!demoAsset || !isDemoAsset(demoAsset)) {
    return jsonResponse(
      {
        ok: false,
        message: "The selected Library demo is no longer available.",
      },
      404,
    );
  }

  if (
    !isTrustedStorageUrl(hookAsset.url) ||
    !isTrustedStorageUrl(demoAsset.url)
  ) {
    return jsonResponse(
      {
        ok: false,
        message: "Both videos must be app-owned S3 or CloudFront assets.",
      },
      400,
    );
  }

  const projectId =
    schedule.projectId ?? demoAsset.project_id ?? hookAsset.project_id ?? "schedule";
  const [resolvedHookAsset, resolvedDemoAsset] = await Promise.all([
    resolveOpeningRenderAsset({
      asset: hookAsset,
      userId,
    }),
    resolveDemoRenderAsset({
      asset: demoAsset,
      projectId,
      userId,
    }),
  ]);

  if (!resolvedHookAsset.ok) {
    return jsonResponse(
      {
        ok: false,
        message: resolvedHookAsset.message,
      },
      409,
    );
  }

  if (!resolvedDemoAsset.ok) {
    return jsonResponse(
      {
        ok: false,
        message: resolvedDemoAsset.message,
      },
      409,
    );
  }

  if (
    !isTrustedStorageUrl(resolvedHookAsset.asset.url) ||
    !isTrustedStorageUrl(resolvedDemoAsset.asset.url)
  ) {
    return jsonResponse(
      {
        ok: false,
        message: "Rendered videos must be app-owned S3 or CloudFront assets.",
      },
      400,
    );
  }

  const combinedMediaAssetId = getString(metadata.combinedMediaAssetId);

  if (existingStatus === "ready" && combinedMediaAssetId) {
    const combinedAsset = await getMediaAssetForOwner({
      assetId: combinedMediaAssetId,
      userId,
    });

    if (
      combinedAsset &&
      getStringFromValue(getObjectValue(combinedAsset.metadata, "hookVideoId")) ===
        resolvedHookAsset.asset.id &&
      getStringFromValue(getObjectValue(combinedAsset.metadata, "demoVideoId")) ===
        resolvedDemoAsset.asset.id
    ) {
      return jsonResponse({
        jobId: getString(metadata.combinedRenderJobId),
        ok: true,
        schedule,
        status: "ready",
      });
    }
  }

  const renderId = crypto.randomUUID();
  const title = `${schedule.title || "Scheduled post"} combined`.slice(0, 140);
  const input = {
    demoVideoId: resolvedDemoAsset.asset.id,
    demoVideoUrl: resolvedDemoAsset.asset.url,
    hookVideoId: resolvedHookAsset.asset.id,
    hookVideoUrl: resolvedHookAsset.asset.url,
    projectId,
    ratio: getRenderRatio(resolvedDemoAsset.asset, resolvedHookAsset.asset),
    renderId,
    scheduleId: schedule.id,
    title,
    userId,
  };

  let backgroundJob;

  try {
    backgroundJob = await createBackgroundJob({
      input,
      jobType: COMBINATION_RENDER_JOB_TYPE,
      projectId,
      queueName: getQueueNameForJobType(COMBINATION_RENDER_JOB_TYPE),
      userId,
    });

    const queuedSchedule = await updateScheduledPostRenderState({
      metadata: {
        combinedRenderError: null,
        combinedRenderId: renderId,
        combinedRenderJobId: backgroundJob.id,
        combinedRenderQueuedAt: new Date().toISOString(),
        combinedRenderStatus: "queued",
      },
      postId: schedule.id,
      userId,
    });

    const message = await sendJobMessage({
      jobId: backgroundJob.id,
      jobType: COMBINATION_RENDER_JOB_TYPE,
    });
    const updatedJob = await attachAwsMessageToBackgroundJob({
      awsMessageId: message.messageId,
      jobId: backgroundJob.id,
    });

    return jsonResponse({
      jobId: updatedJob.id,
      ok: true,
      renderId,
      schedule: queuedSchedule ?? schedule,
      status: "queued",
    });
  } catch (error) {
    console.error("Failed to queue schedule combination render:", error);

    if (backgroundJob) {
      try {
        await markBackgroundJobFailed({
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to queue combination render.",
          jobId: backgroundJob.id,
        });
      } catch (persistenceError) {
        console.error(
          "Failed to persist combination render queue failure:",
          persistenceError,
        );
      }
    }

    try {
      await updateScheduledPostRenderState({
        lastErrorCode: "combination_render_queue_failed",
        metadata: {
          combinedRenderError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Failed to queue combination render.",
          combinedRenderId: renderId,
          combinedRenderStatus: "failed",
        },
        postId: schedule.id,
        userId,
      });
    } catch (persistenceError) {
      console.error(
        "Failed to persist schedule combination render failure:",
        persistenceError,
      );
    }

    return jsonResponse(
      {
        ok: false,
        message: "Could not queue the combined video render.",
      },
      500,
    );
  }
}

function authErrorResponse(error: unknown, unauthorizedMessage: string) {
  if (error instanceof FirebaseAuthRequestError) {
    return jsonResponse(
      {
        ok: false,
        message: error.status === 401 ? unauthorizedMessage : error.message,
      },
      error.status,
    );
  }

  console.error("Failed to verify schedule render requester:", error);
  return jsonResponse(
    {
      ok: false,
      message: "Could not verify your sign-in session.",
    },
    500,
  );
}

function isHookAsset(asset: MediaAssetRow) {
  return (
    asset.status === "ready" &&
    (asset.collection === "influencer" ||
      (asset.collection === "video" &&
        ["upload", "generated_video", "edit_export"].includes(asset.source_type)))
  );
}

function isDemoAsset(asset: MediaAssetRow) {
  return (
    asset.status === "ready" &&
    asset.collection === "video" &&
    asset.source_type === "demo_upload"
  );
}

async function resolveOpeningRenderAsset(params: {
  asset: MediaAssetRow;
  userId: string;
}): Promise<RenderAssetResolution> {
  if (params.asset.source_type === "edit_export") {
    return { asset: params.asset, ok: true };
  }

  const latestExport = await getLatestReadyMediaAssetForParent({
    parentAssetId: params.asset.id,
    sourceType: "edit_export",
    userId: params.userId,
  });

  if (latestExport && isFreshForAssetDraft(params.asset, latestExport)) {
    return { asset: latestExport, ok: true };
  }

  if (hasMeaningfulDraftEdits(params.asset.metadata)) {
    return {
      ok: false,
      message:
        "Export the selected opening video from Edit before scheduling so saved text and trim edits are included.",
    };
  }

  return { asset: params.asset, ok: true };
}

async function resolveDemoRenderAsset(params: {
  asset: MediaAssetRow;
  projectId: string;
  userId: string;
}): Promise<RenderAssetResolution> {
  const latestExport = await getLatestReadyMediaAssetForParent({
    parentAssetId: params.asset.id,
    sourceType: "edit_export",
    userId: params.userId,
  });
  const demo = await getDemoForAsset(params);

  if (latestExport && (!demo || isFreshForDemoDraft(demo, latestExport))) {
    return { asset: latestExport, ok: true };
  }

  if (demo && hasMeaningfulDraftEdits(demo.draft_json)) {
    return {
      ok: false,
      message:
        "Export the selected demo from Demos before scheduling so saved text and trim edits are included.",
    };
  }

  return { asset: params.asset, ok: true };
}

type RenderAssetResolution =
  | {
      asset: MediaAssetRow;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

async function getDemoForAsset(params: {
  asset: MediaAssetRow;
  projectId: string;
  userId: string;
}) {
  if (!isDemoVideoStorageConfigured()) {
    return null;
  }

  const demoId = getStringFromValue(params.asset.source_record_id) ??
    getStringFromValue(getObjectValue(params.asset.metadata, "demoId"));

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

function isFreshForAssetDraft(sourceAsset: MediaAssetRow, exportAsset: MediaAssetRow) {
  const draft = getDraftRecord(sourceAsset.metadata);
  const draftUpdatedAt = getStringFromValue(draft?.updatedAt);

  if (!draftUpdatedAt) {
    return true;
  }

  return new Date(exportAsset.updated_at).getTime() >=
    new Date(draftUpdatedAt).getTime();
}

function isFreshForDemoDraft(
  demo: { latest_render_id: string | null; updated_at: string },
  exportAsset: MediaAssetRow,
) {
  if (demo.latest_render_id) {
    return exportAsset.source_record_id === demo.latest_render_id;
  }

  return new Date(exportAsset.updated_at).getTime() >=
    new Date(demo.updated_at).getTime();
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

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getObjectValue(value: unknown, key: string) {
  return getRecord(value)?.[key];
}

function getStringFromValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumberFromValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function getRenderRatio(
  demoAsset: MediaAssetRow,
  hookAsset: MediaAssetRow,
): CombinationRenderRatio {
  if (videoRatios.has(demoAsset.ratio)) {
    return demoAsset.ratio as CombinationRenderRatio;
  }

  if (videoRatios.has(hookAsset.ratio)) {
    return hookAsset.ratio as CombinationRenderRatio;
  }

  return "9:16";
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
