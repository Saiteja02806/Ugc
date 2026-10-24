import { GoogleGenAI } from "@google/genai";

import {
  ProviderOperationPollingError,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";
import type { AIStudioImageRatio } from "./image-output.js";
import { getRequiredProviderEnv } from "./provider-env.js";
import { downloadReferenceImageBytes, downloadReferenceImageContext } from "./reference-image-download.js";
import { hookKeyframePromptSha256, hookKeyframeProviderImageLabels, hookKeyframeSceneBytesMatch, parseHookKeyframeGenerationReceipt, type HookKeyframeGenerationReceipt } from "./hook-keyframe-generation-contract.js";
import { hookKeyframeReceiptImageModel } from "./hook-keyframe-image-model.js";

const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-nano-banana-2.1";
export const GEMINI_3_PRO_IMAGE_MODEL = "gemini-3-pro-image";
export const HOOK_GEMINI_FLASH_IMAGE_MODEL = "gemini-3.1-flash-image";

let googleClient: GoogleGenAI | null = null;

export async function generateGeminiImageBuffer(
  prompt: string,
  aspectRatio: AIStudioImageRatio,
  referenceImageUrl?: string | string[],
  hookKeyframe?: HookKeyframeGenerationReceipt,
  slideshowLabels?: string[],
) {
  const ai = getGoogleClient();
  const model = hookKeyframe && hookKeyframe.version !== 1 ? HOOK_GEMINI_FLASH_IMAGE_MODEL :
    process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  const downloadedImages = Array.isArray(referenceImageUrl) ? await downloadReferenceImageContext(referenceImageUrl) : undefined;
  if (slideshowLabels && (hookKeyframe || slideshowLabels.length !== downloadedImages?.length)) throw new ProviderRequestNotSubmittedError("The slideshow image labels do not match the inputs.");
  const referenceLabels = slideshowLabels ?? verifiedHookImageLabels(prompt, downloadedImages, hookKeyframe, "nano_banana_2");
  const referenceImages = downloadedImages?.map(image => ({ data: image.buffer.toString("base64"), mimeType: image.contentType }));
  const referenceImage = typeof referenceImageUrl === "string"
    ? await downloadReferenceImage(referenceImageUrl)
    : null;
  const interaction = await ai.interactions.create(
    buildGeminiImageRequest({
      aspectRatio,
      model,
      prompt,
      referenceImage,
      referenceImages,
      ...(referenceLabels ? { referenceLabels } : {}),
    }),
  );

  if (interaction.status !== "completed") {
    throw new Error(
      `Nano Banana 2.1 generation ended with status ${interaction.status}.`,
    );
  }

  if (!interaction.output_image?.data) {
    throw new Error("Nano Banana 2.1 did not return image data.");
  }

  return {
    buffer: Buffer.from(interaction.output_image.data, "base64"),
    model,
    requestId: interaction.id,
  };
}

export function buildGeminiImageRequest(params: {
  aspectRatio: AIStudioImageRatio;
  model: string;
  prompt: string;
  referenceImage: { data: string; mimeType: string } | null;
  referenceImages?: { data: string; mimeType: string }[];
  referenceLabels?: string[];
  imageSize?: "1K" | "2K";
}) {
  const images = params.referenceImages ?? (params.referenceImage ? [params.referenceImage] : []);
  if (params.referenceLabels && (params.referenceLabels.length !== images.length || images.length < 1)) {
    throw new ProviderRequestNotSubmittedError("The Hook scene and face input labels could not be verified.");
  }
  return {
    input: images.length
      ? [
          ...images.flatMap((image, index) => [
            ...(params.referenceLabels ? [{ text: params.referenceLabels[index], type: "text" as const }] : []),
            {
              data: image.data,
              mime_type: image.mimeType,
              type: "image" as const,
            },
          ]),
          { text: params.prompt, type: "text" as const },
        ]
      : params.prompt,
    model: params.model,
    response_format: {
      aspect_ratio: params.aspectRatio,
      image_size: params.imageSize ?? "1K",
      type: "image",
    },
  };
}

export async function generateGemini3ProImageBuffer(params: {
  aspectRatio: AIStudioImageRatio;
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  hookKeyframe?: HookKeyframeGenerationReceipt;
  providerOperationId?: string;
  onOperationCreated: (operationId: string) => Promise<void>;
  onOperationSucceeded: (operationId: string) => Promise<void>;
}, clientOverride?: GoogleGenAI) {
  const ai = clientOverride ?? getGoogleClient();
  const startedAt = Date.now();
  let interaction;
  if (params.providerOperationId) {
    try {
      interaction = await ai.interactions.get(params.providerOperationId);
    } catch (cause) {
      throw new ProviderOperationPollingError("Gemini 3 Pro image status could not be read.", { cause });
    }
  } else {
    const prompt = params.prompt.trim();
    if (!prompt) {
      throw new ProviderRequestNotSubmittedError("Gemini 3 Pro requires a non-empty prompt.");
    }
    const downloadedImages = params.referenceImageUrls ? await downloadReferenceImageContext(params.referenceImageUrls) : undefined;
    const referenceLabels = verifiedHookImageLabels(prompt, downloadedImages, params.hookKeyframe, "gemini_3_pro");
    const referenceImages = downloadedImages?.map(image => ({ data: image.buffer.toString("base64"), mimeType: image.contentType }));
    const referenceImage = !referenceImages && params.referenceImageUrl
      ? await downloadReferenceImage(params.referenceImageUrl)
      : null;
    interaction = await ai.interactions.create(buildGeminiImageRequest({
      aspectRatio: params.aspectRatio,
      imageSize: "2K",
      model: GEMINI_3_PRO_IMAGE_MODEL,
      prompt,
      referenceImage,
      referenceImages,
      ...(referenceLabels ? { referenceLabels } : {}),
    }));
    if (!interaction.id) throw new Error("Google returned no image interaction ID; acceptance could not be confirmed.");
    await params.onOperationCreated(interaction.id);
  }
  while (interaction.status === "in_progress") {
    if (Date.now() - startedAt > 8 * 60_000) {
      throw new ProviderOperationPollingError("Gemini 3 Pro image generation is still processing.");
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    try {
      interaction = await ai.interactions.get(interaction.id);
    } catch (cause) {
      throw new ProviderOperationPollingError("Gemini 3 Pro image status could not be read.", { cause });
    }
  }
  if (interaction.status !== "completed" || !interaction.output_image?.data) {
    throw new ProviderOperationTerminalError(
      `Gemini 3 Pro image generation ended with status ${interaction.status} without image data.`,
      interaction,
    );
  }
  await params.onOperationSucceeded(interaction.id);
  return Buffer.from(interaction.output_image.data, "base64");
}

function verifiedHookImageLabels(prompt: string, images: Awaited<ReturnType<typeof downloadReferenceImageContext>> | undefined,
  receipt: HookKeyframeGenerationReceipt | undefined, model: "gemini_3_pro" | "nano_banana_2") {
  if (!receipt) return undefined;
  if (!parseHookKeyframeGenerationReceipt(receipt) || (receipt.promptVersion !== 2 && receipt.promptVersion !== 3 && receipt.promptVersion !== 4) ||
    hookKeyframeReceiptImageModel(receipt) !== model ||
    hookKeyframePromptSha256(prompt) !== receipt.promptSha256 || !images ||
    images.length !== receipt.personImageAssetIds.length + 1) {
    throw new ProviderRequestNotSubmittedError("The starting-frame model or reference inputs could not be verified. No image generation request was sent.");
  }
  if (!hookKeyframeSceneBytesMatch(receipt, images[0])) {
    throw new ProviderRequestNotSubmittedError("The downloaded source image does not match the selected starting frame. No image generation request was sent.");
  }
  return hookKeyframeProviderImageLabels(receipt.personImageAssetIds.length, receipt.promptVersion);
}

function getGoogleClient() {
  if (!googleClient) {
    googleClient = new GoogleGenAI({
      apiKey: getRequiredProviderEnv("GEMINI_API_KEY"),
      httpOptions: { retryOptions: { attempts: 1 } },
    });
  }

  return googleClient;
}

async function downloadReferenceImage(url: string) {
  const { buffer, contentType: mimeType } = await downloadReferenceImageBytes(url);
  if (!mimeType.startsWith("image/")) {
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image is invalid or too large.",
    );
  }

  return { data: buffer.toString("base64"), mimeType };
}
