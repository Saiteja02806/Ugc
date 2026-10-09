import RunwayML from "@runwayml/sdk";
import { downloadVideoToBuffer } from "./download-video.js";
import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";
import { assertRunwayDailyCreditBudget, estimateRunwayKlingCredits } from "./runway-credit-budget.js";
import { waitForRunwayOutput } from "./runway-video.js";

type KlingVideoInput = {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  referenceVideoUrl?: string;
  resolution: "480p" | "720p" | "1080p";
};

// Runway's live API exposes this model before SDK 4.20.1's generated union.
// Request fields were verified against both live endpoint validators.
type RunwayKlingRequest = {
  model: "kling3.0_standard";
  promptText: string;
  duration: number;
  ratio: "1280:720" | "720:1280";
  audio: true;
  promptImage?: { uri: string; position: "first" | "last" }[];
};

export function buildKlingVideoRequest(params: KlingVideoInput) {
  if (!Number.isInteger(params.durationSeconds) || params.durationSeconds < 3 || params.durationSeconds > 15) {
    throw new ProviderRequestNotSubmittedError("Kling 3.0 duration must be between 3 and 15 seconds.");
  }
  if (params.resolution !== "720p") {
    throw new ProviderRequestNotSubmittedError("Kling 3.0 Standard supports 720p video quality.");
  }
  if (params.referenceVideoUrl || params.referenceAudioUrls?.length) {
    throw new ProviderRequestNotSubmittedError("Kling 3.0 accepts text or image frames here; video and audio references are unavailable.");
  }
  const images = params.referenceImageUrls?.length ? params.referenceImageUrls : params.referenceImageUrl ? [params.referenceImageUrl] : [];
  if (images.length > 2 || images.some((url) => !isHttpsUrl(url))) {
    throw new ProviderRequestNotSubmittedError("Kling 3.0 accepts up to two HTTPS images: a first frame and an optional last frame.");
  }
  const promptText = params.prompt.trim();
  if (promptText.length < 2 || promptText.length > 2500) {
    throw new ProviderRequestNotSubmittedError("Kling 3.0 requires a prompt of 2 to 2,500 characters.");
  }
  const input: RunwayKlingRequest = {
    model: "kling3.0_standard", promptText, duration: params.durationSeconds,
    ratio: params.aspectRatio === "16:9" ? "1280:720" : "720:1280", audio: true,
    ...(images.length ? { promptImage: images.map((uri, index) => ({ uri, position: index === 0 ? "first" as const : "last" as const })) } : {}),
  };
  return { endpoint: images.length ? "/v1/image_to_video" : "/v1/text_to_video", input };
}

export async function generateKlingVideoBuffer(params: KlingVideoInput & {
  onOperationCreated: (operationId: string) => Promise<void>;
  onOperationSucceeded: (operationId: string, outputUrl?: string) => Promise<void>;
  providerOperationId?: string;
  providerOutputUrl?: string;
}, clientOverride?: RunwayML) {
  if (params.providerOperationId && params.providerOutputUrl && isHttpsUrl(params.providerOutputUrl)) {
    return downloadVideoToBuffer(params.providerOutputUrl);
  }
  const client = clientOverride ?? new RunwayML({ apiKey: getRequiredProviderEnv("RUNWAYML_API_SECRET"), maxRetries: 0 });
  let operationId = params.providerOperationId;
  if (!operationId) {
    const request = buildKlingVideoRequest(params);
    try {
      await assertRunwayDailyCreditBudget(client.organization, estimateRunwayKlingCredits(params.durationSeconds));
    } catch (cause) {
      throw new ProviderRequestNotSubmittedError(cause instanceof Error ? cause.message : "Could not check the Runway credit budget.", { cause });
    }
    // Use the SDK's public transport, retaining authentication, error handling,
    // and maxRetries=0 while its generated model unions catch up.
    const task = await client.post<{ id: string }>(request.endpoint, { body: request.input });
    if (!task.id) throw new Error("Runway returned no Kling task ID; acceptance could not be confirmed.");
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
