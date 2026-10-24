import RunwayML from "@runwayml/sdk";
import type { TextToVideoCreateParams } from "@runwayml/sdk/resources/text-to-video";
import { downloadVideoToBuffer } from "./download-video.js";
import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";
import { assertRunwayDailyCreditBudget, estimateRunwayWanCredits } from "./runway-credit-budget.js";
import { waitForRunwayOutput } from "./runway-video.js";

type WanVideoInput = {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  /** Durations verified from the owned media records before queuing. */
  referenceAudioDurationSeconds?: number[];
  referenceVideoUrl?: string;
  referenceVideoDurationSeconds?: number;
  resolution: "480p" | "720p" | "1080p";
};

export function buildRunwayWanRequest(input: WanVideoInput): TextToVideoCreateParams.Wan3 {
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 2 || input.durationSeconds > 30) {
    throw new ProviderRequestNotSubmittedError("WAN 3.0 duration must be between 2 and 30 seconds.");
  }
  if (!["480p", "720p", "1080p"].includes(input.resolution)) {
    throw new ProviderRequestNotSubmittedError("WAN 3.0 supports 480p, 720p or 1080p video quality.");
  }
  if (input.aspectRatio !== "9:16" && input.aspectRatio !== "16:9") {
    throw new ProviderRequestNotSubmittedError("Choose portrait 9:16 or landscape 16:9 for WAN 3.0.");
  }
  const promptText = input.prompt.trim();
  if (!promptText || promptText.length > 10_000) {
    throw new ProviderRequestNotSubmittedError("Add a WAN 3.0 prompt of 1–10000 characters.");
  }
  const images = input.referenceImageUrls?.length ? input.referenceImageUrls : input.referenceImageUrl ? [input.referenceImageUrl] : [];
  const audio = input.referenceAudioUrls ?? [];
  const urls = [...images, ...audio, ...(input.referenceVideoUrl ? [input.referenceVideoUrl] : [])];
  if (urls.length > 6 || audio.length > 1 || new Set(urls).size !== urls.length || urls.some(url => !isHttpsUrl(url))) {
    throw new ProviderRequestNotSubmittedError("Use up to six distinct uploaded references, including one audio and one video reference.");
  }
  const audioDurations = input.referenceAudioDurationSeconds ?? [];
  if (audioDurations.length !== audio.length || audioDurations.some(seconds => !isReferenceDuration(seconds))) {
    throw new ProviderRequestNotSubmittedError("WAN 3.0 audio references must have a verified duration of 15 seconds or shorter.");
  }
  if (input.referenceVideoUrl && !isReferenceDuration(input.referenceVideoDurationSeconds)) {
    throw new ProviderRequestNotSubmittedError("WAN 3.0 video references must have a verified duration of 15 seconds or shorter.");
  }
  const ratio: NonNullable<TextToVideoCreateParams.Wan3["ratio"]> = input.resolution === "480p"
    ? input.aspectRatio === "16:9" ? "832:480" : "480:832"
    : input.resolution === "1080p"
      ? input.aspectRatio === "16:9" ? "1920:1080" : "1080:1920"
      : input.aspectRatio === "16:9" ? "1280:720" : "720:1280";
  // Use reference mode rather than keyframes so images, video and audio are
  // all honored together, while keeping the requested output settings.
  return {
    model: "wan3", promptText, duration: input.durationSeconds, ratio, audio: true,
    ...(images.length ? { references: images.map(uri => ({ uri })) } : {}),
    ...(audio.length ? { referenceAudio: audio.map(uri => ({ type: "audio" as const, uri })) } : {}),
    ...(input.referenceVideoUrl ? { referenceVideos: [{ type: "video" as const, uri: input.referenceVideoUrl }] } : {}),
  };
}

export async function generateRunwayWanVideoBuffer(input: WanVideoInput & {
  onOperationCreated: (id: string) => Promise<void>;
  onOperationSucceeded: (id: string, outputUrl?: string) => Promise<void>;
  providerOperationId?: string;
  providerOutputUrl?: string;
}, clientOverride?: RunwayML) {
  if (input.providerOperationId && input.providerOutputUrl && isHttpsUrl(input.providerOutputUrl)) {
    return downloadVideoToBuffer(input.providerOutputUrl);
  }
  const request = input.providerOperationId ? undefined : buildRunwayWanRequest(input);
  const client = clientOverride ?? new RunwayML({ apiKey: getRequiredProviderEnv("RUNWAYML_API_SECRET"), maxRetries: 0 });
  let operationId = input.providerOperationId;
  if (!operationId) {
    try {
      await assertRunwayDailyCreditBudget(client.organization, estimateRunwayWanCredits(input.resolution, input.durationSeconds));
    } catch (cause) {
      throw new ProviderRequestNotSubmittedError("Video generation is temporarily unavailable. No video was started. Try again later.", { cause });
    }
    const task = await client.textToVideo.create(request!);
    operationId = task.id;
    await input.onOperationCreated(operationId);
  }
  const outputUrl = await waitForRunwayOutput(client, operationId, 24 * 60_000);
  await input.onOperationSucceeded(operationId, outputUrl);
  return downloadVideoToBuffer(outputUrl);
}

function isReferenceDuration(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 15;
}
function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
