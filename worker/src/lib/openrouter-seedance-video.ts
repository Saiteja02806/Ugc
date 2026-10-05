import { downloadVideoToBuffer } from "./download-video.js";
import {
  ProviderOperationPollingError,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";

const API_ROOT = "https://openrouter.ai/api/v1";
export const OPENROUTER_SEEDANCE_MODEL = "bytedance/seedance-2.5";

type SeedanceInput = {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  referenceVideoUrl?: string;
  resolution: "480p" | "720p" | "1080p";
};

type ProviderUsage = { costUsd?: number; generationId?: string };
type ClientOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

export function buildOpenRouterSeedanceRequest(input: SeedanceInput) {
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 4 || input.durationSeconds > 30) {
    throw new ProviderRequestNotSubmittedError("Seedance 2.5 duration must be between 4 and 30 seconds.");
  }
  if (input.resolution !== "480p" && input.resolution !== "720p") {
    throw new ProviderRequestNotSubmittedError("Seedance 2.5 supports 480p or 720p video quality.");
  }
  if (input.aspectRatio !== "9:16" && input.aspectRatio !== "16:9") {
    throw new ProviderRequestNotSubmittedError("Choose a supported Seedance 2.5 aspect ratio.");
  }
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 10_000) {
    throw new ProviderRequestNotSubmittedError("Add a prompt within the supported video input length.");
  }
  const images = input.referenceImageUrls?.length
    ? input.referenceImageUrls : input.referenceImageUrl ? [input.referenceImageUrl] : [];
  if (images.length > 6 || new Set(images).size !== images.length || images.some((url) => !isHttpsUrl(url))) {
    throw new ProviderRequestNotSubmittedError("Seedance 2.5 accepts up to six distinct uploaded image references in UGC Pilot.");
  }
  const audio = input.referenceAudioUrls ?? [];
  const media = [...images, ...audio, ...(input.referenceVideoUrl ? [input.referenceVideoUrl] : [])];
  if (media.length > 6 || audio.length > 1 || media.some(url => !isHttpsUrl(url)) || new Set(media).size !== media.length) {
    throw new ProviderRequestNotSubmittedError("Use up to six distinct HTTPS references, including one audio and one video reference, in UGC Pilot.");
  }
  // OpenRouter Seedance 2.5 accepts all three input_references modalities.
  // These guide generation; there is no soundtrack mixing or demo append here.
  const inputReferences = [
    ...images.map(url => ({ type: "image_url" as const, image_url: { url } })),
    ...audio.map(url => ({ type: "audio_url" as const, audio_url: { url } })),
    ...(input.referenceVideoUrl ? [{ type: "video_url" as const, video_url: { url: input.referenceVideoUrl } }] : []),
  ];
  return {
    model: OPENROUTER_SEEDANCE_MODEL,
    prompt,
    duration: input.durationSeconds,
    resolution: input.resolution,
    aspect_ratio: input.aspectRatio,
    generate_audio: true,
    ...(inputReferences.length ? { input_references: inputReferences } : {}),
  };
}

export async function generateOpenRouterSeedanceVideoBuffer(input: SeedanceInput & {
  onOperationCreated: (id: string) => Promise<void>;
  onOperationSucceeded: (id: string, outputUrl?: string, usage?: ProviderUsage) => Promise<void>;
  providerOperationId?: string;
  providerOutputUrl?: string;
}, options: ClientOptions = {}) {
  const apiKey = getRequiredProviderEnv("OPENROUTER_API_KEY", {
    OPENROUTER_API_KEY: options.apiKey ?? process.env.OPENROUTER_API_KEY,
  });
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${apiKey}` };
  let id = input.providerOperationId;

  if (!id) {
    const request = buildOpenRouterSeedanceRequest(input);
    // Reads happen before a paid submission. Their failures are safe to retry.
    try {
      const key = asRecord((await fetchJson(`${API_ROOT}/key`, { headers }, fetchImpl, apiKey)).data);
      if (!key || key.is_management_key === true) {
        throw new ProviderRequestNotSubmittedError("Configure a regular OpenRouter inference API key.");
      }
      // Video-reference requests require a $2 authorization on OpenRouter.
      // Keep the larger output estimate as a conservative spending guard.
      const estimatedCost = Math.max(input.referenceVideoUrl ? 2 : 0, estimateOpenRouterSeedanceCost(input.resolution as "480p" | "720p", input.durationSeconds));
      if (typeof key.limit_remaining === "number" && key.limit_remaining < estimatedCost) {
        throw new ProviderRequestNotSubmittedError("The OpenRouter API key has insufficient remaining spending allowance for this video.");
      }
    } catch (error) {
      throw new ProviderRequestNotSubmittedError(
        error instanceof Error ? error.message : "Could not validate the OpenRouter API key.",
        { cause: error, retryable: !(error instanceof ProviderRequestNotSubmittedError) && (!(error instanceof OpenRouterApiError) || error.status === 429 || error.status >= 500) },
      );
    }

    // Never automatically retry a POST: a lost response may still mean a paid job exists.
    const submitted = await fetchJson(`${API_ROOT}/videos`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(request),
    }, fetchImpl, apiKey);
    if (typeof submitted.id !== "string" || !submitted.id.trim() || submitted.id.length > 4096) {
      throw new Error("OpenRouter accepted a response without a recoverable video job ID.");
    }
    id = submitted.id;
    await input.onOperationCreated(id);
  }

  // Build our own same-origin URL. Provider URLs and redirects must never receive our key.
  const jobUrl = `${API_ROOT}/videos/${encodeURIComponent(id)}`;
  const contentUrl = `${jobUrl}/content?index=0`;
  if (!input.providerOutputUrl) {
    const deadline = Date.now() + (options.timeoutMs ?? 24 * 60_000);
    while (true) {
      const job = await fetchJson(jobUrl, { headers }, fetchImpl, apiKey);
      if (job.status === "completed") {
        const usage = asRecord(job.usage);
        await input.onOperationSucceeded(id, contentUrl, {
          ...(typeof usage?.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0 ? { costUsd: usage.cost } : {}),
          ...(typeof job.generation_id === "string" ? { generationId: job.generation_id } : {}),
        });
        break;
      }
      if (["failed", "cancelled", "expired"].includes(String(job.status))) {
        const error = asRecord(job.error);
        const message = redact(
          typeof job.error === "string" ? job.error : typeof error?.message === "string" ? error.message : `OpenRouter video generation ${job.status}.`, apiKey,
        );
        const moderated = /moderation|content[ _-]*policy|safety|policy[ _-]*violation/i.test(`${error?.code ?? ""} ${message}`);
        throw new ProviderOperationTerminalError(message, { failureCode: moderated ? "SAFETY.OPENROUTER" : "OPENROUTER.GENERATION_FAILED" });
      }
      if (job.status !== "pending" && job.status !== "in_progress") {
        throw new ProviderOperationPollingError("OpenRouter returned an unrecognized saved-job status.");
      }
      if (Date.now() >= deadline) {
        throw new ProviderOperationPollingError("The saved OpenRouter video is still rendering and will be checked again.");
      }
      await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs ?? 30_000));
    }
  }
  return downloadVideoToBuffer(contentUrl, { headers, redirect: "error", fetchImpl });
}

export function estimateOpenRouterSeedanceCost(resolution: "480p" | "720p", seconds: number) {
  const pixels = resolution === "480p" ? 480 * 854 : 720 * 1280;
  return pixels * 24 * seconds / 1024 * 0.0000107;
}

class OpenRouterApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function fetchJson(url: string, init: RequestInit, fetchImpl: typeof fetch, apiKey: string) {
  const response = await fetchImpl(url, { ...init, redirect: "error", signal: AbortSignal.timeout(60_000) });
  const body = asRecord(await response.json().catch(() => null));
  if (!response.ok) {
    const error = asRecord(body?.error);
    const message = typeof error?.message === "string" ? error.message : typeof body?.error === "string" ? body.error : `OpenRouter request failed (${response.status}).`;
    throw new OpenRouterApiError(redact(message, apiKey), response.status);
  }
  if (!body) throw new Error("OpenRouter returned an unreadable video response.");
  return body;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function redact(message: string, apiKey: string) { return message.replaceAll(apiKey, "[redacted]"); }
function isHttpsUrl(value: string) { try { return new URL(value).protocol === "https:"; } catch { return false; } }
