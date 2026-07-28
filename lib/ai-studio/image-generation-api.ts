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

type GenerateRequest = {
  prompt?: unknown;
};

type ImageJobOutput = {
  generationId?: unknown;
  height?: unknown;
  key?: unknown;
  ok?: unknown;
  ratio?: unknown;
  url?: unknown;
  width?: unknown;
};

const IMAGE_JOB_TYPE = "generate_image";
const MAX_PROMPT_LENGTH = 2_000;
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "failed"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanPrompt(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_PROMPT_LENGTH)
    : "";
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingSqsEnvVars([IMAGE_JOB_TYPE]),
    ]),
  );
}

function getSafeOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const imageOutput = output as ImageJobOutput;

  return {
    generationId:
      typeof imageOutput.generationId === "string"
        ? imageOutput.generationId
        : null,
    height:
      typeof imageOutput.height === "number" ? imageOutput.height : null,
    key: typeof imageOutput.key === "string" ? imageOutput.key : null,
    ok: imageOutput.ok === true,
    ratio: typeof imageOutput.ratio === "string" ? imageOutput.ratio : null,
    url: typeof imageOutput.url === "string" ? imageOutput.url : null,
    width: typeof imageOutput.width === "number" ? imageOutput.width : null,
  };
}

export async function handleAIStudioImageGeneration(request: Request) {
  let user;

  try {
    user = await requireAIStudioProUser(request);
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return NextResponse.json(
      {
        message:
          error instanceof FirebaseAuthRequestError
            ? error.message
            : "Could not verify your session.",
        ok: false,
      },
      { status },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | GenerateRequest
    | null;
  const prompt = cleanPrompt(body?.prompt);

  if (!prompt) {
    return NextResponse.json(
      {
        message: "Add a prompt before generating an image.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const missingRuntimeEnv = getMissingRuntimeEnv();

  if (missingRuntimeEnv.length > 0) {
    return NextResponse.json(
      {
        message: `Image generation is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
        ok: false,
      },
      { status: 501 },
    );
  }

  try {
    const generationId = crypto.randomUUID();
    const backgroundJob = await createBackgroundJob({
      input: {
        aspectRatio: "4:5",
        generationId,
        prompt,
      },
      jobType: IMAGE_JOB_TYPE,
      projectId: "ai-studio",
      queueName: getQueueNameForJobType(IMAGE_JOB_TYPE),
      userId: user.uid,
    });

    try {
      const message = await sendJobMessage({
        jobId: backgroundJob.id,
        jobType: IMAGE_JOB_TYPE,
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
            : "Could not enqueue image generation.",
        jobId: backgroundJob.id,
      }).catch((persistenceError) => {
        console.error(
          "Failed to persist image generation enqueue failure:",
          persistenceError,
        );
      });

      throw error;
    }

    return NextResponse.json({
      generationId,
      jobId: backgroundJob.id,
      message: "Image generation started.",
      ok: true,
    });
  } catch (error) {
    console.error("Failed to start image generation:", error);

    return NextResponse.json(
      {
        message: "Could not queue image generation.",
        ok: false,
      },
      { status: 502 },
    );
  }
}

export async function handleAIStudioImageStatus(request: Request) {
  let user;

  try {
    user = await requireAIStudioProUser(request);
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return NextResponse.json(
      {
        message:
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
        message: "Missing or invalid job id.",
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
          message: "Image generation job was not found.",
          ok: false,
        },
        { status: 404 },
      );
    }

    if (job.jobType !== IMAGE_JOB_TYPE) {
      return NextResponse.json(
        {
          message: "The requested job is not an image generation job.",
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
    console.error("Failed to retrieve image generation status:", error);

    return NextResponse.json(
      {
        message: "Could not retrieve image generation status.",
        ok: false,
      },
      { status: 500 },
    );
  }
}
