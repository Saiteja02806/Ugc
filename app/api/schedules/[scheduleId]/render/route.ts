import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getMissingJobQueueEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/queues/job-queue";
import {
  attachQueueMessageToBackgroundJob,
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
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { resolveTrendingTextColor } from "@/lib/trending/text-color";
import { getLockedHookAudioForVideo } from "@/lib/trending/hook-audio-db";
import {
  HOOK_TEXT_FIXED_FONT_SIZE,
  HOOK_TEXT_LAYOUT_VERSION,
  LEGACY_HOOK_TEXT_LAYOUT_VERSION,
} from "@/lib/trending/hook-text-layout";

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
      ...getMissingJobQueueEnvVars([COMBINATION_RENDER_JOB_TYPE]),
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
          "Choose a hook clip and a secondary clip before preparing the post.",
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
            "The selected hook clip is no longer available. Edit this draft and choose another clip.",
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
            "The selected secondary clip is no longer available. Edit this draft and choose another clip.",
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
        message: "Both videos must be app-owned Cloud Storage assets.",
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

  const hookText = getString(metadata.hookText)?.slice(0, 220) ?? "";
  const hookTextFontSize = getHookTextFontSize(metadata.hookTextFontSize);
  const hookTextLayoutVersion = getString(metadata.hookTextLayoutVersion);
  const hookTextLines = getHookTextLines(metadata.hookTextLines);
  const hookTextPosition = getNormalizedPosition(metadata.hookTextPosition);
  const hookTextColor = resolveTrendingTextColor(metadata.hookTextColor);
  const hookTrimStart = getNonNegativeNumber(metadata.hookTrimStart) ?? 0;
  const hookTrimEnd = getPositiveNumber(metadata.hookTrimEnd);
  const hookCatalogVideoId =
    getString(metadata.hookCatalogVideoId) ??
    getStringFromValue(getObjectValue(hookAsset.metadata, "avatarAssetId"));
  let hookAudio = null;

  if (
    hookTextLayoutVersion !== null &&
    hookTextLayoutVersion !== HOOK_TEXT_LAYOUT_VERSION &&
    hookTextLayoutVersion !== LEGACY_HOOK_TEXT_LAYOUT_VERSION
  ) {
    return jsonResponse(
      {
        message: "The saved Hook text layout version is not supported.",
        ok: false,
      },
      409,
    );
  }

  if (
    hookTextLayoutVersion === HOOK_TEXT_LAYOUT_VERSION &&
    (!hookTextFontSize ||
      hookTextFontSize !== HOOK_TEXT_FIXED_FONT_SIZE ||
      !hookTextLines ||
      normalizeHookText(hookTextLines.join(" ")) !== normalizeHookText(hookText))
  ) {
    return jsonResponse(
      {
        message: "The saved Hook text layout no longer matches its copy.",
        ok: false,
      },
      409,
    );
  }

  if (hookTrimEnd !== null && hookTrimEnd <= hookTrimStart) {
    return jsonResponse(
      {
        ok: false,
        message: "Review the hook clip trim before preparing this video.",
      },
      409,
    );
  }

  if (hookCatalogVideoId) {
    try {
      hookAudio = await getLockedHookAudioForVideo({
        hookVideoId: hookCatalogVideoId,
      });
    } catch (error) {
      console.error("Could not resolve Locked Hook audio:", error);
      return jsonResponse(
        {
          code: "locked_hook_audio_unavailable",
          message:
              "The approved sound for this hook clip is unavailable. Review its Locked audio before rendering.",
          ok: false,
        },
        409,
      );
    }
  }

  if (hookAudio && !isTrustedStorageUrl(hookAudio.audioUrl)) {
    return jsonResponse(
      {
        code: "locked_hook_audio_untrusted",
        message: "The approved Hook sound must use supported app storage.",
        ok: false,
      },
      400,
    );
  }

  const ratio = getRenderRatio(
    resolvedDemoAsset.asset,
    resolvedHookAsset.asset,
  );
  const compositionFingerprint = createCompositionFingerprint({
    demoUpdatedAt: resolvedDemoAsset.asset.updated_at,
    demoVideoId: resolvedDemoAsset.asset.id,
    hookText,
    hookTextFontSize,
    hookTextLayoutVersion,
    hookTextLines,
    hookTextPosition,
    hookTextColor,
    hookAudioAssetId: hookAudio?.audioAssetId ?? null,
    hookAudioUrl: hookAudio?.audioUrl ?? null,
    hookTrimEnd,
    hookTrimStart,
    hookUpdatedAt: resolvedHookAsset.asset.updated_at,
    hookVideoId: resolvedHookAsset.asset.id,
    ratio,
  });

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
        resolvedDemoAsset.asset.id &&
      getStringFromValue(
        getObjectValue(combinedAsset.metadata, "compositionFingerprint"),
      ) === compositionFingerprint
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
    compositionFingerprint,
    demoVideoId: resolvedDemoAsset.asset.id,
    demoVideoUrl: resolvedDemoAsset.asset.url,
    hookText,
    hookTextFontSize,
    hookTextLayoutVersion,
    hookTextLines,
    hookTextPosition,
    hookTextColor,
    hookAudio,
    hookTrimEnd,
    hookTrimStart,
    hookVideoId: resolvedHookAsset.asset.id,
    hookVideoUrl: resolvedHookAsset.asset.url,
    projectId,
    ratio,
    renderId,
    scheduleId: schedule.id,
    title,
    userId,
  };

  let backgroundJob;

  try {
    backgroundJob = await createBackgroundJob({
      idempotencyKey: `schedule-render:${renderId}`,
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
        combinedRequestedFingerprint: compositionFingerprint,
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
    const updatedJob = await attachQueueMessageToBackgroundJob({
      queueMessageId: message.messageId,
      jobId: backgroundJob.id,
    });

    return jsonResponse(
      {
        jobId: updatedJob.id,
        ok: true,
        renderId,
        schedule: queuedSchedule,
        status: "queued",
      },
      202,
    );
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
    (asset.collection === "influencer" || asset.collection === "video") &&
    [
      "catalog_influencer",
      "influencer_upload",
      "upload",
      "generated_video",
    ].includes(
      asset.source_type,
    )
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

function getNonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function getPositiveNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function getNormalizedPosition(value: unknown) {
  const position = getRecord(value);
  const x = position?.x;
  const y = position?.y;

  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    x < 0 ||
    x > 1 ||
    typeof y !== "number" ||
    !Number.isFinite(y) ||
    y < 0 ||
    y > 1
  ) {
    return null;
  }

  return { x, y };
}

function getHookTextFontSize(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 34 &&
    value <= 60 &&
    value % 2 === 0
    ? value
    : null;
}

function getHookTextLines(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 3 ||
    value.some(
      (line) =>
        typeof line !== "string" ||
        !line.trim() ||
        Array.from(line.trim()).length > 78,
    )
  ) {
    return null;
  }

  return value.map((line) => line.trim().replace(/\s+/gu, " "));
}

function createCompositionFingerprint(value: {
  demoUpdatedAt: string;
  demoVideoId: string;
  hookText: string;
  hookTextFontSize: number | null;
  hookTextLayoutVersion: string | null;
  hookTextLines: string[] | null;
  hookTextPosition: { x: number; y: number } | null;
  hookTextColor: string;
  hookAudioAssetId: string | null;
  hookAudioUrl: string | null;
  hookTrimEnd: number | null;
  hookTrimStart: number;
  hookUpdatedAt: string;
  hookVideoId: string;
  ratio: CombinationRenderRatio;
}) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeHookText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function hasPlannedFinalSchedule(metadata: Record<string, unknown>) {
  const hasConnections = Boolean(getString(metadata.plannedConnectionIds));
  const hasTime = Boolean(
    getString(metadata.plannedScheduledFor) ||
      (getString(metadata.scheduledDate) && getString(metadata.scheduledTime)),
  );

  return hasConnections && hasTime;
}
