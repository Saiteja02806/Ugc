import RunwayML from "@runwayml/sdk";

import {
  ProviderOperationPollingError,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";
import type { AIStudioImageRatio } from "./image-output.js";
import { getRequiredProviderEnv } from "./provider-env.js";
import { assertRunwayDailyCreditBudget, RUNWAY_SEEDREAM_1K_IMAGE_CREDITS } from "./runway-credit-budget.js";

export const SEEDREAM_5_PRO_IMAGE_MODEL = "seedream5_pro";
const SEEDREAM_RATIOS = {
  "1:1": "1024:1024",
  "4:5": "896:1184",
  "9:16": "768:1376",
  "16:9": "1376:768",
} as const satisfies Record<AIStudioImageRatio, string>;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 8 * 60_000;

type SeedreamImageParams = {
  aspectRatio: AIStudioImageRatio;
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  providerOperationId?: string;
  onOperationCreated?: (operationId: string) => Promise<void>;
  onOperationSucceeded?: (operationId: string) => Promise<void>;
};

let runwayClient: RunwayML | undefined;

export function buildSeedreamImageRequest(params: SeedreamImageParams) {
  const promptText = params.prompt.trim();
  if (!promptText || promptText.length > 4_000) {
    throw new ProviderRequestNotSubmittedError("Seedream requires a prompt of 1–4000 characters.");
  }
  const referenceImageUrls = params.referenceImageUrls ?? (params.referenceImageUrl ? [params.referenceImageUrl] : []);
  if (referenceImageUrls.length > 2) throw new ProviderRequestNotSubmittedError("This slideshow request can use at most two image references.");
  for (const referenceImageUrl of referenceImageUrls) {
    let reference: URL;
    try {
      reference = new URL(referenceImageUrl);
    } catch {
      throw new ProviderRequestNotSubmittedError("Seedream reference image must use a valid HTTPS URL.");
    }
    if (reference.protocol !== "https:" || referenceImageUrl.length > 2_048) {
      throw new ProviderRequestNotSubmittedError("Seedream reference image must use an HTTPS URL of at most 2048 characters.");
    }
  }
  return {
    model: SEEDREAM_5_PRO_IMAGE_MODEL,
    promptText,
    ratio: SEEDREAM_RATIOS[params.aspectRatio],
    outputFormat: "png" as const,
    outputCount: 1,
    grounding: false,
    ...(referenceImageUrls.length ? { referenceImages: referenceImageUrls.map(uri => ({ uri })) } : {}),
  };
}

export async function generateSeedreamImageBuffer(
  params: SeedreamImageParams,
  clientOverride?: RunwayML,
) {
  const request = buildSeedreamImageRequest(params);
  const client = clientOverride ?? (runwayClient ??= new RunwayML({
    apiKey: getRequiredProviderEnv("RUNWAYML_API_SECRET"),
    maxRetries: 0,
  }));
  let operationId = params.providerOperationId;
  if (!operationId) {
    try {
      await assertRunwayDailyCreditBudget(client.organization, RUNWAY_SEEDREAM_1K_IMAGE_CREDITS);
    } catch (error) {
      // Usage checks happen before the paid POST, so failure cannot mean an accepted task.
      throw new ProviderRequestNotSubmittedError(
        error instanceof Error ? error.message : "Runway usage could not be checked.",
        { cause: error, retryable: true },
      );
    }
    // The installed SDK predates Seedream's model union. Its documented generic
    // POST uses the same authentication/version headers without upgrading video APIs.
    const task = await client.post<{ id: string }>("/v1/text_to_image", { body: request });
    if (!task.id) throw new Error("Seedream submission returned no task ID.");
    operationId = task.id;
    await params.onOperationCreated?.(operationId);
  }
  const outputUrl = await waitForSeedreamOutput(client, operationId);
  await params.onOperationSucceeded?.(operationId);
  return downloadSeedreamImage(outputUrl);
}

async function waitForSeedreamOutput(client: RunwayML, operationId: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= POLL_TIMEOUT_MS) {
    let task;
    try {
      task = await client.tasks.retrieve(operationId);
    } catch (error) {
      throw new ProviderOperationPollingError("Seedream task status could not be read.", { cause: error });
    }
    if (task.status === "SUCCEEDED") {
      if (!task.output[0]) throw new ProviderOperationTerminalError("Seedream completed without an image URL.");
      return task.output[0];
    }
    if (task.status === "FAILED" || task.status === "CANCELLED") {
      throw new ProviderOperationTerminalError(
        task.status === "FAILED" ? `Seedream task failed: ${task.failure}` : "Seedream task was cancelled.",
        task,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new ProviderOperationPollingError("Seedream image generation is still processing.");
}

async function downloadSeedreamImage(outputUrl: string) {
  if (new URL(outputUrl).protocol !== "https:") throw new Error("Seedream output must use HTTPS.");
  const response = await fetch(outputUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Seedream image download failed (${response.status}).`);
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("image/")) {
    throw new Error("Seedream output is not an image.");
  }
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    throw new Error("Seedream output exceeds the image size limit.");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("Seedream output has an invalid image size.");
  return buffer;
}
