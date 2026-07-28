import "server-only";

import { NextResponse } from "next/server";

import {
  getMissingSqsEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/aws/sqs";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import {
  attachAwsMessageToBackgroundJob,
  createBackgroundJob,
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";

type GenerateVideoRequest = {
  avatarImageUrl?: unknown;
  hookIdea?: unknown;
  prompt?: unknown;
};

type VideoJobOutput = {
  key?: unknown;
  ok?: unknown;
  provider?: unknown;
  url?: unknown;
  videoId?: unknown;
};

const VIDEO_JOB_TYPE = "generate_hook_video";
const MAX_PROMPT_LENGTH = 1_000;
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "failed"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanPrompt(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_PROMPT_LENGTH)
    : "";
}

function cleanHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingSqsEnvVars([VIDEO_JOB_TYPE]),
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
  const prompt = cleanPrompt(body?.prompt ?? body?.hookIdea);
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
    const backgroundJob = await createBackgroundJob({
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
      queueName: getQueueNameForJobType(VIDEO_JOB_TYPE),
      userId: user.uid,
    });

    try {
      const message = await sendJobMessage({
        jobId: backgroundJob.id,
        jobType: VIDEO_JOB_TYPE,
      });

      await attachAwsMessageToBackgroundJob({
        awsMessageId: message.messageId,
        jobId: backgroundJob.id,
      });
    } catch (error) {
      await markBackgroundJobFailed({
        errorMessage:
          error instanceof Error
            ? error.message
            : "Could not enqueue video generation.",
        jobId: backgroundJob.id,
      }).catch((persistenceError) => {
        console.error(
          "Failed to persist video generation enqueue failure:",
          persistenceError,
        );
      });

      throw error;
    }

    return NextResponse.json({
      jobId: backgroundJob.id,
      message: "Video generation started.",
      ok: true,
      videoId,
    });
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
