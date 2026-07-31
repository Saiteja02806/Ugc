import { logger } from "../logger.js";
import { generateRunwayHookVideoBuffer } from "../lib/runway-video.js";
import { uploadBufferToS3 } from "../lib/s3.js";
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
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobOutput } from "./index.js";

type GenerateHookVideoInput = {
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

const MAX_HOOK_LENGTH = 1_000;
const MAX_PRODUCT_NAME_LENGTH = 120;
const MAX_PRODUCT_DESCRIPTION_LENGTH = 500;

export async function runGenerateHookVideoJob(
  job: BackgroundJobRow,
): Promise<WorkerJobOutput> {
  const input = getInput(job);
  const prompt = buildUgcVideoPrompt(input);
  const generated = await generateWithFallback(input, prompt);
  const buffer = assertGeneratedMp4(generated.buffer);
  const { provider } = generated;

  logger.info("Hook video generated", {
    bufferSize: buffer.length,
    provider,
    videoId: input.videoId,
  });

  const uploaded = await uploadBufferToS3({
    buffer,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "video/mp4",
    key: `videos/hooks/${input.userId}/${input.projectId}/${input.videoId}.mp4`,
  });

  return {
    key: uploaded.key,
    ok: true,
    provider,
    url: uploaded.url,
    videoId: input.videoId,
  };
}

async function generateWithFallback(
  input: GenerateHookVideoInput,
  prompt: string,
) {
  const preferredProvider = input.provider ?? DEFAULT_HOOK_VIDEO_PROVIDER;

  if (preferredProvider === "runway") {
    return generateWithProvider("runway", input, prompt);
  }

  try {
    return await generateWithProvider("veo", input, prompt);
  } catch (veoError) {
    const veoErrorMessage = getErrorMessage(veoError);

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
      return await generateWithProvider("runway", input, prompt);
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
  provider: HookVideoProvider,
  input: GenerateHookVideoInput,
  prompt: string,
) {
  const params = {
    prompt,
    referenceImageUrl: input.avatarImageUrl,
  };

  if (provider === "runway") {
    return {
      buffer: await generateRunwayHookVideoBuffer(params),
      provider,
    };
  }

  return {
    buffer: await generateVeoHookVideoBuffer(params),
    provider,
  };
}

function getInput(job: BackgroundJobRow): GenerateHookVideoInput {
  if (!isJsonObject(job.input_json)) {
    throw new Error("generate_hook_video input_json must be an object.");
  }

  return {
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
