import "server-only";

import { NextResponse } from "next/server";

import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import {
  AI_STUDIO_IMAGE_PROMPT_MAX_LENGTH,
  getAIStudioPromptLengthError,
  normalizeAIStudioPrompt,
} from "@/lib/ai-studio/prompt-policy";
import {
  parseAIStudioGenerationQuantity,
  parseAIStudioImageAspectRatio,
  parseAIStudioImageModel,
} from "@/lib/ai-studio/generation-settings";
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

type GenerateRequest = {
  aspectRatio?: unknown;
  idempotencyKey?: unknown;
  model?: unknown;
  prompt?: unknown;
  quantity?: unknown;
  referenceImageUrl?: unknown;
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

function cleanTrustedHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && isTrustedStorageUrl(url.toString())
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

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
  const aspectRatio = parseAIStudioImageAspectRatio(body?.aspectRatio);
  const quantity = parseAIStudioGenerationQuantity(body?.quantity);
  const model = parseAIStudioImageModel(body?.model);
  const referenceImageUrl = cleanTrustedHttpsUrl(body?.referenceImageUrl);

  if (body?.referenceImageUrl && !referenceImageUrl) {
    return NextResponse.json(
      { message: "The reference image is not a trusted uploaded file.", ok: false },
      { status: 400 },
    );
  }

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

  const baseIdempotencyKey = cleanIdempotencyKey(
    request.headers.get("Idempotency-Key") ?? body?.idempotencyKey,
  );
  const queuedJobs: { generationId: string; jobId: string }[] = [];
  let queueError: unknown = null;

  for (let index = 0; index < quantity; index += 1) {
    const generationId = crypto.randomUUID();
    const idempotencyKey = getChildIdempotencyKey(
      baseIdempotencyKey,
      index,
      quantity,
    );
    let creditsReserved = false;

    try {
      await reserveBillingCredits({
        amount: getGenerationCreditCost("image"),
        idempotencyKey,
        jobType: IMAGE_JOB_TYPE,
        userId: user.uid,
      });
      creditsReserved = true;
      const backgroundJob = await createAndDispatchBackgroundJob({
        idempotencyKey,
        input: {
          aspectRatio,
          batchIndex: index + 1,
          batchSize: quantity,
          generationId,
          model,
          prompt,
          referenceImageUrl,
        },
        jobType: IMAGE_JOB_TYPE,
        projectId: "ai-studio",
        userId: user.uid,
      });

      queuedJobs.push({
        generationId:
          getJobInputString(backgroundJob.input, "generationId") ||
          generationId,
        jobId: backgroundJob.id,
      });
    } catch (error) {
      queueError = error;

      if (creditsReserved) {
        await releaseBillingCredits({ idempotencyKey, userId: user.uid }).catch(
          (releaseError) =>
            console.error(
              "Could not release image generation credits:",
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
        generationId: firstJob.generationId,
        jobId: firstJob.jobId,
        jobs: queuedJobs,
        message: partial
          ? `${queuedJobs.length} of ${quantity} image generations started.`
          : `${quantity} image generation${quantity === 1 ? "" : "s"} started.`,
        ok: true,
        partial,
      },
      { status: 202 },
    );
  }

  {
    const error = queueError;

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
