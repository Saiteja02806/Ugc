import { createHiggsfieldClient } from "@higgsfield/client/v2";

import { downloadVideoToBuffer } from "./download-video.js";
import {
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";

const MODEL = "bytedance/seedance-2.5/text-to-video";

export async function generateHiggsfieldVideoBuffer(params: {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  onOperationCreated: (operationId: string) => Promise<void>;
  onOperationSucceeded: (operationId: string, outputUrl?: string) => Promise<void>;
  prompt: string;
  providerOperationId?: string;
  providerOutputUrl?: string;
  referenceImageUrl?: string;
  referenceVideoUrl?: string;
}) {
  if (params.providerOperationId) {
    if (params.providerOutputUrl && /^https:\/\//i.test(params.providerOutputUrl)) {
      return downloadVideoToBuffer(params.providerOutputUrl);
    }
    throw new ProviderOperationTerminalError(
      "The existing Seedance request has no recoverable video URL.",
    );
  }
  if (params.referenceImageUrl || params.referenceVideoUrl) {
    throw new ProviderRequestNotSubmittedError(
      "Seedance 2.5 only supports text prompts in this video generator.",
    );
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

  const credentials = getRequiredProviderEnv("HF_CREDENTIALS");
  if (!/^[^:\s]+:[^:\s]+$/.test(credentials)) {
    throw new ProviderRequestNotSubmittedError(
      "HF_CREDENTIALS must use key-id:key-secret format.",
    );
  }

  const client = createHiggsfieldClient({
    credentials,
    maxPollTime: 15 * 60_000,
    maxRetries: 0,
  });
  const result = await client.subscribe(MODEL, {
    input: {
      prompt: params.prompt,
      duration: params.durationSeconds,
      resolution: "720p",
      aspect_ratio: params.aspectRatio,
      output_format: "mp4",
    },
    withPolling: true,
  });

  if (result.request_id) {
    await params.onOperationCreated(result.request_id);
  }
  if (result.status !== "completed") {
    const status = result.status === "nsfw" ? "moderated" : result.status;
    throw new ProviderOperationTerminalError(
      `Seedance 2.5 generation ended with status ${status}.`,
    );
  }
  const videoUrl = result.video?.url;
  if (!videoUrl || !/^https:\/\//i.test(videoUrl) || !result.request_id) {
    throw new ProviderOperationTerminalError(
      "Seedance 2.5 completed without a usable video URL.",
    );
  }

  await params.onOperationSucceeded(result.request_id, videoUrl);
  return downloadVideoToBuffer(videoUrl);
}
