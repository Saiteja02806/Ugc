import { downloadVideoToBuffer } from "./download-video.js";
import { ProviderOperationPollingError, ProviderOperationTerminalError, ProviderOutputCollectionError, ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";

const API_ROOT = "https://reapi.ai/api/v1";
// The public task examples use cdn.reapi.ai. A verified production WAN task
// also delivers directly from file.deepytb.com; do not admit arbitrary hosts.
const OUTPUT_HOSTS = new Set(["cdn.reapi.ai", "file.deepytb.com"]);
export const REAPI_SEEDANCE_MODEL = "doubao-seedance-2.5-face";
export const REAPI_WAN_MODEL = "wan3.0-video";

type ReapiVideoInput = {
  model: "seedance_2_5" | "wan_3_0";
  prompt: string;
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  resolution: "480p" | "720p" | "1080p";
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  referenceAudioDurationSeconds?: number[];
  referenceVideoUrl?: string;
  referenceVideoDurationSeconds?: number;
};
type ReapiOperation = {
  providerOperationId?: string;
  providerOutputUrl?: string;
  onOperationCreated: (id: string) => Promise<void>;
  onOperationSucceeded: (id: string, url?: string, usage?: { costUsd?: number; generationId?: string }) => Promise<void>;
};
type ReapiOptions = { apiKey?: string; fetchImpl?: typeof fetch; pollIntervalMs?: number; timeoutMs?: number };

/** New requests only. Legacy provider adapters and fingerprints stay frozen. */
export function buildReapiVideoRequest(input: ReapiVideoInput) {
  const seedance = input.model === "seedance_2_5";
  if (!seedance && input.model !== "wan_3_0") throw new ProviderRequestNotSubmittedError("Choose Seedance 2.5 or WAN 3.0 for this generation route.");
  const minDuration = seedance ? 4 : 2;
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < minDuration || input.durationSeconds > 30) {
    throw new ProviderRequestNotSubmittedError(`Choose a whole-number output duration from ${minDuration} to 30 seconds.`);
  }
  if (!(seedance ? ["480p", "720p"] : ["480p", "720p", "1080p"]).includes(input.resolution) ||
      !["9:16", "16:9"].includes(input.aspectRatio)) {
    throw new ProviderRequestNotSubmittedError("Choose a supported video quality and aspect ratio.");
  }
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 10_000) throw new ProviderRequestNotSubmittedError("Add a video prompt of 1–10000 characters.");
  const images = input.referenceImageUrls?.length ? input.referenceImageUrls : input.referenceImageUrl ? [input.referenceImageUrl] : [];
  const audio = input.referenceAudioUrls ?? [];
  const media = [...images, ...audio, ...(input.referenceVideoUrl ? [input.referenceVideoUrl] : [])];
  if (media.length > 6 || audio.length > 1 || new Set(media).size !== media.length || media.some(url => !isHttpsUrl(url))) {
    throw new ProviderRequestNotSubmittedError("Use up to six distinct HTTPS references, including one audio and one video reference.");
  }
  const minReferenceDuration = seedance ? 2 : 1;
  const maxReferenceDuration = seedance ? 30 : 15;
  const audioDurations = input.referenceAudioDurationSeconds ?? [];
  if (audioDurations.length !== audio.length || audioDurations.some(seconds => !Number.isFinite(seconds) || seconds < minReferenceDuration || seconds > maxReferenceDuration) ||
      (input.referenceVideoUrl && (!Number.isFinite(input.referenceVideoDurationSeconds) || input.referenceVideoDurationSeconds! < minReferenceDuration || input.referenceVideoDurationSeconds! > maxReferenceDuration))) {
    throw new ProviderRequestNotSubmittedError(`Use saved audio and video references from ${minReferenceDuration} to ${maxReferenceDuration} seconds.`);
  }
  if (!seedance && input.referenceVideoUrl && input.referenceVideoDurationSeconds! + input.durationSeconds > 30) {
    throw new ProviderRequestNotSubmittedError("For WAN 3.0, reference video plus output must fit within 30 seconds. Choose a shorter reference or output duration.");
  }
  return {
    model: seedance ? REAPI_SEEDANCE_MODEL : REAPI_WAN_MODEL,
    prompt, duration: input.durationSeconds, size: input.aspectRatio,
    resolution: seedance ? input.resolution : input.resolution.toUpperCase(),
    // The user explicitly selected ReAPI's Less Restriction Seedance route.
    // WAN uses its moderated route; never retry on a different review channel.
    content_filter: !seedance,
    ...(seedance ? { generate_audio: true, output_format: "mp4", ...(media.length ? { omni_reference_task_type: "reference" } : {}) }
      : { audio: true, ...(media.length ? { generation_type: "reference" } : {}) }),
    ...(images.length ? { image_urls: images } : {}),
    ...(audio.length ? { audio_urls: audio } : {}),
    ...(input.referenceVideoUrl ? { video_urls: [input.referenceVideoUrl] } : {}),
  };
}

export async function generateReapiVideoBuffer(input: ReapiVideoInput & ReapiOperation, options: ReapiOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  // Validate before credentials or any provider access. Recovery never rebuilds
  // an accepted request from current settings or expired reference URLs.
  const request = input.providerOperationId ? undefined : buildReapiVideoRequest(input);
  const apiKey = getRequiredProviderEnv("REAPI_API_KEY", { REAPI_API_KEY: options.apiKey ?? process.env.REAPI_API_KEY });
  let id = input.providerOperationId;
  if (!id) {
    // Exactly one paid POST. Network/5xx/malformed acceptance stays uncertain.
    const submitted = await fetchJson(`${API_ROOT}/videos/generations`, apiKey, fetchImpl, {
      method: "POST", body: JSON.stringify(request), headers: { "Content-Type": "application/json" },
    });
    const acceptedId = submitted.id ?? submitted.task_id;
    if (typeof acceptedId !== "string" || !acceptedId.trim() || acceptedId.length > 4096 ||
        (submitted.id && submitted.task_id && submitted.id !== submitted.task_id)) {
      throw new Error("ReAPI returned no unambiguous recoverable video task ID.");
    }
    id = acceptedId;
    await input.onOperationCreated(id);
  }
  const deadline = Date.now() + (options.timeoutMs ?? 24 * 60_000);
  while (true) {
    // Always re-read the task for recovery, including to refresh expiring CDN
    // links. Never turn a saved provider task into a fresh generation.
    const task = await fetchJson(`${API_ROOT}/tasks/${encodeURIComponent(id)}`, apiKey, fetchImpl);
    if (task.id !== undefined && task.id !== id) throw new ProviderOperationPollingError("ReAPI returned a different saved task.");
    if (task.status === "failed" || task.status === "cancelled" || task.status === "expired") {
      const error = asRecord(task.error);
      const moderated = Number(error?.code) === 80006;
      throw new ProviderOperationTerminalError("The saved ReAPI video generation failed.", { failureCode: moderated ? "SAFETY.REAPI" : "REAPI.GENERATION_FAILED" });
    }
    if (task.status === "completed") {
      const urls = asRecord(task.output)?.video_urls;
      const url = Array.isArray(urls) ? urls[0] : undefined;
      const acceptedUrl = typeof url === "string" && isReapiOutputUrl(url) ? url : undefined;
      const credits = asRecord(task.usage)?.credits;
      // Persist completion/usage even if collection fails. Never persist an
      // untrusted link; retries re-read this same task for a refreshed output.
      await input.onOperationSucceeded(id, acceptedUrl, {
        generationId: id,
        ...(typeof credits === "number" && Number.isSafeInteger(credits) && credits >= 0 ? { costUsd: credits / 1000 } : {}),
      });
      if (typeof url !== "string" || !url) throw new ProviderOutputCollectionError("missing_output");
      if (!acceptedUrl) throw new ProviderOutputCollectionError("untrusted_output_url");
      // CDN downloads are public bearer URLs, never authenticated with our key.
      try {
        return await downloadVideoToBuffer(acceptedUrl, { fetchImpl, redirect: "error" });
      } catch {
        // Raw download errors can contain signed links. Keep a safe, distinct
        // collection diagnostic instead of misreporting rendering as pending.
        throw new ProviderOutputCollectionError("download_failed");
      }
    }
    if (task.status !== "processing" && task.status !== "pending" && task.status !== "queued") {
      throw new ProviderOperationPollingError("ReAPI returned an unrecognized saved-task status.");
    }
    if (Date.now() >= deadline) throw new ProviderOperationPollingError("The saved ReAPI task is still rendering and will be checked again.");
    await new Promise(resolve => setTimeout(resolve, options.pollIntervalMs ?? 10_000));
  }
}

class ReapiApiError extends Error {
  constructor(readonly status: number, readonly code: string) { super(`ReAPI request failed (${status}).`); }
}
async function fetchJson(url: string, apiKey: string, fetchImpl: typeof fetch, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${apiKey}` }, redirect: "error", signal: AbortSignal.timeout(60_000) });
  } catch {
    // Do not persist raw provider errors that may include signed URLs or keys.
    throw new Error("ReAPI could not confirm this request.");
  }
  const body = asRecord(await response.json().catch(() => null));
  if (!response.ok) {
    if (Number(asRecord(body?.error)?.code) === 80006) throw new ProviderOperationTerminalError("ReAPI rejected the generation through content moderation.", { failureCode: "SAFETY.REAPI" });
    throw new ReapiApiError(response.status, response.status === 402 ? "insufficient_credits" : `reapi_http_${response.status}`);
  }
  if (!body) throw new Error("ReAPI returned an unreadable response.");
  return body;
}
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function isHttpsUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
function isReapiOutputUrl(value: string) {
  try {
    const url = new URL(value);
    return isHttpsUrl(value) && !url.port && OUTPUT_HOSTS.has(url.hostname);
  } catch { return false; }
}
