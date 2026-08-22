import { logger } from "../logger.js";
import {
  assertProviderOperationCanContinue,
  createGenerationRequestFingerprint,
  persistProviderSubmissionFailure,
  ProviderOperationTerminalError,
  ProviderSubmissionUncertainError,
  toProviderPollingRetry,
} from "../lib/generation-provider.js";
import { generateRunwayHookVideoBuffer } from "../lib/runway-video.js";
import { getStoredObject, uploadBufferToStorage } from "../lib/storage.js";
import {
  buildUgcVideoPrompt,
  DEFAULT_HOOK_VIDEO_PROVIDER,
  hookVideoCameraStyles,
  hookVideoEmotions,
  hookVideoProviders,
  type HookVideoCameraStyle,
  type HookVideoEmotion,
  type HookVideoProvider,
} from "../lib/ugc-video-prompt.js";
import { assertGeneratedMp4 } from "../lib/video-output.js";
import { shouldFallbackToRunway } from "../lib/video-provider-fallback.js";
import { generateVeoHookVideoBuffer } from "../lib/veo-video.js";
import { RetryableJobError } from "../retryable-job-error.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext, WorkerJobOutput } from "./index.js";

type GenerateHookVideoInput = {
  aspectRatio: HookVideoAspectRatio;
  avatarImageUrl?: string;
  cameraStyle: HookVideoCameraStyle;
  emotion: HookVideoEmotion;
  hookIdea: string;
  productDescription?: string;
  productName?: string;
  projectId: string;
  provider?: HookVideoProvider;
  userId: string;
  videoId: string;
};

const hookVideoAspectRatios = ["9:16", "16:9"] as const;
type HookVideoAspectRatio = (typeof hookVideoAspectRatios)[number];

const MAX_HOOK_LENGTH = 1_000;
const MAX_PRODUCT_NAME_LENGTH = 120;
const MAX_PRODUCT_DESCRIPTION_LENGTH = 500;

export async function runGenerateHookVideoJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
): Promise<WorkerJobOutput> {
  const input = getInput(job);
  const prompt = buildUgcVideoPrompt(input);
  const outputKey = `videos/hooks/${input.userId}/${input.projectId}/${input.videoId}.mp4`;
  const existingOutput = await getStoredObject(outputKey);

  if (existingOutput) {
    const persistedOperation =
      await context.store.getLatestPersistedGenerationOperation(job.id);
    const persistedProvider = persistedOperation?.provider;

    return buildOutput({
      bufferSize: undefined,
      input,
      provider:
        (persistedProvider === "runway" || persistedProvider === "veo"
          ? persistedProvider
          : undefined) ??
        input.provider ??
        DEFAULT_HOOK_VIDEO_PROVIDER,
      uploaded: existingOutput,
    });
  }

  await context.checkpoint({
    stage: "waiting_for_video_provider",
    status: "waiting_external_service",
  });
  const generated = await generateWithFallback(job, context, input, prompt);
  await context.checkpoint({
    progress: 80,
    stage: "validating_video_output",
    status: "processing",
  });
  const buffer = assertGeneratedMp4(generated.buffer);
  const { provider } = generated;

  logger.info("Hook video generated", {
    bufferSize: buffer.length,
    provider,
    videoId: input.videoId,
  });

  await context.checkpoint({
    progress: 90,
    stage: "uploading_video",
    status: "uploading_output",
  });
  const uploaded = await uploadBufferToStorage({
    buffer,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "video/mp4",
    key: outputKey,
  });
  await context.store.markGenerationOutputPersisted({
    jobId: job.id,
    metadata: {
      durationSeconds: 4,
      provider,
      ratio: input.aspectRatio,
    },
    operationKey: generated.operationKey,
    outputReference: uploaded.key,
    outputUrl: uploaded.url,
  });
  await context.checkpoint({
    progress: 98,
    stage: "finalizing_video",
    status: "processing",
  });

  return buildOutput({
    bufferSize: buffer.length,
    input,
    provider,
    uploaded,
  });
}

async function generateWithFallback(
  job: BackgroundJobRow,
  context: WorkerJobContext,
  input: GenerateHookVideoInput,
  prompt: string,
) {
  const preferredProvider = input.provider ?? DEFAULT_HOOK_VIDEO_PROVIDER;

  if (preferredProvider === "runway") {
    return generateWithProvider(
      job,
      context,
      "runway",
      "primary",
      input,
      prompt,
    );
  }

  try {
    return await generateWithProvider(
      job,
      context,
      "veo",
      "primary",
      input,
      prompt,
    );
  } catch (veoError) {
    const veoErrorMessage = getErrorMessage(veoError);

    if (
      veoError instanceof ProviderSubmissionUncertainError ||
      veoError instanceof RetryableJobError
    ) {
      throw veoError;
    }

    if (!shouldFallbackToRunway(veoError)) {
      logger.error("Veo hook video generation failed; fallback not eligible", {
        error: veoErrorMessage,
        videoId: input.videoId,
      });

      throw new Error(`Veo failed: ${veoErrorMessage}`);
    }

    logger.warn("Veo hook video generation failed; trying Runway fallback", {
      error: veoErrorMessage,
      videoId: input.videoId,
    });

    try {
      return await generateWithProvider(
        job,
        context,
        "runway",
        "fallback",
        input,
        prompt,
      );
    } catch (runwayError) {
      throw new Error(
        `Veo failed: ${veoErrorMessage}. Runway fallback failed: ${
          runwayError instanceof Error
            ? runwayError.message
            : String(runwayError)
        }`,
      );
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function generateWithProvider(
  job: BackgroundJobRow,
  context: WorkerJobContext,
  provider: HookVideoProvider,
  role: "fallback" | "primary",
  input: GenerateHookVideoInput,
  prompt: string,
) {
  const operationKey = `${role}-${provider}`;
  const requestFingerprint = createGenerationRequestFingerprint({
    aspectRatio: input.aspectRatio,
    prompt,
    provider,
    referenceImageUrl: input.avatarImageUrl,
    videoId: input.videoId,
  });
  const reservation = await context.store.reserveGenerationProviderOperation({
    jobId: job.id,
    metadata: { role },
    operationKey,
    provider,
    requestFingerprint,
  });
  const action = assertProviderOperationCanContinue(reservation);
  let operationSubmitted = action === "resume";
  const providerOperationId =
    action === "resume"
      ? reservation.operation.provider_operation_id ?? undefined
      : undefined;
  const onOperationCreated = async (operationId: string) => {
    await context.store.markGenerationProviderSubmitted({
      jobId: job.id,
      operationKey,
      providerOperationId: operationId,
    });
    operationSubmitted = true;
  };
  const onOperationSucceeded = async (
    operationId: string,
    outputUrl?: string,
  ) => {
    await context.store.markGenerationProviderSucceeded({
      jobId: job.id,
      metadata: { provider, role },
      operationKey,
      outputUrl,
      providerOperationId: operationId,
    });
  };

  try {
    const params = {
      aspectRatio: input.aspectRatio,
      onOperationCreated,
      prompt,
      providerOperationId,
      referenceImageUrl: input.avatarImageUrl,
    };

    return {
      buffer:
        provider === "runway"
          ? await generateRunwayHookVideoBuffer({
              ...params,
              onOperationSucceeded,
            })
          : await generateVeoHookVideoBuffer({
              ...params,
              onOperationSucceeded: async (operationId) =>
                onOperationSucceeded(operationId),
            }),
      operationKey,
      provider,
    };
  } catch (error) {
    if (error instanceof ProviderOperationTerminalError) {
      await context.store.markGenerationProviderFailed({
        errorCode: "provider_operation_failed",
        errorMessage: error.message,
        jobId: job.id,
        operationKey,
        retryAllowed: false,
      });
      throw error;
    }

    if (operationSubmitted || providerOperationId) {
      throw toProviderPollingRetry(error);
    }

    return persistProviderSubmissionFailure({
      error,
      jobId: job.id,
      operationKey,
      store: context.store,
    });
  }
}

function buildOutput(params: {
  bufferSize?: number;
  input: GenerateHookVideoInput;
  provider: HookVideoProvider;
  uploaded: { key: string; url: string };
}) {
  return {
    durationSeconds: 4,
    fileSizeBytes: params.bufferSize,
    key: params.uploaded.key,
    ok: true,
    provider: params.provider,
    ratio: params.input.aspectRatio,
    url: params.uploaded.url,
    videoId: params.input.videoId,
  };
}

function getInput(job: BackgroundJobRow): GenerateHookVideoInput {
  if (!isJsonObject(job.input_json)) {
    throw new Error("generate_hook_video input_json must be an object.");
  }

  return {
    aspectRatio:
      getOptionalChoice(job.input_json.aspectRatio, hookVideoAspectRatios) ??
      "9:16",
    avatarImageUrl: getOptionalHttpsUrl(job.input_json.avatarImageUrl),
    cameraStyle: getChoice(
      job.input_json.cameraStyle,
      hookVideoCameraStyles,
      "cameraStyle",
    ),
    emotion: getChoice(job.input_json.emotion, hookVideoEmotions, "emotion"),
    hookIdea: getText(job.input_json.hookIdea, "hookIdea", MAX_HOOK_LENGTH),
    productDescription: getOptionalText(
      job.input_json.productDescription,
      MAX_PRODUCT_DESCRIPTION_LENGTH,
    ),
    productName: getOptionalText(
      job.input_json.productName,
      MAX_PRODUCT_NAME_LENGTH,
    ),
    projectId: getPathSegment(job.input_json.projectId, "projectId"),
    provider: getOptionalChoice(job.input_json.provider, hookVideoProviders),
    userId: getPathSegment(job.input_json.userId, "userId"),
    videoId: getPathSegment(job.input_json.videoId, "videoId"),
  };
}

function isJsonObject(value: Json | undefined): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getText(value: Json | undefined, fieldName: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`generate_hook_video requires input.${fieldName}.`);
  }

  return value.trim().slice(0, maxLength);
}

function getOptionalText(value: Json | undefined, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return value.trim().slice(0, maxLength);
}

function getChoice<TValue extends string>(
  value: Json | undefined,
  options: readonly TValue[],
  fieldName: string,
) {
  if (typeof value === "string" && options.includes(value as TValue)) {
    return value as TValue;
  }

  throw new Error(`generate_hook_video has invalid input.${fieldName}.`);
}

function getOptionalChoice<TValue extends string>(
  value: Json | undefined,
  options: readonly TValue[],
) {
  if (typeof value === "string" && options.includes(value as TValue)) {
    return value as TValue;
  }

  return undefined;
}

function getOptionalHttpsUrl(value: Json | undefined) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value.trim());

    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function getPathSegment(value: Json | undefined, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`generate_hook_video requires input.${fieldName}.`);
  }

  const cleanValue = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  if (!cleanValue) {
    throw new Error(`generate_hook_video requires input.${fieldName}.`);
  }

  return cleanValue;
}
