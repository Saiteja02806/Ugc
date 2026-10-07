import { generateGeminiImageBuffer, generateGemini3ProImageBuffer, GEMINI_3_PRO_IMAGE_MODEL } from "../lib/gemini-image.js";
import { generateOpenAiImageBuffer } from "../lib/openai-image.js";
import { generateSeedreamImageBuffer, SEEDREAM_5_PRO_IMAGE_MODEL } from "../lib/seedream-image.js";
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

const MAX_CHARACTER_PROMPT_LENGTH = 32_000;


type GenerateImageInput = {
  aspectRatio: AIStudioImageRatio;
  generationId: string;
  model: "gpt_image" | "gemini_3_pro" | "nano_banana_2" | "seedream_5_pro";
  prompt: string;
  referenceImageUrl?: string;
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

  return {
    aspectRatio: getAspectRatio(job.input_json.aspectRatio),
    generationId: generationId.trim(),
    model: getImageModel(job.input_json.model),
    prompt: prompt.trim(),
    referenceImageUrl: getOptionalHttpsUrl(job.input_json.referenceImageUrl),
  };
}

export async function runGenerateImageJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
): Promise<WorkerJobOutput> {
  const input = getInput(job);
  const userId = getPathSegment(job.user_id, "user");
  const projectId = getPathSegment(job.project_id, "default");
  const outputKey = `images/generated/${userId}/${projectId}/${input.generationId}.png`;
  const provider = input.model === "seedream_5_pro" ? "runway" : input.model === "nano_banana_2" || input.model === "gemini_3_pro" ? "gemini" : "openai";
  const stagingKey = `generation-staging/${job.id}/${provider}-image-source.png`;
  const existingOutput = await getStoredObject(outputKey);

  if (existingOutput) {
    return buildOutput(input, existingOutput, provider);
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
    outputKey,
    prompt: input.prompt,
    referenceImageUrl: input.referenceImageUrl ?? null,
  });
  const reservation = await context.store.reserveGenerationProviderOperation({
    jobId: job.id,
    operationKey,
    provider,
    requestFingerprint,
  });
  let generatedImageBuffer: Buffer;

  if (input.model === "gemini_3_pro" || input.model === "seedream_5_pro") {
    generatedImageBuffer = await generateDurableImageForJob(job, context, input, reservation, stagingKey, operationKey);
  } else if (reservation.shouldSubmit) {
    let generated;

    try {
      const referenceImageUrl = input.referenceImageUrl
        ? await resolveOwnedPrivateMediaUrl(input.referenceImageUrl, job.user_id ?? "") : undefined;
      generated =
        input.model === "nano_banana_2"
          ? await generateGeminiImageBuffer(
              input.prompt,
              input.aspectRatio,
              referenceImageUrl,
            )
          : await generateOpenAiImageBuffer(
              input.prompt,
              input.aspectRatio,
              referenceImageUrl,
            );
    } catch (error) {
      return persistProviderSubmissionFailure({
        error,
        jobId: job.id,
        operationKey,
        store: context.store,
      });
    }

    await context.store.markGenerationProviderSucceeded({
      jobId: job.id,
      metadata: { model: generated.model },
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
        model: generated.model,
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
  );
  const dimensions = getAIStudioImageDimensions(input.aspectRatio);

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

  return buildOutput(input, uploaded, provider);
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
    const buffer = await generate({
      aspectRatio: input.aspectRatio,
      prompt: input.prompt,
      referenceImageUrl: action === "submit" && input.referenceImageUrl
        ? await resolveOwnedPrivateMediaUrl(input.referenceImageUrl, job.user_id ?? "") : input.referenceImageUrl,
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
  provider: "gemini" | "openai" | "runway",
) {
  const dimensions = getAIStudioImageDimensions(input.aspectRatio);

  return {
    fileSizeBytes: undefined,
    generationId: input.generationId,
    height: dimensions.height,
    key: uploaded.key,
    ok: true,
    model: input.model,
    provider,
    ratio: input.aspectRatio,
    url: uploaded.url,
    width: dimensions.width,
  };
}

function getImageModel(value: Json | undefined) {
  if (value === "gemini_3_pro" || value === "nano_banana_2" || value === "gpt_image" || value === "seedream_5_pro") return value;
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
