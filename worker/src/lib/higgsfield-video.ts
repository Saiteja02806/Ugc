import { createHiggsfieldClient } from "@higgsfield/client/v2";

import { downloadVideoToBuffer } from "./download-video.js";
import {
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";

const TEXT_MODEL = "bytedance/seedance-2.5/text-to-video";
const IMAGE_MODEL = "bytedance/seedance-2.5/image-to-video";
const REFERENCE_MODEL = "bytedance/seedance-2.5/reference-to-video";
const EDIT_MODEL = "bytedance/seedance-2.5/video-edit";
const STATUS_POLL_INTERVAL_MS = 5_000;
const STATUS_POLL_WINDOW_MS = 24 * 60_000;

export async function generateHiggsfieldVideoBuffer(params: {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  onOperationCreated: (operationId: string) => Promise<void>;
  onOperationSucceeded: (operationId: string, outputUrl?: string) => Promise<void>;
  prompt: string;
  providerOperationId?: string;
  providerOutputUrl?: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  referenceVideoUrl?: string;
}) {
  if (params.providerOperationId && params.providerOutputUrl && /^https:\/\//i.test(params.providerOutputUrl)) {
    return downloadVideoToBuffer(params.providerOutputUrl);
  }
  if (
    !Number.isInteger(params.durationSeconds) ||
    params.durationSeconds < 4 ||
    params.durationSeconds > 30
  ) {
    throw new ProviderRequestNotSubmittedError(
      "Seedance 2.5 duration must be between 4 and 30 seconds.",
    );
  }
  if (
    (params.referenceImageUrl && !/^https:\/\//i.test(params.referenceImageUrl)) ||
    (params.referenceVideoUrl && !/^https:\/\//i.test(params.referenceVideoUrl)) ||
    params.referenceImageUrls?.some((url) => !/^https:\/\//i.test(url))
  ) {
    throw new ProviderRequestNotSubmittedError("Seedance references require HTTPS URLs.");
  }

  const credentials = getRequiredProviderEnv("HF_CREDENTIALS");
  if (!/^[^:\s]+:[^:\s]+$/.test(credentials)) {
    throw new ProviderRequestNotSubmittedError(
      "HF_CREDENTIALS must use key-id:key-secret format.",
    );
  }

  const client = createHiggsfieldClient({ credentials, maxRetries: 0 });
  const imageUrls = params.referenceImageUrls?.length
    ? params.referenceImageUrls
    : params.referenceImageUrl ? [params.referenceImageUrl] : [];
  if (imageUrls.length > (params.referenceVideoUrl ? 29 : 30)) {
    throw new ProviderRequestNotSubmittedError("Too many Seedance references.");
  }
  const model = params.referenceVideoUrl
    ? EDIT_MODEL
    : imageUrls.length > 1 ? REFERENCE_MODEL
    : imageUrls.length === 1 ? IMAGE_MODEL : TEXT_MODEL;
  const input = params.referenceVideoUrl
    ? {
        prompt: params.prompt,
        video_url: params.referenceVideoUrl,
        ...(imageUrls.length ? { image_urls: imageUrls } : {}),
        resolution: "720p",
        output_format: "mp4",
        generate_audio: true,
      }
    : imageUrls.length > 1
      ? {
          prompt: params.prompt,
          image_urls: imageUrls,
          duration: params.durationSeconds,
          resolution: "720p",
          aspect_ratio: params.aspectRatio,
          output_format: "mp4",
          generate_audio: true,
        }
    : imageUrls.length === 1
      ? {
          prompt: params.prompt,
          image_url: imageUrls[0],
          duration: params.durationSeconds,
          resolution: "720p",
          output_format: "mp4",
          generate_audio: true,
        }
      : {
          prompt: params.prompt,
          duration: params.durationSeconds,
          resolution: "720p",
          aspect_ratio: params.aspectRatio,
          output_format: "mp4",
        };
  const submitted = params.providerOperationId
    ? null
    : await client.subscribe(model, { input, withPolling: false });
  const requestId = params.providerOperationId ?? submitted?.request_id;
  if (!requestId) {
    throw new ProviderOperationTerminalError("Seedance did not return a request ID.");
  }
  if (!params.providerOperationId) await params.onOperationCreated(requestId);
  const result = submitted?.status === "completed" || submitted?.status === "failed" || submitted?.status === "nsfw"
    ? submitted
    : await waitForHiggsfieldResult(requestId, credentials);
  if (result.status !== "completed") {
    const status = result.status === "nsfw" ? "moderated" : result.status;
    const providerError = "error" in result && typeof result.error === "string"
      ? `: ${result.error.slice(0, 300)}` : "";
    throw new ProviderOperationTerminalError(
      `Seedance 2.5 request ${requestId} ended with status ${status}${providerError}.`,
    );
  }
  const videoUrl = result.video?.url;
  if (!videoUrl || !/^https:\/\//i.test(videoUrl)) {
    throw new ProviderOperationTerminalError(
      "Seedance 2.5 completed without a usable video URL.",
    );
  }

  await params.onOperationSucceeded(requestId, videoUrl);
  return downloadVideoToBuffer(videoUrl);
}

async function waitForHiggsfieldResult(requestId: string, credentials: string) {
  const deadline = Date.now() + STATUS_POLL_WINDOW_MS;

  while (Date.now() < deadline) {
    const response = await fetch(
      `https://api.higgsfield.ai/requests/${encodeURIComponent(requestId)}/status`,
      { headers: { Authorization: `Key ${credentials}` } },
    );
    if (response.ok) {
      const result = await response.json() as {
        error?: string;
        status: string;
        video?: { url?: string };
      };
      if (["completed", "failed", "nsfw", "canceled", "cancelled"].includes(result.status)) {
        return result;
      }
    } else if (response.status >= 400 && response.status < 500 && response.status !== 404 && response.status !== 429) {
      throw new ProviderOperationTerminalError(
        `Seedance status check for request ${requestId} returned HTTP ${response.status}.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
  }

  throw new Error(`Seedance request ${requestId} is still processing; resume polling without resubmitting.`);
}
