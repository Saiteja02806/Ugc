import "server-only";

import { NextResponse } from "next/server";

import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import {
  isAIStudioBillingExemptUser,
  requireAIStudioProUser,
} from "@/lib/ai-studio/server-access";
import {
  AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import {
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
} from "@/lib/jobs/background-jobs";
import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";
import {
  BillingAccessError,
  deliverBillingUsageForJob,
  getGenerationCreditCost,
  releaseBillingCredits,
  reserveBillingCredits,
} from "@/lib/billing/subscription-db";

type GenerateRequest = {
  idempotencyKey?: unknown;
  prompt?: unknown;
};

type ImageJobOutput = {
  generationId?: unknown;
  height?: unknown;
  key?: unknown;
  mediaAssetId?: unknown;
  ok?: unknown;
  ratio?: unknown;
  url?: unknown;
  width?: unknown;
};

const IMAGE_JOB_TYPE = "generate_image";
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "failed"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingJobQueueEnvVars([IMAGE_JOB_TYPE]),
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
    mediaAssetId:
      typeof imageOutput.mediaAssetId === "string"
        ? imageOutput.mediaAssetId
        : null,
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
  const prompt = normalizeAIStudioPrompt(body?.prompt);

  if (!prompt) {
    return NextResponse.json(
      {
        message: "Add a prompt before generating an image.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const promptLengthError = getAIStudioPromptLengthError(
    prompt,
    AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
  );

  if (promptLengthError) {
    return NextResponse.json(
      { message: promptLengthError, ok: false },
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

  const generationId = crypto.randomUUID();
  const idempotencyKey = cleanIdempotencyKey(
    request.headers.get("Idempotency-Key") ?? body?.idempotencyKey,
  );
  let creditsReserved = false;

  try {
    if (!isAIStudioBillingExemptUser(user)) {
      await reserveBillingCredits({
        amount: getGenerationCreditCost("image"),
        idempotencyKey,
        jobType: IMAGE_JOB_TYPE,
        userId: user.uid,
      });
      creditsReserved = true;
    }
    const backgroundJob = await createAndDispatchBackgroundJob({
      idempotencyKey,
      input: {
        aspectRatio: "4:5",
        generationId,
        prompt,
      },
      jobType: IMAGE_JOB_TYPE,
      projectId: "ai-studio",
      userId: user.uid,
    });

    return NextResponse.json(
      {
        generationId:
          getJobInputString(backgroundJob.input, "generationId") || generationId,
        jobId: backgroundJob.id,
        message: "Image generation started.",
        ok: true,
      },
      { status: 202 },
    );
  } catch (error) {
    if (creditsReserved) {
      await releaseBillingCredits({ idempotencyKey, userId: user.uid }).catch(
        (releaseError) =>
          console.error("Could not release image generation credits:", releaseError),
      );
    }

    if (error instanceof BillingAccessError) {
      return NextResponse.json(
        { message: error.message, ok: false },
        { status: error.status },
      );
    }

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

    if (job.status === "completed") {
      await deliverBillingUsageForJob(job.id).catch((error) =>
        console.error("Could not deliver image usage to Dodo:", error),
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
