import { generateGeminiImageBuffer, generateGemini3ProImageBuffer, GEMINI_3_PRO_IMAGE_MODEL } from "../lib/gemini-image.js";
import { generateOpenAiImageBuffer, SLIDESHOW_IMAGE_MODEL, SLIDESHOW_FLARE_IMAGE_MODEL } from "../lib/openai-image.js";
import { readSlideshowGenerationSlot, slideshowSlotPrompt, type SlideshowGenerationSlot } from "../lib/slideshow-generation-batch.js";
import { parseSlideshowBusinessContext, slideshowBusinessContextPrompt, type SlideshowBusinessContext } from "../lib/slideshow-business-context.js";
import { generateSeedreamImageBuffer, SEEDREAM_5_PRO_IMAGE_MODEL } from "../lib/seedream-image.js";
import { generateOpenRouterSeedreamImage } from "../lib/openrouter-seedream-image.js";
import {
  assertProviderOperationCanContinue,
  createGenerationRequestFingerprint,
  persistProviderSubmissionFailure,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
  ProviderSubmissionUncertainError,
  toProviderPollingRetry,
} from "../lib/generation-provider.js";
import {
  AI_STUDIO_IMAGE_RATIO,
  AI_STUDIO_IMAGE_RATIOS,
  getAIStudioImageDimensions,
  prepareAIStudioImageOutput,
  type AIStudioImageRatio,
} from "../lib/image-output.js";
import {
  downloadStoredObjectBuffer,
  getStoredObject,
  uploadBufferToStorage,
} from "../lib/storage.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext, WorkerJobOutput } from "./index.js";
import { resolveOwnedPrivateMediaUrl } from "../lib/private-media.js";
import { parseImageReferenceContext } from "../lib/image-reference-context.js";
import { slideshowReferencePrompt, slideshowReferenceImagesPrompt } from "../lib/slideshow-reference-prompt.js";
import { parseSlideshowReferenceContract, slideshowGenerationPrompt, type SlideshowReferenceContract } from "../lib/slideshow-generation-contract.js";
import { isHookKeyframeImageInput, parseHookKeyframeGenerationReceipt, hookKeyframeSceneBytesMatch, hookKeyframeProviderImageLabels, type HookKeyframeGenerationReceipt } from "../lib/hook-keyframe-generation-contract.js";
import { downloadReferenceImageContext } from "../lib/reference-image-download.js";

const MAX_CHARACTER_PROMPT_LENGTH = 32_000;


type GenerateImageInput = {
  aspectRatio: AIStudioImageRatio;
  generationId: string;
  model: "gpt_image" | "gpt_image_2_5" | "gpt_image_2_5_flare" | "gemini_3_pro" | "nano_banana_2" | "seedream_5_pro";
  provider?: "runway" | "openrouter";
  slideshowGeneration?: SlideshowGenerationSlot;
  slideshowBusinessContext?: SlideshowBusinessContext;
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  subjectReferenceIndex?: number;
  additionalReferenceStartIndex?: number;
  regenerationReferenceIndex?: number;
  slideshowReferenceContract?: SlideshowReferenceContract;
  hookKeyframe?: HookKeyframeGenerationReceipt;
};

function getInput(job: BackgroundJobRow): GenerateImageInput {
  if (!job.input_json || typeof job.input_json !== "object" || Array.isArray(job.input_json)) {
    throw new Error("generate_image input_json must be an object.");
  }

  const generationId = job.input_json.generationId;
  const prompt = job.input_json.prompt;

  if (typeof generationId !== "string" || !generationId.trim()) {
    throw new Error("generate_image requires input.generationId.");
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("generate_image requires input.prompt.");
  }

  const promptDrivenCharacter = job.input_json.characterSource === "ugc-pilot-characters" &&
    job.input_json.characterVersion === 2 && job.input_json.promptSource === "user" && job.input_json.mode === "custom";
  if (promptDrivenCharacter && prompt.trim().length > MAX_CHARACTER_PROMPT_LENGTH) {
    throw new Error(`generate_image prompt exceeds ${MAX_CHARACTER_PROMPT_LENGTH} characters.`);

  }

  const model = getImageModel(job.input_json.model);
  const provider = job.input_json.provider;
  if (provider !== undefined && (model !== "seedream_5_pro" || provider !== "runway" && provider !== "openrouter")) {
    throw new ProviderRequestNotSubmittedError("This image job has an unsupported provider route.");
  }
  const characterReferenceContext = promptDrivenCharacter && job.input_json.exploreFormat === undefined;
  const referenceImageUrl = getOptionalHttpsUrl(job.input_json.referenceImageUrl);
  const referenceImageUrls = job.input_json.referenceImageUrls === undefined ? undefined : parseImageReferenceContext(job.input_json.referenceImageUrls);
  const hookKeyframe = job.input_json.hookKeyframe === undefined ? undefined : parseHookKeyframeGenerationReceipt(job.input_json.hookKeyframe);
  if (hookKeyframe && model === "seedream_5_pro" && provider !== "openrouter") throw new ProviderRequestNotSubmittedError("Starting-frame Seedream jobs require the saved OpenRouter route.");
  if (job.input_json.hookKeyframe !== undefined && (!hookKeyframe || job.input_json.exploreFormat !== "hook" ||
    job.input_json.slideshowReferenceContract !== undefined || job.input_json.slideshowGeneration !== undefined ||
    job.input_json.slideshowBusinessContext !== undefined || job.input_json.subjectReferenceIndex !== undefined ||
    job.input_json.additionalReferenceStartIndex !== undefined || job.input_json.regenerationReferenceIndex !== undefined ||
    job.input_json.characterSource !== undefined || !isHookKeyframeImageInput({ receipt: hookKeyframe, ownerId: job.user_id,
      model, aspectRatio: String(job.input_json.aspectRatio), prompt: prompt.trim(), referenceImageUrl, referenceImageUrls }))) {
    throw new ProviderRequestNotSubmittedError("This Hook starting-image contract could not be verified.");
  }
  const slideshowReferenceContract = job.input_json.slideshowReferenceContract === undefined ? undefined
    : parseSlideshowReferenceContract(job.input_json.slideshowReferenceContract, referenceImageUrls?.length ?? (referenceImageUrl ? 1 : 0));
  const slideshowGeneration = readSlideshowGenerationSlot(job.input_json.slideshowGeneration);
  const slideshowBusinessContext = parseSlideshowBusinessContext(job.input_json.slideshowBusinessContext);
  if (job.input_json.slideshowBusinessContext !== undefined && (!slideshowBusinessContext || job.input_json.exploreFormat !== "slideshow") || slideshowGeneration && !slideshowBusinessContext) throw new ProviderRequestNotSubmittedError("This slideshow job requires its saved business context.");
  if (job.input_json.slideshowGeneration !== undefined && (!slideshowGeneration || job.input_json.exploreFormat !== "slideshow")) throw new ProviderRequestNotSubmittedError("Invalid slideshow output position.");
  if (slideshowReferenceContract && (job.input_json.exploreFormat !== "slideshow" || !["gpt_image_2_5", "gpt_image_2_5_flare", "nano_banana_2"].includes(model))) throw new ProviderRequestNotSubmittedError("This image job does not support the slideshow reference contract.");
  if (slideshowReferenceContract?.version === 4 && slideshowGeneration && slideshowReferenceContract.plan!.outputSlideIndex !== slideshowGeneration.slideIndex) throw new ProviderRequestNotSubmittedError("The saved slide plan does not match this output position.");
  if (referenceImageUrls && characterReferenceContext && referenceImageUrls.length > 10) throw new ProviderRequestNotSubmittedError("Choose up to 10 influencer references.");
  if (referenceImageUrls && !characterReferenceContext && !hookKeyframe && (job.input_json.exploreFormat !== "slideshow" || !["gpt_image_2_5", "gpt_image_2_5_flare", "nano_banana_2"].includes(model))) {
    throw new Error("This image job does not support slideshow reference context.");
  }
  if (referenceImageUrls && referenceImageUrl && referenceImageUrls[0] !== referenceImageUrl) {
    throw new Error("The primary image must be the first selected reference.");
  }
  const subjectReferenceIndex = job.input_json.subjectReferenceIndex;
  if (subjectReferenceIndex !== undefined && (!referenceImageUrls || !Number.isInteger(subjectReferenceIndex) || subjectReferenceIndex !== referenceImageUrls.length || referenceImageUrls.length < 2)) {
    throw new ProviderRequestNotSubmittedError("Choose valid layout and subject reference roles.");
  }
  const additionalReferenceStartIndex = job.input_json.additionalReferenceStartIndex;
  if (additionalReferenceStartIndex !== undefined && (!referenceImageUrls || subjectReferenceIndex !== undefined || typeof additionalReferenceStartIndex !== "number" || !Number.isInteger(additionalReferenceStartIndex) || additionalReferenceStartIndex < 1 || additionalReferenceStartIndex > referenceImageUrls.length)) {
    throw new ProviderRequestNotSubmittedError("Choose valid slideshow and additional reference roles.");
  }
  const regenerationReferenceIndex = job.input_json.regenerationReferenceIndex;
  if (regenerationReferenceIndex !== undefined && (!referenceImageUrls || additionalReferenceStartIndex === undefined || !Number.isInteger(regenerationReferenceIndex) || regenerationReferenceIndex !== referenceImageUrls.length)) {
    throw new ProviderRequestNotSubmittedError("Choose valid regeneration reference roles.");
  }
  return {
    aspectRatio: getAspectRatio(job.input_json.aspectRatio),
    generationId: generationId.trim(),
    model,
    ...(provider === undefined ? {} : { provider }),
    prompt: prompt.trim(),
    referenceImageUrl: referenceImageUrls?.[0] ?? referenceImageUrl,
    referenceImageUrls,
    ...(hookKeyframe ? { hookKeyframe } : {}),
    ...(subjectReferenceIndex === undefined ? {} : { subjectReferenceIndex: subjectReferenceIndex as number }),
    ...(additionalReferenceStartIndex === undefined ? {} : { additionalReferenceStartIndex }),
    ...(regenerationReferenceIndex === undefined ? {} : { regenerationReferenceIndex: regenerationReferenceIndex as number }),
    ...(slideshowReferenceContract ? { slideshowReferenceContract } : {}),
    ...(slideshowGeneration ? { slideshowGeneration } : {}),
    ...(slideshowBusinessContext ? { slideshowBusinessContext } : {}),
  };
}

export async function runGenerateImageJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
): Promise<WorkerJobOutput> {
  const input = getInput(job);
  const preserveReference = input.slideshowReferenceContract?.version === 3 || input.slideshowReferenceContract?.version === 4;
  const contextualPrompt = input.slideshowBusinessContext ? slideshowBusinessContextPrompt(input.prompt, input.slideshowBusinessContext, preserveReference) : input.prompt;
  const slidePrompt = input.slideshowGeneration ? slideshowSlotPrompt(contextualPrompt, input.slideshowGeneration, preserveReference) : contextualPrompt;
  const referencePrompt = input.slideshowReferenceContract
    ? slideshowGenerationPrompt(slidePrompt, input.aspectRatio, input.slideshowReferenceContract)
    : input.additionalReferenceStartIndex
    ? slideshowReferenceImagesPrompt(slidePrompt, input.referenceImageUrls!.length, input.additionalReferenceStartIndex, input.regenerationReferenceIndex)
    : input.subjectReferenceIndex
    ? slideshowReferencePrompt(slidePrompt, input.referenceImageUrls!.length, input.subjectReferenceIndex)
    : slidePrompt;
  const providerPrompt = input.slideshowReferenceContract?.version === 4 && input.slideshowBusinessContext
    ? slideshowBusinessContextPrompt(referencePrompt, input.slideshowBusinessContext, true) : referencePrompt;
  if ((input.slideshowReferenceContract || input.slideshowBusinessContext || input.slideshowGeneration) && providerPrompt.length > 32_000) throw new ProviderRequestNotSubmittedError("Shorten the slideshow instructions to fit within 32,000 characters including reference guidance.");
  const userId = getPathSegment(job.user_id, "user");
  const projectId = getPathSegment(job.project_id, "default");
  const outputKey = `images/generated/${userId}/${projectId}/${input.generationId}.png`;
  // Jobs admitted before the OpenRouter switch have no route field. Keep their
  // Runway operation key and fingerprint so recovery cannot spend twice.
  const provider = input.model === "seedream_5_pro" ? input.provider ?? "runway" : input.model === "nano_banana_2" || input.model === "gemini_3_pro" ? "gemini" : "openai";
  const stagingKey = `generation-staging/${job.id}/${provider}-image-source.png`;
  const existingOutput = await getStoredObject(outputKey);
  const dimensions = getAIStudioImageDimensions(input.aspectRatio);

  if (existingOutput) {
    return buildOutput(input, existingOutput, provider, providerPrompt, dimensions);
  }

  await context.checkpoint({
    stage: "waiting_for_image_provider",
    status: "waiting_external_service",
  });
  const operationKey = `${provider}-image`;
  const requestFingerprint = createGenerationRequestFingerprint({
    aspectRatio: input.aspectRatio,
    generationId: input.generationId,
    model: input.model,
    ...(input.provider === undefined ? {} : { provider: input.provider }),
    outputKey,
    prompt: input.prompt,
    referenceImageUrl: input.referenceImageUrl ?? null,
    // Keep older queued jobs' fingerprints unchanged.
    ...(input.referenceImageUrls ? { referenceImageUrls: input.referenceImageUrls } : {}),
    ...(input.subjectReferenceIndex ? { subjectReferenceIndex: input.subjectReferenceIndex } : {}),
    ...(input.additionalReferenceStartIndex ? { additionalReferenceStartIndex: input.additionalReferenceStartIndex } : {}),
    ...(input.regenerationReferenceIndex ? { regenerationReferenceIndex: input.regenerationReferenceIndex } : {}),
    ...(input.slideshowReferenceContract ? { slideshowReferenceContract: input.slideshowReferenceContract } : {}),
    ...(input.slideshowGeneration ? { slideshowGeneration: input.slideshowGeneration } : {}),
    ...(input.slideshowBusinessContext ? { slideshowBusinessContext: input.slideshowBusinessContext } : {}),
    ...(input.hookKeyframe ? { hookKeyframe: input.hookKeyframe } : {}),
  });
  const reservation = await context.store.reserveGenerationProviderOperation({
    jobId: job.id,
    operationKey,
    provider,
    requestFingerprint,
  });
  let generatedImageBuffer: Buffer;

  if (input.model === "gemini_3_pro" || input.model === "seedream_5_pro" && provider === "runway") {
    generatedImageBuffer = await generateDurableImageForJob(job, context, input, reservation, stagingKey, operationKey);
  } else if (reservation.shouldSubmit) {
    let generated;

    try {
      const referenceImageUrl = input.referenceImageUrl
        ? await resolveOwnedPrivateMediaUrl(input.referenceImageUrl, job.user_id ?? "") : undefined;
      const referenceImages = input.referenceImageUrls
        ? [referenceImageUrl!, ...await Promise.all(input.referenceImageUrls.slice(1).map(url => resolveOwnedPrivateMediaUrl(url, job.user_id ?? "")))]
        : referenceImageUrl;
      const plan = input.slideshowReferenceContract?.version === 4 ? input.slideshowReferenceContract.plan : undefined;
      const hook = input.hookKeyframe;
      if (hook && !["gemini_3_pro", "nano_banana_2"].includes(input.model)) {
        const downloaded = await downloadReferenceImageContext(referenceImages as string[]);
        if (downloaded.length !== hook.personImageAssetIds.length + 1 || !hookKeyframeSceneBytesMatch(hook, downloaded[0])) throw new ProviderRequestNotSubmittedError("The starting frame does not match its verified source. No image generation was submitted.");
      }
      const hookLabels = hook && !["gemini_3_pro", "nano_banana_2"].includes(input.model) ? hookKeyframeProviderImageLabels(hook.personImageAssetIds.length, hook.promptVersion === 1 ? 2 : hook.promptVersion) : undefined;
      const labelledPrompt = hookLabels ? `${providerPrompt}\n\nIMAGE INPUT ORDER:\n${hookLabels.join("\n")}` : providerPrompt;
      if (input.model === "seedream_5_pro" && labelledPrompt.length > 4_000) throw new ProviderRequestNotSubmittedError("Shorten the Seedream image instructions to fit its 4,000-character limit including image roles.");
      const referenceLabels = hookLabels ?? (plan ? input.referenceImageUrls!.map((_, index) => plan.images.filter(image => image.imageIndex === index + 1).map(image => `${image.label} (${image.role})`).join("; ")) : undefined);
      generated =
        input.model === "seedream_5_pro"
          ? await generateOpenRouterSeedreamImage({
              prompt: labelledPrompt, aspectRatio: input.aspectRatio,
              referenceImageUrl,
              ...(input.referenceImageUrls ? { referenceImageUrls: referenceImages as string[] } : {}),
            })
          : input.model === "nano_banana_2"
          ? referenceLabels ? await generateGeminiImageBuffer(providerPrompt, input.aspectRatio, referenceImages, undefined, referenceLabels) : await generateGeminiImageBuffer(
              providerPrompt,
              input.aspectRatio,
              referenceImages,
              ...(input.hookKeyframe && input.hookKeyframe.promptVersion >= 2 ? [input.hookKeyframe] as const : []),
            )
          : await generateOpenAiImageBuffer(
              labelledPrompt,
              input.aspectRatio,
              referenceImages,
              input.model === "gpt_image_2_5" ? SLIDESHOW_IMAGE_MODEL : input.model === "gpt_image_2_5_flare" ? SLIDESHOW_FLARE_IMAGE_MODEL : undefined,
              Boolean(input.slideshowReferenceContract || input.hookKeyframe),
              ...(referenceLabels ? [referenceLabels] as const : []),
            );
    } catch (error) {
      return persistProviderSubmissionFailure({
        error,
        jobId: job.id,
        operationKey,
        store: context.store,
      });
    }

    const providerMetadata = {
      model: generated.model,
      ...("costUsd" in generated && typeof generated.costUsd === "number" ? { costUsd: generated.costUsd } : {}),
    };
    await context.store.markGenerationProviderSucceeded({
      jobId: job.id,
      metadata: providerMetadata,
      operationKey,
      providerOperationId: generated.requestId ?? undefined,
    });
    const staged = await uploadBufferToStorage({
      buffer: generated.buffer,
      cacheControl: "private, max-age=86400",
      contentType: "image/png",
      key: stagingKey,
    });
    await context.store.markGenerationProviderSucceeded({
      jobId: job.id,
      metadata: {
        ...providerMetadata,
        stagingKey: staged.key,
      },
      operationKey,
      providerOperationId: generated.requestId ?? undefined,
    });
    generatedImageBuffer = generated.buffer;
  } else {
    const savedStagingKey = getJsonString(
      reservation.operation.metadata,
      "stagingKey",
    );

    if (
      !savedStagingKey ||
      !["provider_succeeded", "output_persisted"].includes(
        reservation.operation.status,
      )
    ) {
      throw new ProviderSubmissionUncertainError();
    }

    generatedImageBuffer = await downloadStoredObjectBuffer(savedStagingKey);
  }

  await context.checkpoint({
    progress: 80,
    stage: "processing_image",
    status: "processing",
  });
  const imageBuffer = await prepareAIStudioImageOutput(
    generatedImageBuffer,
    input.aspectRatio,
    { preserveComposition: Boolean(input.slideshowReferenceContract || input.hookKeyframe),
      ...(input.hookKeyframe && input.hookKeyframe.version !== 1 && input.hookKeyframe.promptVersion >= 2 ? { cropNearRatioPadding: true } : {}) },
  );

  await context.checkpoint({
    progress: 90,
    stage: "uploading_image",
    status: "uploading_output",
  });
  const uploaded = await uploadBufferToStorage({
    buffer: imageBuffer,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "image/png",
    key: outputKey,
  });

  await context.store.markGenerationOutputPersisted({
    jobId: job.id,
    metadata: {
      height: dimensions.height,
      ratio: input.aspectRatio,
      stagingKey,
      width: dimensions.width,
    },
    operationKey,
    outputReference: uploaded.key,
    outputUrl: uploaded.url,
  });

  return buildOutput(input, uploaded, provider, providerPrompt, dimensions);
}

async function generateDurableImageForJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
  input: GenerateImageInput,
  reservation: Awaited<ReturnType<WorkerJobContext["store"]["reserveGenerationProviderOperation"]>>,
  stagingKey: string,
  operationKey: string,
) {
  const generate = input.model === "seedream_5_pro" ? generateSeedreamImageBuffer : generateGemini3ProImageBuffer;
  const providerModel = input.model === "seedream_5_pro" ? SEEDREAM_5_PRO_IMAGE_MODEL : GEMINI_3_PRO_IMAGE_MODEL;
  const action = assertProviderOperationCanContinue(reservation);
  let operationSubmitted = action === "resume";
  const operationId = action === "resume" ? reservation.operation.provider_operation_id ?? undefined : undefined;

  try {
    const savedStagingKey = getJsonString(reservation.operation.metadata, "stagingKey");
    if (action === "resume" && savedStagingKey && ["provider_succeeded", "output_persisted"].includes(reservation.operation.status)) {
      return await downloadStoredObjectBuffer(savedStagingKey);
    }
    let acceptedOperationId = operationId;
    const referenceImageUrls = input.referenceImageUrls && action === "submit"
      ? await Promise.all(input.referenceImageUrls.map(url => resolveOwnedPrivateMediaUrl(url, job.user_id ?? ""))) : input.referenceImageUrls;
    const buffer = await generate({
      aspectRatio: input.aspectRatio,
      prompt: input.prompt,
      referenceImageUrl: referenceImageUrls?.[0] ?? (action === "submit" && input.referenceImageUrl
        ? await resolveOwnedPrivateMediaUrl(input.referenceImageUrl, job.user_id ?? "") : input.referenceImageUrl),
      ...(referenceImageUrls ? { referenceImageUrls } : {}),
      ...(input.hookKeyframe && input.hookKeyframe.promptVersion >= 2 ? { hookKeyframe: input.hookKeyframe } : {}),
      providerOperationId: operationId,
      onOperationCreated: async (providerOperationId) => {
        await context.store.markGenerationProviderSubmitted({ jobId: job.id, operationKey, providerOperationId });
        operationSubmitted = true;
        acceptedOperationId = providerOperationId;
      },
      onOperationSucceeded: async (providerOperationId) => {
        await context.store.markGenerationProviderSucceeded({
          jobId: job.id, operationKey, providerOperationId,
          metadata: { model: providerModel },
        });
        acceptedOperationId = providerOperationId;
      },
    });
    const staged = await uploadBufferToStorage({
      buffer, cacheControl: "private, max-age=86400", contentType: "image/png", key: stagingKey,
    });
    await context.store.markGenerationProviderSucceeded({
      jobId: job.id, operationKey,
      providerOperationId: acceptedOperationId,
      metadata: { model: providerModel, stagingKey: staged.key },
    });
    return buffer;
  } catch (error) {
    if (error instanceof ProviderOperationTerminalError) {
      await context.store.markGenerationProviderFailed({
        jobId: job.id, operationKey, errorCode: "provider_operation_terminal",
        errorMessage: error.message, retryAllowed: false,
      });
      throw error;
    }
    if (operationSubmitted) throw toProviderPollingRetry(error);
    return persistProviderSubmissionFailure({ error, jobId: job.id, operationKey, store: context.store });
  }
}

function buildOutput(
  input: GenerateImageInput,
  uploaded: { key: string; url: string },
  provider: "gemini" | "openai" | "runway" | "openrouter",
  effectivePrompt: string,
  dimensions: { width: number; height: number },
) {

  return {
    fileSizeBytes: undefined,
    generationId: input.generationId,
    ...(input.hookKeyframe ? { hookKeyframe: input.hookKeyframe } : {}),
    ...(input.slideshowGeneration ? { slideshowGeneration: input.slideshowGeneration } : {}),
    height: dimensions.height,
    key: uploaded.key,
    ok: true,
    model: input.model,
    prompt: input.prompt,
    effectivePrompt,
    provider,
    ratio: input.aspectRatio,
    url: uploaded.url,
    width: dimensions.width,
  };
}

function getImageModel(value: Json | undefined) {
  if (value === "gemini_3_pro" || value === "nano_banana_2" || value === "gpt_image" || value === "gpt_image_2_5" || value === "gpt_image_2_5_flare" || value === "seedream_5_pro") return value;
  if (value === undefined || value === null) return "gpt_image";
  throw new ProviderRequestNotSubmittedError("generate_image received an unsupported image model.");
}

function getAspectRatio(value: Json | undefined): AIStudioImageRatio {
  return AI_STUDIO_IMAGE_RATIOS.includes(value as AIStudioImageRatio)
    ? (value as AIStudioImageRatio)
    : AI_STUDIO_IMAGE_RATIO;
}

function getOptionalHttpsUrl(value: Json | undefined) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const url = new URL(value.trim());

  if (url.protocol !== "https:") {
    throw new Error("generate_image referenceImageUrl must use HTTPS.");
  }

  return url.toString();
}

function getJsonString(value: Json, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const child = value[key];

  return typeof child === "string" && child.trim() ? child.trim() : null;
}

function getPathSegment(value: string | null, fallback: string) {
  return value
    ?.trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || fallback;
}
