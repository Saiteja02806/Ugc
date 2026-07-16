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
  getMediaAssetForOwner,
  getMissingMediaStorageEnvVars,
  type MediaAssetRow,
} from "@/lib/media/media-storage";
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
import {
  resolveDemoRenderAsset,
  resolveOpeningRenderAsset,
  type RenderableScheduleAsset,
} from "@/lib/scheduling/render-asset-resolution";
import { isTrustedStorageUrl } from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMBINATION_RENDER_JOB_TYPE = "render_schedule_combination";
const videoRatios = new Set<MediaRatio>(["9:16", "1:1", "4:5", "16:9"]);
const scheduledVideoSourceTypes = new Set([
  "demo_upload",
  "upload",
  "generated_video",
  "edit_export",
]);
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
    return authErrorResponse(error, "Sign in before preparing this video.");
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
        message: "Video preparation is temporarily unavailable.",
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
  const demoMediaId =
    getString(metadata.scheduledVideoId) ??
    getString(metadata.demoMediaId) ??
    schedule.mediaAssetId;

  if (!hookMediaId || !demoMediaId) {
    return jsonResponse(
      {
        ok: false,
        message:
          "Choose an opening clip and scheduled video before preparing the post.",
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
        code: "selected_opening_video_unavailable",
        ok: false,
        message:
          "The selected opening clip is no longer available. Edit this draft and choose another clip.",
      },
      409,
    );
  }

  if (!demoAsset || !isScheduledVideoAsset(demoAsset)) {
    return jsonResponse(
      {
        code: "selected_demo_video_unavailable",
        ok: false,
        message:
          "The selected scheduled video is no longer available. Edit this draft and choose another video.",
      },
      409,
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
    resolveScheduledVideoRenderAsset({
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
      resolvedHookAsset.status,
    );
  }

  if (!resolvedDemoAsset.ok) {
    return jsonResponse(
      {
        ok: false,
        message: resolvedDemoAsset.message,
      },
      resolvedDemoAsset.status,
    );
  }

  if (
    !isTrustedStorageUrl(resolvedHookAsset.asset.url) ||
    !isTrustedStorageUrl(resolvedDemoAsset.asset.url)
  ) {
    return jsonResponse(
      {
        ok: false,
        message: "Prepared videos must use supported app storage.",
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
    autoFinalize: hasPlannedFinalSchedule(metadata),
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
      expectedStatus: "draft",
      expectedUpdatedAt: schedule.updatedAt,
      metadata: {
        combinedRenderError: null,
        combinedRenderId: renderId,
        combinedRenderJobId: backgroundJob.id,
        combinedRenderQueuedAt: new Date().toISOString(),
        combinedRenderStatus: "queued",
        finalScheduleCompletedAt: null,
        finalScheduleError: null,
        finalScheduleFailedAt: null,
        finalScheduleRenderId: renderId,
        finalScheduleStatus: null,
      },
      postId: schedule.id,
      userId,
    });

    if (!queuedSchedule) {
      await markBackgroundJobFailed({
        errorMessage: "The schedule changed before video preparation started.",
        jobId: backgroundJob.id,
      });

      return jsonResponse(
        {
          code: "schedule_version_conflict",
          ok: false,
          message:
            "This schedule changed while video preparation was starting. Review it and try again.",
        },
        409,
      );
    }

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
      schedule: queuedSchedule,
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
              : "Failed to start video preparation.",
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
              : "Failed to start video preparation.",
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
        message: "Could not start preparing the combined video.",
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

function isScheduledVideoAsset(asset: MediaAssetRow) {
  return (
    asset.status === "ready" &&
    asset.collection === "video" &&
    scheduledVideoSourceTypes.has(asset.source_type)
  );
}

async function resolveScheduledVideoRenderAsset(params: {
  asset: MediaAssetRow;
  projectId: string;
  userId: string;
}) {
  if (params.asset.source_type === "demo_upload") {
    return resolveDemoRenderAsset(params);
  }

  return resolveOpeningRenderAsset({
    asset: params.asset,
    userId: params.userId,
  });
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

function getRenderRatio(
  demoAsset: RenderableScheduleAsset,
  hookAsset: RenderableScheduleAsset,
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

function hasPlannedFinalSchedule(metadata: Record<string, unknown>) {
  const hasConnections = Boolean(getString(metadata.plannedConnectionIds));
  const hasTime = Boolean(
    getString(metadata.plannedScheduledFor) ||
      (getString(metadata.scheduledDate) && getString(metadata.scheduledTime)),
  );

  return hasConnections && hasTime;
}
