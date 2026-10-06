import { logger } from "../logger.js";
import { resolveOwnedPrivateMediaUrl } from "../lib/private-media.js";
import {
  assertProviderOperationCanContinue,
  createGenerationRequestFingerprint,
  persistProviderSubmissionFailure,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
  ProviderSubmissionUncertainError,
  toProviderPollingRetry,
} from "../lib/generation-provider.js";
import { generateRunwayHookVideoBuffer } from "../lib/runway-video.js";
import { generateRunwaySeedanceVideoBuffer } from "../lib/runway-seedance-video.js";
import { generateOpenRouterSeedanceVideoBuffer } from "../lib/openrouter-seedance-video.js";
import { resolveHookVideoProvider } from "../lib/hook-video-provider.js";
import { generateGeminiOmniVideoBuffer } from "../lib/gemini-omni-video.js";
import { generateKlingVideoBuffer } from "../lib/kling-video.js";
import { resumeLegacyHiggsfieldVideoBuffer } from "../lib/higgsfield-video.js";
import { getStoredObject, uploadBufferToStorage } from "../lib/storage.js";
import {
  buildVideoGenerationPrompt,
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

type GenerateHookVideoBaseInput = {
  aspectRatio: HookVideoAspectRatio;
  avatarImageUrl?: string;
  referenceImageUrls: string[];
  referenceAudioUrls: string[];
  resolution: HookVideoResolution;
  durationSeconds: number;
  hookIdea: string;
  model?: "google_omni" | "seedance_2_5" | "kling_3_0";
  projectId: string;
  provider?: HookVideoProvider;
  referenceVideoDurationSeconds?: number;
  referenceVideoUrl?: string;
  userId: string;
  videoId: string;
};

type GenerateHookVideoInput = GenerateHookVideoBaseInput &
  (
    | { promptMode: "direct" }
    | {
        cameraStyle: HookVideoCameraStyle;
        emotion: HookVideoEmotion;
        productDescription?: string;
        productName?: string;
        promptMode: "ugc_template";
      }
  );

const hookVideoAspectRatios = ["9:16", "16:9"] as const;
type HookVideoAspectRatio = (typeof hookVideoAspectRatios)[number];
const hookVideoResolutions = ["480p", "720p", "1080p"] as const;
type HookVideoResolution = (typeof hookVideoResolutions)[number];

const MAX_HOOK_LENGTH = 10_000;
const MAX_PRODUCT_NAME_LENGTH = 120;
const MAX_PRODUCT_DESCRIPTION_LENGTH = 500;

export async function runGenerateHookVideoJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
): Promise<WorkerJobOutput> {
  const input = getInput(job);
  const prompt = buildVideoGenerationPrompt(input);
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
        (persistedProvider === "gemini" ||
        persistedProvider === "runway" ||
        persistedProvider === "veo" ||
        persistedProvider === "higgsfield" || persistedProvider === "openrouter"
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
  const completedOperation = provider === "openrouter"
    ? await context.store.getGenerationProviderOperation({ jobId: job.id, operationKey: generated.operationKey })
    : null;
  await context.store.markGenerationOutputPersisted({
    jobId: job.id,
    metadata: {
      ...(completedOperation && isJsonObject(completedOperation.metadata) ? completedOperation.metadata : {}),
      durationSeconds: getOutputDurationSeconds(input, provider),
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
  const legacyOperation = input.model === "seedance_2_5" || input.provider === "higgsfield"
    ? await context.store.getGenerationProviderOperation({ jobId: job.id, operationKey: "primary-higgsfield" })
    : null;
  const selectedProvider = resolveHookVideoProvider(input, legacyOperation);

  if (input.referenceAudioUrls.length && input.model !== "seedance_2_5" && selectedProvider !== "higgsfield") {
    throw new ProviderRequestNotSubmittedError("Audio references require Seedance 2.5.");
  }

  if (selectedProvider === "higgsfield") {
    return generateWithProvider(job, context, "higgsfield", "primary", input, prompt);
  }

  if (selectedProvider === "openrouter") {
    return generateWithProvider(job, context, "openrouter", "primary", input, prompt);
  }

  if (input.referenceVideoUrl) {
    return generateWithProvider(
      job,
      context,
      "runway",
      "primary",
      input,
      prompt,
    );
  }

  if (selectedProvider === "gemini") {
    return generateWithProvider(job, context, "gemini", "primary", input, prompt);
  }

  if (selectedProvider === "runway") {
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
    durationSeconds: input.durationSeconds,
    model: input.model ?? null,
    prompt,
    provider,
    resolution: input.resolution,
    referenceImageUrl: input.avatarImageUrl,
    referenceImageUrls: input.referenceImageUrls,
    // Keep fingerprints of existing requests unchanged when no audio was attached.
    ...(input.referenceAudioUrls.length ? { referenceAudioUrls: input.referenceAudioUrls } : {}),
    referenceVideoDurationSeconds: input.referenceVideoDurationSeconds ?? null,
    referenceVideoUrl: input.referenceVideoUrl ?? null,
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
  const providerOutputUrl =
    action === "resume" ? reservation.operation.output_url ?? undefined : undefined;
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
    usage?: { costUsd?: number; generationId?: string },
  ) => {
    await context.store.markGenerationProviderSucceeded({
      jobId: job.id,
      metadata: { provider, role, ...(usage?.costUsd !== undefined ? { providerCostUsd: usage.costUsd } : {}), ...(usage?.generationId ? { generationId: usage.generationId } : {}) },
      operationKey,
      outputUrl,
      providerOperationId: operationId,
    });
  };

  try {
    const params = {
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      model: input.model,
      onOperationCreated,
      prompt,
      providerOperationId,
      providerOutputUrl,
      referenceImageUrl: !providerOperationId && !providerOutputUrl && input.avatarImageUrl
        ? await resolveOwnedPrivateMediaUrl(input.avatarImageUrl, job.user_id ?? "") : input.avatarImageUrl,
      referenceImageUrls: !providerOperationId && !providerOutputUrl
        ? await Promise.all(input.referenceImageUrls.map(url => resolveOwnedPrivateMediaUrl(url, job.user_id ?? ""))) : input.referenceImageUrls,
      referenceAudioUrls: !providerOperationId && !providerOutputUrl
        ? await Promise.all(input.referenceAudioUrls.map(url => resolveOwnedPrivateMediaUrl(url, job.user_id ?? ""))) : input.referenceAudioUrls,
      referenceVideoDurationSeconds: input.referenceVideoDurationSeconds,
      referenceVideoUrl: !providerOperationId && !providerOutputUrl && input.referenceVideoUrl
        ? await resolveOwnedPrivateMediaUrl(input.referenceVideoUrl, job.user_id ?? "") : input.referenceVideoUrl,
      resolution: input.resolution,
    };

    return {
      buffer: await generateProviderBuffer(provider, params, onOperationSucceeded),
      operationKey,
      provider,
    };
  } catch (error) {
    if (error instanceof ProviderOperationTerminalError) {
      await context.store.markGenerationProviderFailed({
        errorCode: error.code,
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

async function generateProviderBuffer(
  provider: HookVideoProvider,
  params: {
    aspectRatio: HookVideoAspectRatio;
    durationSeconds: number;
    model?: "google_omni" | "seedance_2_5" | "kling_3_0";
    onOperationCreated: (operationId: string) => Promise<void>;
    prompt: string;
    providerOperationId?: string;
    providerOutputUrl?: string;
    referenceImageUrl?: string;
    referenceImageUrls?: string[];
    referenceAudioUrls?: string[];
    referenceVideoDurationSeconds?: number;
    referenceVideoUrl?: string;
    resolution: HookVideoResolution;
  },
  onOperationSucceeded: (operationId: string, outputUrl?: string, usage?: { costUsd?: number; generationId?: string }) => Promise<void>,
) {
  if (provider === "openrouter") {
    return generateOpenRouterSeedanceVideoBuffer({ ...params, onOperationSucceeded });
  }
  if (provider === "gemini") {
    return generateGeminiOmniVideoBuffer({
      ...params,
      onOperationSucceeded,
    });
  }

  if (provider === "higgsfield") {
    return resumeLegacyHiggsfieldVideoBuffer({ ...params, onOperationSucceeded });
  }

  if (provider === "runway") {
    if (params.model === "kling_3_0") {
      return generateKlingVideoBuffer({ ...params, onOperationSucceeded });
    }
    if (params.model === "seedance_2_5") {
      return generateRunwaySeedanceVideoBuffer({ ...params, onOperationSucceeded });
    }
    return generateRunwayHookVideoBuffer({
      ...params,
      onOperationSucceeded,
    });
  }

  return generateVeoHookVideoBuffer({
    ...params,
    onOperationSucceeded: async (operationId) =>
      onOperationSucceeded(operationId),
  });
}

function buildOutput(params: {
  bufferSize?: number;
  input: GenerateHookVideoInput;
  provider: HookVideoProvider;
  uploaded: { key: string; url: string };
}) {
  return {
    durationSeconds: getOutputDurationSeconds(params.input, params.provider),
    fileSizeBytes: params.bufferSize,
    key: params.uploaded.key,
    ok: true,
    provider: params.provider,
    ratio: params.input.aspectRatio,
    resolution: params.input.resolution,
    url: params.uploaded.url,
    videoId: params.input.videoId,
  };
}

function getInput(job: BackgroundJobRow): GenerateHookVideoInput {
  if (!isJsonObject(job.input_json)) {
    throw new Error("generate_hook_video input_json must be an object.");
  }

  const promptMode =
    job.input_json.promptMode === "direct" ? "direct" : "ugc_template";
  const model =
    job.input_json.model === "kling_3_0" ? "kling_3_0" :
    job.input_json.model === "seedance_2_5"
      ? "seedance_2_5"
      : job.input_json.model === "google_omni"
        ? "google_omni"
        : undefined;
  const sharedInput: GenerateHookVideoBaseInput = {
    aspectRatio:
      getOptionalChoice(job.input_json.aspectRatio, hookVideoAspectRatios) ??
      "9:16",
    avatarImageUrl: getOptionalHttpsUrl(job.input_json.avatarImageUrl),
    referenceImageUrls: getReferenceImageUrls(job.input_json.referenceImageUrls, job.input_json.avatarImageUrl),
    referenceAudioUrls: getReferenceAudioUrls(job.input_json.referenceAudioUrls),
    durationSeconds: getGenerationDurationSeconds(job.input_json.durationSeconds),
    hookIdea: getText(job.input_json.hookIdea, "hookIdea", MAX_HOOK_LENGTH),
    model,
    projectId: getPathSegment(job.input_json.projectId, "projectId"),
    provider: getOptionalChoice(job.input_json.provider, hookVideoProviders),
    referenceVideoDurationSeconds: getOptionalDurationSeconds(
      job.input_json.referenceVideoDurationSeconds,
      job.input_json.model === "seedance_2_5" ? 30 : 3,
    ),
    referenceVideoUrl: getOptionalHttpsUrl(job.input_json.referenceVideoUrl),
    resolution: getGenerationResolution(job.input_json.resolution, model),
    userId: getPathSegment(job.input_json.userId, "userId"),
    videoId: getPathSegment(job.input_json.videoId, "videoId"),
  };

  if (promptMode === "direct") {
    return { ...sharedInput, promptMode: "direct" };
  }

  return {
    ...sharedInput,
    cameraStyle: getChoice(
      job.input_json.cameraStyle,
      hookVideoCameraStyles,
      "cameraStyle",
    ),
    emotion: getChoice(job.input_json.emotion, hookVideoEmotions, "emotion"),
    productDescription: getOptionalText(
      job.input_json.productDescription,
      MAX_PRODUCT_DESCRIPTION_LENGTH,
    ),
    productName: getOptionalText(
      job.input_json.productName,
      MAX_PRODUCT_NAME_LENGTH,
    ),
    promptMode: "ugc_template",
  };
}

function getOutputDurationSeconds(input: GenerateHookVideoInput, provider: HookVideoProvider) {
  if (input.model === "seedance_2_5" && (provider === "runway" || provider === "openrouter")) return input.durationSeconds;
  return input.referenceVideoUrl
    ? input.referenceVideoDurationSeconds ?? input.durationSeconds
    : input.durationSeconds;
}

function getGenerationDurationSeconds(value: Json | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value >= 3 && value <= 30
    ? value
    : 4;
}

function getGenerationResolution(
  value: Json | undefined,
  model: GenerateHookVideoBaseInput["model"],
): HookVideoResolution {
  const resolution =
    getOptionalChoice(value, hookVideoResolutions) ?? "720p";

  if (model === "seedance_2_5" && resolution === "1080p") {
    throw new Error("Seedance 2.5 supports 480p or 720p video quality.");
  }

  if (model === "google_omni" && resolution === "480p") {
    throw new Error("Google Omni supports 720p or 1080p video quality.");
  }

  return resolution;
}

function getOptionalDurationSeconds(value: Json | undefined, maxDurationSeconds: number) {
  if (typeof value !== "number") {
    return undefined;
  }

  if (!Number.isFinite(value) || value <= 0 || value > maxDurationSeconds) {
    throw new Error(`generate_hook_video reference video must be ${maxDurationSeconds} seconds or shorter.`);
  }

  return value;
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

function getReferenceImageUrls(value: Json | undefined, fallback: Json | undefined): string[] {
  if (value === undefined) {
    const url = getOptionalHttpsUrl(fallback);
    return url ? [url] : [];
  }
  if (!Array.isArray(value) || value.length > 30) {
    throw new Error("generate_hook_video has invalid reference images.");
  }
  const urls = value.map(getOptionalHttpsUrl);
  if (urls.some((url) => !url) || new Set(urls).size !== urls.length) {
    throw new Error("generate_hook_video has invalid reference images.");
  }
  return urls as string[];
}

function getReferenceAudioUrls(value: Json | undefined): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) {
    throw new Error("generate_hook_video has invalid audio references.");
  }
  const urls = value.map(getOptionalHttpsUrl);
  if (urls.some((url) => !url) || new Set(urls).size !== urls.length) {
    throw new Error("generate_hook_video has invalid audio references.");
  }
  return urls as string[];
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
