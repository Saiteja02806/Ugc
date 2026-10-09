import OpenAI, { toFile } from "openai";

import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import type { AIStudioImageRatio } from "./image-output.js";
import { downloadReferenceImageBytes, downloadReferenceImageContext } from "./reference-image-download.js";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const SLIDESHOW_IMAGE_MODEL = "gpt-image-2.5-sunburst";

let openaiClient: OpenAI | null = null;

export async function generateOpenAiImageBuffer(
  prompt: string,
  aspectRatio: AIStudioImageRatio = "9:16",
  referenceImageUrl?: string | string[],
  modelOverride?: typeof SLIDESHOW_IMAGE_MODEL,
) {
  const client = getOpenAIClient();
  const model = modelOverride || process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const result = referenceImageUrl
    ? await client.images.edit({
        image: Array.isArray(referenceImageUrl)
          ? await Promise.all((await downloadReferenceImageContext(referenceImageUrl)).map((image, index) => referenceImageFile(image, `reference-${index + 1}`)))
          : await downloadReferenceImage(referenceImageUrl),
        ...(model === "gpt-image-1" || model === "gpt-image-1.5" ? { input_fidelity: "high" as const } : {}),
        model,
        prompt,
        size: getProviderImageSize(aspectRatio),
      })
    : await client.images.generate({
        model,
        prompt,
        size: getProviderImageSize(aspectRatio),
      });
  const imageBase64 = result.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI image generation did not return image data.");
  }

  return {
    buffer: Buffer.from(imageBase64, "base64"),
    model,
    requestId: result._request_id ?? null,
  };
}

async function downloadReferenceImage(url: string) {
  return referenceImageFile(await downloadReferenceImageBytes(url), "reference");
}

function referenceImageFile({ buffer, contentType }: { buffer: Buffer; contentType: string }, name: string) {
  const extension =
    contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";

  return toFile(buffer, `${name}.${extension}`, { type: contentType });
}

function getProviderImageSize(aspectRatio: AIStudioImageRatio) {
  if (aspectRatio === "1:1") {
    return "1024x1024" as const;
  }

  return aspectRatio === "16:9"
    ? ("1536x1024" as const)
    : ("1024x1536" as const);
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new ProviderRequestNotSubmittedError("Missing OPENAI_API_KEY.");
  }

  if (!openaiClient) {
    // Provider generation calls are fenced in Supabase. Automatic SDK retries
    // could submit a second paid request before we have a provider receipt.
    openaiClient = new OpenAI({ apiKey, maxRetries: 0 });
  }

  return openaiClient;
}
