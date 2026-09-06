import "server-only";

import { NextResponse } from "next/server";

import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import {
  AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
import {
  parseAIStudioGenerationQuantity,
  parseAIStudioVideoDuration,
  parseAIStudioVideoAspectRatio,
  parseAIStudioVideoModel,
} from "@/lib/ai-studio/generation-settings";
import { isExploreHookVideoId } from "@/lib/explore/hook-video-library";
import { isExploreWallTextVideoId } from "@/lib/explore/wall-text-video-library";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import {
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
} from "@/lib/jobs/background-jobs";
import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import {
  BillingAccessError,
  deliverBillingUsageForJob,
  getGenerationCreditCost,
  releaseBillingCredits,
  reserveBillingCredits,
} from "@/lib/billing/subscription-db";

type GenerateVideoRequest = {
  aspectRatio?: unknown;
  avatarImageUrl?: unknown;
  hookIdea?: unknown;
  idempotencyKey?: unknown;
  model?: unknown;
  prompt?: unknown;
  quantity?: unknown;
  referenceVideoDurationSeconds?: unknown;
  referenceVideoUrl?: unknown;
  referenceId?: unknown;
  referenceType?: unknown;
  referenceUrl?: unknown;
  durationSeconds?: unknown;
};

type VideoJobOutput = {
  key?: unknown;
  mediaAssetId?: unknown;
  ok?: unknown;
  provider?: unknown;
  ratio?: unknown;
  url?: unknown;
  videoId?: unknown;
};

const VIDEO_JOB_TYPE = "generate_hook_video";
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "failed"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:") {
      return null;
    }

    return isTrustedStorageUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingJobQueueEnvVars([VIDEO_JOB_TYPE]),
    ]),
  );
}

function getSafeOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const videoOutput = output as VideoJobOutput;

  return {
    key: typeof videoOutput.key === "string" ? videoOutput.key : null,
    mediaAssetId:
      typeof videoOutput.mediaAssetId === "string"
        ? videoOutput.mediaAssetId
        : null,
    ok: videoOutput.ok === true,
    provider:
      typeof videoOutput.provider === "string" ? videoOutput.provider : null,
    ratio: typeof videoOutput.ratio === "string" ? videoOutput.ratio : null,
    url: typeof videoOutput.url === "string" ? videoOutput.url : null,
    videoId:
      typeof videoOutput.videoId === "string" ? videoOutput.videoId : null,
  };
}

export async function handleAIStudioVideoGeneration(request: Request) {
  let user;

  try {
    user = await requireAIStudioProUser(request);
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return NextResponse.json(
      {
        error:
          error instanceof FirebaseAuthRequestError
            ? error.message
            : "Could not verify your session.",
        ok: false,
      },
      { status },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | GenerateVideoRequest
    | null;
  const prompt = normalizeAIStudioPrompt(body?.prompt ?? body?.hookIdea);
  const avatarImageUrl = cleanHttpsUrl(body?.avatarImageUrl);
  const referenceVideoUrl = cleanHttpsUrl(body?.referenceVideoUrl);
  const referenceVideoDurationSeconds = cleanReferenceVideoDuration(
    body?.referenceVideoDurationSeconds,
  );
  const aspectRatio = parseAIStudioVideoAspectRatio(body?.aspectRatio);
  const quantity = parseAIStudioGenerationQuantity(body?.quantity);
  const model = parseAIStudioVideoModel(body?.model);
  const durationSeconds = parseAIStudioVideoDuration(body?.durationSeconds);
  const isExploreRecreate =
    (body?.referenceType === "hook" && isExploreHookVideoId(body?.referenceId)) ||
    (body?.referenceType === "wall_text" &&
      isExploreWallTextVideoId(body?.referenceId));

  if (body?.avatarImageUrl && !avatarImageUrl) {
    return NextResponse.json(
      { error: "The reference image is not a trusted uploaded file.", ok: false },
      { status: 400 },
    );
  }

  if (body?.referenceVideoUrl && !referenceVideoUrl) {
    return NextResponse.json(
      { error: "The reference video is not a trusted uploaded file.", ok: false },
      { status: 400 },
    );
  }

  if (isExploreRecreate && !avatarImageUrl) {
    return NextResponse.json(
      {
        error:
          "Add a reference image before recreating an Explore video. This format is image-reference-only for better results.",
        ok: false,
      },
      { status: 400 },
    );
  }

  if (avatarImageUrl && referenceVideoUrl) {
    return NextResponse.json(
      { error: "Choose either a reference image or a reference video, not both.", ok: false },
      { status: 400 },
    );
  }

  if (referenceVideoUrl && !referenceVideoDurationSeconds) {
    return NextResponse.json(
      { error: "Reference videos must be 3 seconds or shorter.", ok: false },
      { status: 400 },
    );
  }

  if (!prompt) {
    return NextResponse.json(
      {
        error: "Add a prompt before generating a video.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const promptLengthError = getAIStudioPromptLengthError(
    prompt,
    AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
  );

  if (promptLengthError) {
    return NextResponse.json(
      { error: promptLengthError, ok: false },
      { status: 400 },
    );
  }

  const missingRuntimeEnv = getMissingRuntimeEnv();

  if (missingRuntimeEnv.length > 0) {
    return NextResponse.json(
      {
        error: `Video generation is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
        ok: false,
      },
      { status: 501 },
    );
  }

  const projectId = "ai-studio";
  const baseIdempotencyKey = cleanIdempotencyKey(
    request.headers.get("Idempotency-Key") ?? body?.idempotencyKey,
  );
  const queuedJobs: { jobId: string; videoId: string }[] = [];
  let queueError: unknown = null;

  for (let index = 0; index < quantity; index += 1) {
    const videoId = crypto.randomUUID();
    const idempotencyKey = getChildIdempotencyKey(
      baseIdempotencyKey,
      index,
      quantity,
    );
    let creditsReserved = false;

    try {
      await reserveBillingCredits({
        amount: getGenerationCreditCost("video", durationSeconds),
        idempotencyKey,
        jobType: VIDEO_JOB_TYPE,
        userId: user.uid,
      });
      creditsReserved = true;
      const backgroundJob = await createAndDispatchBackgroundJob({
        idempotencyKey,
        input: {
          aspectRatio,
          avatarImageUrl,
          batchIndex: index + 1,
          batchSize: quantity,
          durationSeconds,
          hookIdea: prompt,
          model,
          promptMode: "direct",
          projectId,
          referenceVideoDurationSeconds,
          referenceVideoUrl,
          referenceId:
            typeof body?.referenceId === "string" ? body.referenceId : null,
          referenceType:
            typeof body?.referenceType === "string" ? body.referenceType : null,
          referenceUrl:
            typeof body?.referenceUrl === "string" ? body.referenceUrl : null,
          userId: user.uid,
          videoId,
        },
        jobType: VIDEO_JOB_TYPE,
        projectId,
        userId: user.uid,
      });

      queuedJobs.push({
        jobId: backgroundJob.id,
        videoId: getJobInputString(backgroundJob.input, "videoId") || videoId,
      });
    } catch (error) {
      queueError = error;

      if (creditsReserved) {
        await releaseBillingCredits({ idempotencyKey, userId: user.uid }).catch(
          (releaseError) =>
            console.error(
              "Could not release video generation credits:",
              releaseError,
            ),
        );
      }

      break;
    }
  }

  if (queuedJobs.length > 0) {
    const firstJob = queuedJobs[0];
    const partial = queuedJobs.length < quantity;

    return NextResponse.json(
      {
        jobId: firstJob.jobId,
        jobs: queuedJobs,
        message: partial
          ? `${queuedJobs.length} of ${quantity} video generations started.`
          : `${quantity} video generation${quantity === 1 ? "" : "s"} started.`,
        ok: true,
        partial,
        videoId: firstJob.videoId,
      },
      { status: 202 },
    );
  }

  {
    const error = queueError;

    if (error instanceof BillingAccessError) {
      return NextResponse.json(
        { error: error.message, ok: false },
        { status: error.status },
      );
    }

    console.error("Failed to start video generation:", error);

    return NextResponse.json(
      {
        error: "Could not queue video generation.",
        ok: false,
      },
      { status: 502 },
    );
  }
}

function getChildIdempotencyKey(baseKey: string, index: number, quantity: number) {
  return quantity === 1
    ? baseKey
    : `${baseKey.slice(0, 190)}:${index + 1}`;
}

function cleanIdempotencyKey(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : crypto.randomUUID();
}

function cleanReferenceVideoDuration(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 3
    ? value
    : null;
}

function getJobInputString(value: unknown, key: string) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    key in value &&
    typeof value[key as keyof typeof value] === "string"
    ? String(value[key as keyof typeof value])
    : "";
}

export async function handleAIStudioVideoStatus(request: Request) {
  let user;

  try {
    user = await requireAIStudioProUser(request);
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return NextResponse.json(
      {
        error:
          error instanceof FirebaseAuthRequestError
            ? error.message
            : "Could not verify your session.",
        ok: false,
      },
      { status },
    );
  }

  const jobId = new URL(request.url).searchParams.get("jobId")?.trim() ?? "";

  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json(
      {
        error: "Missing or invalid job id.",
        ok: false,
      },
      { status: 400 },
    );
  }

  try {
    const job = await getBackgroundJobById(jobId);

    if (!job || job.userId !== user.uid) {
      return NextResponse.json(
        {
          error: "Video generation job was not found.",
          ok: false,
        },
        { status: 404 },
      );
    }

    if (job.jobType !== VIDEO_JOB_TYPE) {
      return NextResponse.json(
        {
          error: "The requested job is not a video generation job.",
          ok: false,
        },
        { status: 400 },
      );
    }

    if (job.status === "completed") {
      await deliverBillingUsageForJob(job.id).catch((error) =>
        console.error("Could not deliver video usage to Dodo:", error),
      );
    }

    return NextResponse.json({
      job: {
        error: job.errorMessage,
        id: job.id,
        isTerminal: TERMINAL_STATUSES.has(job.status),
        output: getSafeOutput(job.output),
        status: job.status,
      },
      ok: true,
    });
  } catch (error) {
    console.error("Failed to retrieve video generation status:", error);

    return NextResponse.json(
      {
        error: "Could not retrieve video generation status.",
        ok: false,
      },
      { status: 500 },
    );
  }
}
