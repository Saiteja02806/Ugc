import OpenAI from "openai";

import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import type { AIStudioImageRatio } from "./image-output.js";

const DEFAULT_IMAGE_MODEL = "gpt-image-1";

let openaiClient: OpenAI | null = null;

export async function generateOpenAiImageBuffer(
  prompt: string,
  aspectRatio: AIStudioImageRatio = "4:5",
) {
  const result = await getOpenAIClient().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
    prompt,
    size: getProviderImageSize(aspectRatio),
  });
  const imageBase64 = result.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI image generation did not return image data.");
  }

  return {
    buffer: Buffer.from(imageBase64, "base64"),
    model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
    requestId: result._request_id ?? null,
  };
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
