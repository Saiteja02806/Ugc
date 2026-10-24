import OpenAI, { toFile } from "openai";

import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { getAIStudioImageDimensions, type AIStudioImageRatio } from "./image-output.js";
import { downloadReferenceImageBytes, downloadReferenceImageContext } from "./reference-image-download.js";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const SLIDESHOW_IMAGE_MODEL = "gpt-image-2.5-sunburst";
export const SLIDESHOW_FLARE_IMAGE_MODEL = "gpt-image-2.5-flare";

let openaiClient: OpenAI | null = null;

export async function generateOpenAiImageBuffer(
  prompt: string,
  aspectRatio: AIStudioImageRatio = "9:16",
  referenceImageUrl?: string | string[],
  modelOverride?: typeof SLIDESHOW_IMAGE_MODEL | typeof SLIDESHOW_FLARE_IMAGE_MODEL,
  nativeAspectRatio = false,
  referenceLabels?: string[],
) {
  if (referenceLabels && (!Array.isArray(referenceImageUrl) || referenceLabels.length !== referenceImageUrl.length)) throw new ProviderRequestNotSubmittedError("The image names do not match the provider inputs.");
  const client = getOpenAIClient();
  const model = modelOverride || process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const result = referenceImageUrl
    ? await client.images.edit({
        image: Array.isArray(referenceImageUrl)
          ? await Promise.all((await downloadReferenceImageContext(referenceImageUrl)).map((image, index) => referenceImageFile(image, referenceLabels ? `image-${index + 1}-${referenceLabels[index].replace(/[^a-z0-9-]+/gi, "-").slice(0, 100)}` : `reference-${index + 1}`)))
          : await downloadReferenceImage(referenceImageUrl),
        ...(model === "gpt-image-1" || model === "gpt-image-1.5" ? { input_fidelity: "high" as const } : {}),
        model,
        prompt,
        size: getProviderImageSize(aspectRatio, nativeAspectRatio),
      })
    : await client.images.generate({
        model,
        prompt,
        size: getProviderImageSize(aspectRatio, nativeAspectRatio),
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

function getProviderImageSize(aspectRatio: AIStudioImageRatio, nativeAspectRatio: boolean) {
  if (nativeAspectRatio) {
    const { width, height } = getAIStudioImageDimensions(aspectRatio);
    return `${width}x${height}`;
  }
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
