import OpenAI, { toFile } from "openai";

import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import type { AIStudioImageRatio } from "./image-output.js";

const DEFAULT_IMAGE_MODEL = "gpt-image-1";

let openaiClient: OpenAI | null = null;

export async function generateOpenAiImageBuffer(
  prompt: string,
  aspectRatio: AIStudioImageRatio = "4:5",
  referenceImageUrl?: string,
) {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const result = referenceImageUrl
    ? await client.images.edit({
        image: await downloadReferenceImage(referenceImageUrl),
        input_fidelity: "high",
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
  let response: Response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image could not be downloaded.",
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image could not be downloaded.",
    );
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0] ?? "image/png";
  const extension =
    contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image is empty or too large.",
    );
  }

  return toFile(buffer, `reference.${extension}`, { type: contentType });
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
