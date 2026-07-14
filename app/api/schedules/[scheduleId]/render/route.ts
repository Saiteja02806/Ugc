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

  if (existingStatus === "ready" && getString(metadata.combinedMediaAssetId)) {
    return jsonResponse({
      jobId: getString(metadata.combinedRenderJobId),
      ok: true,
      schedule,
      status: "ready",
    });
  }

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
        message: "Choose one hook video and one demo video before rendering.",
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
        message: "The selected hook video is no longer available.",
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

  const renderId = crypto.randomUUID();
  const projectId =
    schedule.projectId ?? demoAsset.project_id ?? hookAsset.project_id ?? "schedule";
  const title = `${schedule.title || "Scheduled post"} combined`.slice(0, 140);
  const input = {
    demoVideoId: demoAsset.id,
    demoVideoUrl: demoAsset.url,
    hookVideoId: hookAsset.id,
    hookVideoUrl: hookAsset.url,
    projectId,
    ratio: getRenderRatio(demoAsset, hookAsset),
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
