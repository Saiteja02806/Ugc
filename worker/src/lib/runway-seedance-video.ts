import RunwayML from "@runwayml/sdk";
import type { ImageToVideoCreateParams } from "@runwayml/sdk/resources/image-to-video";
import type { TextToVideoCreateParams } from "@runwayml/sdk/resources/text-to-video";
import type { VideoToVideoCreateParams } from "@runwayml/sdk/resources/video-to-video";

import { downloadVideoToBuffer } from "./download-video.js";
import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";
import { assertRunwayDailyCreditBudget, estimateRunwaySeedanceCredits } from "./runway-credit-budget.js";
import { waitForRunwayOutput } from "./runway-video.js";

type SeedanceVideoInput = {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  referenceVideoUrl?: string;
  referenceVideoDurationSeconds?: number;
  resolution: "480p" | "720p" | "1080p";
};

type SeedanceRequest =
  | { kind: "text"; input: TextToVideoCreateParams.Seedance2_5 }
  | { kind: "image"; input: ImageToVideoCreateParams.Seedance2_5 }
  | { kind: "video"; input: VideoToVideoCreateParams.Seedance2_5 };

export function buildRunwaySeedanceRequest(params: SeedanceVideoInput): SeedanceRequest {
  if (!Number.isInteger(params.durationSeconds) || params.durationSeconds < 4 || params.durationSeconds > 30) {
    throw new ProviderRequestNotSubmittedError("Seedance 2.5 duration must be between 4 and 30 seconds.");
  }
  if (params.resolution !== "480p" && params.resolution !== "720p") {
    throw new ProviderRequestNotSubmittedError("Seedance 2.5 supports 480p or 720p video quality.");
  }
  const promptText = params.prompt.trim();
  if (!promptText || promptText.length > 15_000) {
    throw new ProviderRequestNotSubmittedError("Seedance requires a prompt of 1 to 15,000 characters.");
  }
  const imageUrls = params.referenceImageUrls?.length
    ? params.referenceImageUrls : params.referenceImageUrl ? [params.referenceImageUrl] : [];
  const audioUrls = params.referenceAudioUrls ?? [];
  const urls = [...imageUrls, ...audioUrls, ...(params.referenceVideoUrl ? [params.referenceVideoUrl] : [])];
  if (urls.some((url) => !isHttpsUrl(url))) {
    throw new ProviderRequestNotSubmittedError("Seedance references require HTTPS URLs.");
  }
  if (urls.length > 30 || audioUrls.length > 10) {
    throw new ProviderRequestNotSubmittedError("Seedance accepts 30 reference files, including at most 10 audio files.");
  }
  if (params.referenceVideoUrl && (
    !Number.isFinite(params.referenceVideoDurationSeconds) ||
    !params.referenceVideoDurationSeconds || params.referenceVideoDurationSeconds <= 0 ||
    params.referenceVideoDurationSeconds > 30
  )) {
    throw new ProviderRequestNotSubmittedError("Seedance reference videos require a duration of 30 seconds or shorter.");
  }
  const ratio: NonNullable<TextToVideoCreateParams.Seedance2_5["ratio"]> = params.resolution === "480p"
    ? params.aspectRatio === "16:9" ? "854:480" : "480:854"
    : params.aspectRatio === "16:9" ? "1280:720" : "720:1280";
  const common = {
    model: "seedance2_5" as const,
    promptText,
    duration: params.durationSeconds,
    ratio,
    audio: true,
    ...(audioUrls.length ? { referenceAudio: audioUrls.map((uri) => ({ type: "audio" as const, uri })) } : {}),
  };
  if (params.referenceVideoUrl) {
    // Reference mode honors the screen's chosen duration, ratio and quality.
    // Runway's in-place edit mode requires auto duration and forbids ratio.
    return { kind: "video", input: {
      ...common, mode: "reference", promptVideo: params.referenceVideoUrl,
      ...(imageUrls.length ? { references: imageUrls.map((uri) => ({ uri })) } : {}),
    } };
  }
  if (imageUrls.length === 1 && !audioUrls.length) {
    return { kind: "image", input: { ...common, promptImage: [{ uri: imageUrls[0], position: "first" }] } };
  }
  return { kind: "text", input: {
    ...common, ...(imageUrls.length ? { references: imageUrls.map((uri) => ({ uri })) } : {}),
  } };
}

export async function generateRunwaySeedanceVideoBuffer(params: SeedanceVideoInput & {
  onOperationCreated: (operationId: string) => Promise<void>;
  onOperationSucceeded: (operationId: string, outputUrl?: string) => Promise<void>;
  providerOperationId?: string;
  providerOutputUrl?: string;
}, clientOverride?: RunwayML) {
  if (params.providerOperationId && params.providerOutputUrl && isHttpsUrl(params.providerOutputUrl)) {
    return downloadVideoToBuffer(params.providerOutputUrl);
  }
  const client = clientOverride ?? new RunwayML({
    apiKey: getRequiredProviderEnv("RUNWAYML_API_SECRET"), maxRetries: 0,
  });
  let operationId = params.providerOperationId;
  if (!operationId) {
    const request = buildRunwaySeedanceRequest(params);
    const estimatedCredits = estimateRunwaySeedanceCredits(
      params.resolution as "480p" | "720p", params.durationSeconds,
      params.referenceVideoUrl ? params.referenceVideoDurationSeconds : 0,
    );
    try {
      await assertRunwayDailyCreditBudget(client.organization, estimatedCredits);
    } catch (cause) {
      // Budget/usage reads occur before submission; do not mark acceptance uncertain.
      throw new ProviderRequestNotSubmittedError(
        cause instanceof Error ? cause.message : "Could not check the Runway credit budget.", { cause },
      );
    }
    const task = request.kind === "video" ? await client.videoToVideo.create(request.input)
      : request.kind === "image" ? await client.imageToVideo.create(request.input)
      : await client.textToVideo.create(request.input);
    operationId = task.id;
    await params.onOperationCreated(operationId);
  }
  const outputUrl = await waitForRunwayOutput(client, operationId, 24 * 60_000);
  await params.onOperationSucceeded(operationId, outputUrl);
  return downloadVideoToBuffer(outputUrl);
}

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
