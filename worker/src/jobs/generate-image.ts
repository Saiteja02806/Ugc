import { generateGeminiImageBuffer } from "../lib/gemini-image.js";
import { generateOpenAiImageBuffer } from "../lib/openai-image.js";
import {
  createGenerationRequestFingerprint,
  persistProviderSubmissionFailure,
  ProviderSubmissionUncertainError,
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

const MAX_PROMPT_LENGTH = 2_000;
type GenerateImageInput = {
  aspectRatio: AIStudioImageRatio;
  generationId: string;
  model: "gpt_image" | "nano_banana_2";
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

  if (prompt.trim().length > MAX_PROMPT_LENGTH) {
    throw new Error(`generate_image prompt exceeds ${MAX_PROMPT_LENGTH} characters.`);
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
  const provider = input.model === "nano_banana_2" ? "gemini" : "openai";
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

  if (reservation.shouldSubmit) {
    let generated;

    try {
      generated =
        input.model === "nano_banana_2"
          ? await generateGeminiImageBuffer(
              input.prompt,
              input.aspectRatio,
              input.referenceImageUrl,
            )
          : await generateOpenAiImageBuffer(
              input.prompt,
              input.aspectRatio,
              input.referenceImageUrl,
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

function buildOutput(
  input: GenerateImageInput,
  uploaded: { key: string; url: string },
  provider: "gemini" | "openai",
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
  return value === "nano_banana_2" ? "nano_banana_2" : "gpt_image";
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
