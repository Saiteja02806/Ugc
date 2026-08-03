import "server-only";

import { NextResponse } from "next/server";

import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import {
  AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import {
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
} from "@/lib/jobs/background-jobs";
import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import { isTrustedStorageUrl } from "@/lib/storage/storage";

type GenerateVideoRequest = {
  avatarImageUrl?: unknown;
  hookIdea?: unknown;
  idempotencyKey?: unknown;
  prompt?: unknown;
};

type VideoJobOutput = {
  key?: unknown;
  mediaAssetId?: unknown;
  ok?: unknown;
  provider?: unknown;
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

  if (!avatarImageUrl) {
    return NextResponse.json(
      {
        error: "Choose a presenter with a preview image.",
        ok: false,
      },
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

  try {
    const projectId = "ai-studio";
    const videoId = crypto.randomUUID();
    const idempotencyKey = cleanIdempotencyKey(
      request.headers.get("Idempotency-Key") ?? body?.idempotencyKey,
    );
    const backgroundJob = await createAndDispatchBackgroundJob({
      idempotencyKey,
      input: {
        avatarImageUrl,
        cameraStyle: "iphone_selfie",
        emotion: "confident",
        hookIdea: prompt,
        productDescription: "Short-form creator content.",
        productName: "UGCPilot",
        projectId,
        userId: user.uid,
        videoId,
      },
      jobType: VIDEO_JOB_TYPE,
      projectId,
      userId: user.uid,
    });

    return NextResponse.json(
      {
        jobId: backgroundJob.id,
        message: "Video generation started.",
        ok: true,
        videoId: getJobInputString(backgroundJob.input, "videoId") || videoId,
      },
      { status: 202 },
    );
  } catch (error) {
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

function cleanIdempotencyKey(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : crypto.randomUUID();
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
