import { logger } from "../logger.js";
import { getGenerationReferenceSoundtrack, isSilentExploreReference } from "../lib/explore-reference-soundtrack.js";
import { applyGeneratedReferenceAudio, silenceGeneratedVideo } from "../lib/explore-generated-reference-audio.js";
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
import { generateRunwayWanVideoBuffer } from "../lib/runway-wan-video.js";
import { generateOpenRouterSeedanceVideoBuffer } from "../lib/openrouter-seedance-video.js";
import { generateOpenRouterWanVideoBuffer } from "../lib/openrouter-wan-video.js";
import { generateReapiVideoBuffer } from "../lib/reapi-video.js";
import { parseHookKeyframeGenerationReceipt, type HookKeyframeGenerationReceipt } from "../lib/hook-keyframe-generation-contract.js";
import { resolveHookVideoProvider } from "../lib/hook-video-provider.js";
import { generateGeminiOmniVideoBuffer } from "../lib/gemini-omni-video.js";
import { generateKlingVideoBuffer } from "../lib/kling-video.js";
import { resumeLegacyHiggsfieldVideoBuffer } from "../lib/higgsfield-video.js";
import { getVideoPromptCharacterLimit } from "../lib/video-prompt-policy.js";
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
import { assertVideoEditDuration } from "../lib/video-reference-input.js";
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
  referenceAudioDurationSeconds: number[];
  resolution: HookVideoResolution;
  durationSeconds: number;
  hookIdea: string;
  model?: "google_omni" | "seedance_2_5" | "kling_3_0" | "wan_3_0";
  projectId: string;
  provider?: HookVideoProvider;
  referenceVideoDurationSeconds?: number;
  referenceVideoUrl?: string;
  referenceVideoMode?: "edit";
  generateAudio?: boolean;
  startingFrameImageUrl?: string;
  startingFrameAssetId?: string;
  startingFrameJobId?: string;
  startingFrameReceipt?: HookKeyframeGenerationReceipt;
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
  const recoveryInput = isJsonObject(job.input_json) ? job.input_json : undefined;
  const collectionOnly = recoveryInput?.providerOutputRecovery !== undefined;
  if (collectionOnly) {
    const operation = await context.store.getGenerationProviderOperation({ jobId: job.id, operationKey: "primary-reapi" });
    if (recoveryInput?.providerOutputRecovery !== "collection-only-v1" || input.provider !== "reapi" ||
        !["seedance_2_5", "wan_3_0"].includes(input.model ?? "") ||
        operation?.provider !== "reapi" || !operation.provider_operation_id ||
        !["provider_succeeded", "output_persisted"].includes(operation.status)) {
      throw new ProviderOperationTerminalError("The saved completed provider task could not be verified. No new generation was submitted.");
    }
  }
  const prompt = buildVideoGenerationPrompt(input);
  const referenceSoundtrack = input.generateAudio === undefined ? getGenerationReferenceSoundtrack(isJsonObject(job.input_json) ? job.input_json : {}) : null;
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
        persistedProvider === "higgsfield" || persistedProvider === "openrouter" || persistedProvider === "reapi"
          ? persistedProvider
          : undefined) ??
        input.provider ??
        DEFAULT_HOOK_VIDEO_PROVIDER,
      uploaded: existingOutput,
      outputDurationSeconds: input.referenceVideoMode && isJsonObject(persistedOperation?.metadata) && typeof persistedOperation.metadata.durationSeconds === "number"
        ? persistedOperation.metadata.durationSeconds : undefined,
      referenceSoundtrack,
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
  let buffer = assertGeneratedMp4(generated.buffer);
  if (input.generateAudio === false) {
    await context.checkpoint({ progress: 85, stage: "applying_silence", status: "processing" });
    buffer = assertGeneratedMp4(await silenceGeneratedVideo(buffer));
  } else if (referenceSoundtrack) {
    await context.checkpoint({ progress: 85, stage: "applying_reference_audio", status: "processing" });
    buffer = assertGeneratedMp4(await applyGeneratedReferenceAudio(buffer, referenceSoundtrack));
  }
  const { provider } = generated;
  let outputDurationSeconds: number | undefined;
  if (input.referenceVideoMode === "edit") {
    try {
      outputDurationSeconds = assertVideoEditDuration(buffer, input.referenceVideoDurationSeconds!);
    } catch (cause) {
      const error = new ProviderOperationTerminalError(cause instanceof Error ? cause.message : "The reference duration could not be preserved.");
      await context.store.markGenerationProviderFailed({ jobId: job.id, operationKey: generated.operationKey,
        errorCode: error.code, errorMessage: error.message, retryAllowed: false });
      throw error;
    }
  }

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
  const completedOperation = provider === "openrouter" || provider === "reapi"
    ? await context.store.getGenerationProviderOperation({ jobId: job.id, operationKey: generated.operationKey })
    : null;
  await context.store.markGenerationOutputPersisted({
    jobId: job.id,
    metadata: {
      ...(completedOperation && isJsonObject(completedOperation.metadata) ? completedOperation.metadata : {}),
      durationSeconds: outputDurationSeconds ?? getOutputDurationSeconds(input, provider),
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
    outputDurationSeconds,
    referenceSoundtrack,
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
  if (input.startingFrameImageUrl && selectedProvider !== "reapi") {
    throw new ProviderRequestNotSubmittedError("Starting-frame animation cannot change its saved Seedance 2.5 through ReAPI route.");
  }
  if (input.model === "wan_3_0" && selectedProvider !== "runway" && selectedProvider !== "reapi" && (input.referenceVideoUrl || input.referenceAudioUrls.length)) {
    throw new ProviderRequestNotSubmittedError("This saved WAN 3.0 request cannot use audio or video references. Start a new generation with your references.");
  }
  if (input.referenceAudioUrls.length && input.model !== "seedance_2_5" && input.model !== "wan_3_0" && selectedProvider !== "higgsfield") {
    throw new ProviderRequestNotSubmittedError("Choose WAN 3.0 or Seedance 2.5 to use audio references.");
  }

  if (selectedProvider === "higgsfield") {
    return generateWithProvider(job, context, "higgsfield", "primary", input, prompt);
  }

  if (selectedProvider === "openrouter" || selectedProvider === "reapi") {
    return generateWithProvider(job, context, selectedProvider, "primary", input, prompt);
  }

  if (input.referenceVideoMode === "edit") {
    return generateWithProvider(job, context, "gemini", "primary", input, prompt);
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
    ...(input.referenceAudioDurationSeconds.length ? { referenceAudioDurationSeconds: input.referenceAudioDurationSeconds } : {}),
    referenceVideoDurationSeconds: input.referenceVideoDurationSeconds ?? null,
    referenceVideoUrl: input.referenceVideoUrl ?? null,
    ...(input.referenceVideoMode ? { referenceVideoMode: input.referenceVideoMode } : {}),
    ...(input.generateAudio !== undefined ? { generateAudio: input.generateAudio } : {}),
    // Omit every new field for legacy jobs so accepted request fingerprints
    // and their recovery operations remain byte-for-byte compatible.
    ...(input.startingFrameImageUrl ? {
      startingFrameImageUrl: input.startingFrameImageUrl,
      startingFrameAssetId: input.startingFrameAssetId,
      startingFrameJobId: input.startingFrameJobId,
      startingFrameReceipt: input.startingFrameReceipt,
    } : {}),
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
  if (isJsonObject(job.input_json) && job.input_json.providerOutputRecovery !== undefined &&
      (provider !== "reapi" || action !== "resume" ||
        !["provider_succeeded", "output_persisted"].includes(reservation.operation.status))) {
    throw new ProviderOperationTerminalError("Collection recovery cannot submit a new provider generation.");
  }
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
      referenceAudioDurationSeconds: input.referenceAudioDurationSeconds,
      referenceVideoDurationSeconds: input.referenceVideoDurationSeconds,
      referenceVideoMode: input.referenceVideoMode,
      generateAudio: input.generateAudio,
      startingFrameImageUrl: !providerOperationId && !providerOutputUrl && input.startingFrameImageUrl
        ? await resolveOwnedPrivateMediaUrl(input.startingFrameImageUrl, job.user_id ?? input.userId) : input.startingFrameImageUrl,
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
    model?: "google_omni" | "seedance_2_5" | "kling_3_0" | "wan_3_0";
    onOperationCreated: (operationId: string) => Promise<void>;
    prompt: string;
    providerOperationId?: string;
    providerOutputUrl?: string;
    referenceImageUrl?: string;
    referenceImageUrls?: string[];
    referenceAudioUrls?: string[];
    referenceAudioDurationSeconds?: number[];
    referenceVideoDurationSeconds?: number;
    referenceVideoUrl?: string;
    referenceVideoMode?: "edit";
    generateAudio?: boolean;
    startingFrameImageUrl?: string;
    resolution: HookVideoResolution;
  },
  onOperationSucceeded: (operationId: string, outputUrl?: string, usage?: { costUsd?: number; generationId?: string }) => Promise<void>,
) {
  if (provider === "reapi") {
    if (params.model !== "seedance_2_5" && params.model !== "wan_3_0") throw new ProviderRequestNotSubmittedError("Choose Seedance 2.5 or WAN 3.0 for ReAPI.");
    return generateReapiVideoBuffer({ ...params, model: params.model, onOperationSucceeded });
  }
  if (provider === "openrouter") {
    if (params.model === "wan_3_0") return generateOpenRouterWanVideoBuffer({ ...params, onOperationSucceeded });
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
    if (params.model === "wan_3_0") {
      return generateRunwayWanVideoBuffer({ ...params, onOperationSucceeded });
    }
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
  outputDurationSeconds?: number;
  referenceSoundtrack: ReturnType<typeof getGenerationReferenceSoundtrack>;
}) {
  return {
    durationSeconds: params.outputDurationSeconds ?? getOutputDurationSeconds(params.input, params.provider),
    fileSizeBytes: params.bufferSize,
    key: params.uploaded.key,
    ok: true,
    provider: params.provider,
    ratio: params.input.aspectRatio,
    resolution: params.input.resolution,
    url: params.uploaded.url,
    videoId: params.input.videoId,
    ...(params.input.generateAudio !== undefined ? { generateAudio: params.input.generateAudio } : {}),
    ...(params.referenceSoundtrack && !isSilentExploreReference(params.referenceSoundtrack) ? { referenceSoundtrack: { version: 1, referenceId: params.referenceSoundtrack.id, audioSha256: params.referenceSoundtrack.audioSha256, volume: .2 } } : {}),
  };
}

function getInput(job: BackgroundJobRow): GenerateHookVideoInput {
  if (!isJsonObject(job.input_json)) {
    throw new Error("generate_hook_video input_json must be an object.");
  }

  const promptMode =
    job.input_json.promptMode === "direct" ? "direct" : "ugc_template";
  if (job.input_json.generateAudio !== undefined && typeof job.input_json.generateAudio !== "boolean") throw new ProviderRequestNotSubmittedError("Choose a valid sound setting.");
  const model =
    job.input_json.model === "wan_3_0" ? "wan_3_0" :
    job.input_json.model === "kling_3_0" ? "kling_3_0" :
    job.input_json.model === "seedance_2_5"
      ? "seedance_2_5"
      : job.input_json.model === "google_omni"
        ? "google_omni"
        : undefined;
  const provider = getOptionalChoice(job.input_json.provider, hookVideoProviders);
  const referenceVideoUrl = getOptionalHttpsUrl(job.input_json.referenceVideoUrl);
  const referenceVideoMode = job.input_json.referenceVideoMode === "edit" ? "edit" : undefined;
  if ((job.input_json.referenceVideoMode !== undefined && job.input_json.referenceVideoMode !== "edit") ||
      (referenceVideoMode && (!referenceVideoUrl || (model !== "google_omni" && !(model === "seedance_2_5" && provider === "reapi"))))) {
    throw new ProviderRequestNotSubmittedError("Video editing requires Google Omni or Seedance 2.5 through ReAPI and a source video.");
  }
  const hookIdea = getText(job.input_json.hookIdea, "hookIdea", promptMode === "direct" ? undefined : MAX_HOOK_LENGTH);
  const promptMaxLength = getVideoPromptCharacterLimit({ model, provider, hasReferenceVideo: Boolean(referenceVideoUrl), referenceVideoMode });
  if (promptMode === "direct" && promptMaxLength !== undefined && hookIdea.length > promptMaxLength) {
    throw new ProviderRequestNotSubmittedError("This prompt is too long for the selected model. Shorten it and try again.");
  }
  const sharedInput: GenerateHookVideoBaseInput = {
    aspectRatio:
      getOptionalChoice(job.input_json.aspectRatio, hookVideoAspectRatios) ??
      "9:16",
    avatarImageUrl: getOptionalHttpsUrl(job.input_json.avatarImageUrl),
    referenceImageUrls: getReferenceImageUrls(job.input_json.referenceImageUrls, job.input_json.avatarImageUrl),
    referenceAudioUrls: getReferenceAudioUrls(job.input_json.referenceAudioUrls),
    referenceAudioDurationSeconds: getReferenceAudioDurations(job.input_json.referenceAudioDurationSeconds, model === "seedance_2_5" ? 30 : 15),
    durationSeconds: getGenerationDurationSeconds(job.input_json.durationSeconds, model),
    hookIdea,
    model,
    projectId: getPathSegment(job.input_json.projectId, "projectId"),
    provider,
    referenceVideoDurationSeconds: getOptionalDurationSeconds(
      job.input_json.referenceVideoDurationSeconds,
      model === "seedance_2_5" ? 30 : referenceVideoMode ? 10 : model === "wan_3_0" ? 15 : 3,
    ),
    referenceVideoUrl,
    referenceVideoMode,
    ...(typeof job.input_json.generateAudio === "boolean" ? { generateAudio: job.input_json.generateAudio } : {}),
    resolution: getGenerationResolution(job.input_json.resolution, model),
    userId: getPathSegment(job.input_json.userId, "userId"),
    videoId: getPathSegment(job.input_json.videoId, "videoId"),
  };

  const savedInput = job.input_json;
  const hasStartingFrame = ["startingFrameImageUrl", "startingFrameAssetId", "startingFrameJobId", "startingFrameReceipt"]
    .some(field => savedInput[field] !== undefined);
  if (hasStartingFrame) {
    const receipt = parseHookKeyframeGenerationReceipt(job.input_json.startingFrameReceipt);
    const imageUrl = getOptionalHttpsUrl(job.input_json.startingFrameImageUrl);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const assetId = job.input_json.startingFrameAssetId;
    const imageJobId = job.input_json.startingFrameJobId;
    if (promptMode !== "direct" || model !== "seedance_2_5" || provider !== "reapi" ||
      job.input_json.exploreFormat !== "hook" || job.input_json.generationIntent !== "animate_starting_frame" ||
      !imageUrl || typeof assetId !== "string" || !uuid.test(assetId) || typeof imageJobId !== "string" || !uuid.test(imageJobId) ||
      !receipt || receipt.ownerId !== sharedInput.userId || (job.user_id && job.user_id !== sharedInput.userId) ||
      receipt.referenceId !== job.input_json.referenceId || sharedInput.avatarImageUrl || sharedInput.referenceImageUrls.length ||
      sharedInput.referenceAudioUrls.length || sharedInput.referenceAudioDurationSeconds.length || sharedInput.referenceVideoUrl ||
      job.input_json.referenceVideoDurationSeconds != null || job.input_json.referenceVideoMode !== undefined ||
      job.input_json.personReference !== undefined || sharedInput.durationSeconds < 4 || sharedInput.durationSeconds > 15) {
      throw new ProviderRequestNotSubmittedError("The saved starting-frame animation must contain one approved Hook image, its owned generation receipt, Seedance 2.5 through ReAPI, and a fixed duration from 4 to 15 seconds.");
    }
    Object.assign(sharedInput, {
      startingFrameImageUrl: imageUrl, startingFrameAssetId: assetId, startingFrameJobId: imageJobId,
      startingFrameReceipt: receipt, generateAudio: sharedInput.generateAudio ?? false,
    });
  }

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
  if (input.model === "wan_3_0" && (provider === "openrouter" || provider === "runway" || provider === "reapi")) return input.durationSeconds;
  if (input.model === "seedance_2_5" && (provider === "runway" || provider === "openrouter" || provider === "reapi")) return input.durationSeconds;
  return input.referenceVideoUrl
    ? input.referenceVideoDurationSeconds ?? input.durationSeconds
    : input.durationSeconds;
}

function getGenerationDurationSeconds(value: Json | undefined, model: GenerateHookVideoBaseInput["model"]) {
  if (model === "wan_3_0") {
    if (value === undefined) return 5;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 2 || value > 30) {
      throw new ProviderRequestNotSubmittedError("WAN 3.0 duration must be between 2 and 30 seconds.");
    }
    return value;
  }
  if (model === "seedance_2_5" || model === "kling_3_0" || model === "google_omni") {
    if (value === undefined) return 4;
    const minimum = model === "seedance_2_5" ? 4 : 3;
    const maximum = model === "seedance_2_5" ? 30 : model === "kling_3_0" ? 15 : 10;
    if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
      throw new ProviderRequestNotSubmittedError(`Choose a whole-number duration from ${minimum} to ${maximum} seconds for this model.`);
    }
    return value;
  }
  return typeof value === "number" && Number.isInteger(value) && value >= 3 && value <= 30
    ? value
    : 4;
}

function getReferenceAudioDurations(value: Json | undefined, maxSeconds: number): number[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(seconds => typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0 || seconds > maxSeconds)) {
    throw new ProviderRequestNotSubmittedError(`Audio references must be ${maxSeconds} seconds or shorter for this model.`);
  }
  return value as number[];
}

function getGenerationResolution(
  value: Json | undefined,
  model: GenerateHookVideoBaseInput["model"],
): HookVideoResolution {
  if (model === "wan_3_0" && value !== undefined && !hookVideoResolutions.includes(value as HookVideoResolution)) {
    throw new ProviderRequestNotSubmittedError("WAN 3.0 supports 480p, 720p or 1080p video quality.");
  }
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

function getText(value: Json | undefined, fieldName: string, maxLength: number | undefined) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`generate_hook_video requires input.${fieldName}.`);
  }

  return maxLength === undefined ? value.trim() : value.trim().slice(0, maxLength);
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
