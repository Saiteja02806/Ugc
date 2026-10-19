import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { AI_STUDIO_IMAGE_RATIOS, type AIStudioImageRatio } from "./image-output.js";
import { getRequiredProviderEnv } from "./provider-env.js";

export const OPENROUTER_SEEDREAM_IMAGE_MODEL = "bytedance-seed/seedream-5-0-pro";
const API_ROOT = "https://openrouter.ai/api/v1";
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 48 * 1024 * 1024;

type SeedreamInput = {
  prompt: string;
  aspectRatio: AIStudioImageRatio;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
};

export function buildOpenRouterSeedreamImageRequest(input: SeedreamInput) {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 4_000 || !AI_STUDIO_IMAGE_RATIOS.includes(input.aspectRatio)) {
    throw new ProviderRequestNotSubmittedError("Seedream requires a description of up to 4,000 characters and a supported aspect ratio.");
  }
  const references = input.referenceImageUrls ?? (input.referenceImageUrl ? [input.referenceImageUrl] : []);
  if (references.length > 10 || new Set(references).size !== references.length ||
      input.referenceImageUrl && input.referenceImageUrls && input.referenceImageUrls[0] !== input.referenceImageUrl) {
    throw new ProviderRequestNotSubmittedError("Choose up to 10 distinct influencer reference images in order.");
  }
  for (const value of references) {
    let url: URL;
    try { url = new URL(value); }
    catch { throw new ProviderRequestNotSubmittedError("Seedream reference images require valid HTTPS URLs."); }
    if (url.protocol !== "https:" || url.username || url.password || value.length > 8_192) {
      throw new ProviderRequestNotSubmittedError("Seedream reference images require valid HTTPS URLs.");
    }
  }
  return {
    model: OPENROUTER_SEEDREAM_IMAGE_MODEL,
    prompt,
    resolution: "1K",
    aspect_ratio: input.aspectRatio,
    n: 1,
    ...(references.length ? { input_references: references.map(url => ({ type: "image_url", image_url: { url } })) } : {}),
  };
}

export async function generateOpenRouterSeedreamImage(input: SeedreamInput, options: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
} = {}) {
  const request = buildOpenRouterSeedreamImageRequest(input);
  const apiKey = getRequiredProviderEnv("OPENROUTER_API_KEY", {
    OPENROUTER_API_KEY: options.apiKey ?? process.env.OPENROUTER_API_KEY,
  });
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${apiKey}` };
  // Only this read is known to happen before any paid image submission.
  try {
    const response = await fetchImpl(`${API_ROOT}/key`, {
      headers, redirect: "error", signal: AbortSignal.timeout(30_000),
    });
    const body = await readJson(response, apiKey);
    const key = asRecord(body.data);
    if (!key || key.is_management_key === true) {
      throw new ProviderRequestNotSubmittedError("Configure a regular OpenRouter inference API key.");
    }
    const estimate = 0.045 + 0.003 * (request.input_references?.length ?? 0);
    if (typeof key.limit_remaining === "number" && key.limit_remaining < estimate) {
      throw new ProviderRequestNotSubmittedError("The OpenRouter API key has insufficient remaining spending allowance for this image.");
    }
  } catch (error) {
    throw new ProviderRequestNotSubmittedError("Could not validate OpenRouter image generation access.", {
      cause: error,
      retryable: !(error instanceof ProviderRequestNotSubmittedError) &&
        (!(error instanceof OpenRouterImageApiError) || error.status === 429 || error.status >= 500),
    });
  }

  // This API returns the image synchronously. Never repeat a paid POST after
  // a timeout, lost response or malformed output: acceptance may be uncertain.
  let response: Response;
  try {
    response = await fetchImpl(`${API_ROOT}/images`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(request), redirect: "error", signal: AbortSignal.timeout(240_000),
    });
  } catch {
    throw new Error("The OpenRouter image submission response was lost.");
  }
  const body = await readJson(response, apiKey);
  const outputs = Array.isArray(body.data) ? body.data : [];
  const output = outputs.length === 1 ? asRecord(outputs[0]) : null;
  const base64 = output?.b64_json;
  if (typeof base64 !== "string" || !base64.length || base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 ||
      base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
      output?.media_type !== undefined && !["image/png", "image/jpeg", "image/webp"].includes(String(output.media_type))) {
    throw new Error("OpenRouter returned no valid image bytes.");
  }
  const buffer = Buffer.from(base64, "base64");
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  const webp = buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES || !(png || jpeg || webp)) {
    throw new Error("OpenRouter returned no valid image bytes.");
  }
  const usage = asRecord(body.usage);
  return {
    buffer, model: OPENROUTER_SEEDREAM_IMAGE_MODEL,
    requestId: response.headers.get("x-request-id") ?? undefined,
    ...(typeof usage?.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0 ? { costUsd: usage.cost } : {}),
  };
}

class OpenRouterImageApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function readJson(response: Response, apiKey: string): Promise<Record<string, unknown>> {
  if (!response.body || Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
    throw new Error("OpenRouter returned an unreadable image response.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error("OpenRouter returned an oversized image response.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  let body: Record<string, unknown> | null = null;
  try { body = asRecord(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
  catch { /* Treat invalid paid responses as uncertain, never retry automatically. */ }
  if (!response.ok || body?.error) {
    const error = asRecord(body?.error);
    const status = response.ok ? (typeof error?.code === "number" ? error.code : 502) : response.status;
    const message = typeof error?.message === "string" ? error.message : `OpenRouter image request failed (${status}).`;
    throw new OpenRouterImageApiError(status, message.replaceAll(apiKey, "[redacted]").slice(0, 1_000));
  }
  if (!body) throw new Error("OpenRouter returned an unreadable image response.");
  return body;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
