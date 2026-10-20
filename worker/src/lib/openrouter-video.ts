import { downloadVideoToBuffer } from "./download-video.js";
import {
  ProviderOperationPollingError,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";

const API_ROOT = "https://openrouter.ai/api/v1";
export type OpenRouterVideoOperation = {
  onOperationCreated: (id: string) => Promise<void>;
  onOperationSucceeded: (id: string, outputUrl?: string, usage?: { costUsd?: number; generationId?: string }) => Promise<void>;
  providerOperationId?: string;
  providerOutputUrl?: string;
};
export type OpenRouterVideoClientOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

export async function generateOpenRouterVideoBuffer(
  input: OpenRouterVideoOperation,
  adapter: { buildRequest: () => Record<string, unknown>; estimatedCostUsd: () => number },
  options: OpenRouterVideoClientOptions = {},
) {
  const apiKey = getRequiredProviderEnv("OPENROUTER_API_KEY", {
    OPENROUTER_API_KEY: options.apiKey ?? process.env.OPENROUTER_API_KEY,
  });
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${apiKey}` };
  let id = input.providerOperationId;

  if (!id) {
    const request = adapter.buildRequest();
    // Reads happen before a paid submission. Their failures are safe to retry.
    try {
      const key = asRecord((await fetchJson(`${API_ROOT}/key`, { headers }, fetchImpl, apiKey)).data);
      if (!key || key.is_management_key === true) {
        throw new ProviderRequestNotSubmittedError("Configure a regular OpenRouter inference API key.");
      }
      // Each model supplies its own conservative estimate before a paid POST.
      const estimatedCost = adapter.estimatedCostUsd();
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
