import {
  GenerateVideosOperation,
  GoogleGenAI,
  type GenerateVideosConfig,
  type GeneratedVideo,
  type Image,
} from "@google/genai";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ProviderOperationPollingError,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";

type GenerateVeoHookVideoParams = {
  aspectRatio?: VeoAspectRatio;
  onOperationCreated?: (operationId: string) => Promise<void>;
  onOperationSucceeded?: (operationId: string) => Promise<void>;
  prompt: string;
  providerOperationId?: string;
  referenceImageUrl?: string;
};

export type VeoAspectRatio = "9:16" | "16:9";

export const VEO_MODEL = "veo-3.1-lite-generate-preview";
export const VEO_DURATION_SECONDS = 4;
const VEO_POLL_INTERVAL_MS = 10_000;
const VEO_TIMEOUT_MS = 8 * 60_000;

let googleClient: GoogleGenAI | null = null;

export async function generateVeoHookVideoBuffer({
  aspectRatio = "9:16",
  onOperationCreated,
  onOperationSucceeded,
  prompt,
  providerOperationId,
  referenceImageUrl,
}: GenerateVeoHookVideoParams) {
  const ai = getGoogleClient();
  const startedAt = Date.now();
  let operation: GenerateVideosOperation;

  if (providerOperationId) {
    const savedOperation = new GenerateVideosOperation();
    savedOperation.name = providerOperationId;

    try {
      operation = await ai.operations.getVideosOperation({
        operation: savedOperation,
      });
    } catch (error) {
      throw new ProviderOperationPollingError(
        "Veo operation status could not be read.",
        { cause: error },
      );
    }
  } else {
    const referenceImage = referenceImageUrl
      ? await downloadReferenceImage(referenceImageUrl)
      : undefined;
    operation = await ai.models.generateVideos({
      model: VEO_MODEL,
      prompt,
      ...(referenceImage ? { image: referenceImage } : {}),
      config: buildVeoGenerationConfig(aspectRatio),
    });

    if (!operation.name) {
      throw new Error("Veo accepted generation without an operation ID.");
    }

    await onOperationCreated?.(operation.name);
  }

  while (!operation.done) {
    if (Date.now() - startedAt > VEO_TIMEOUT_MS) {
      throw new ProviderOperationPollingError(
        "Veo video generation is still processing.",
      );
    }

    await sleep(VEO_POLL_INTERVAL_MS);

    try {
      operation = await ai.operations.getVideosOperation({ operation });
    } catch (error) {
      throw new ProviderOperationPollingError(
        "Veo operation status could not be read.",
        { cause: error },
      );
    }
  }

  if (operation.error) {
    throw new ProviderOperationTerminalError(
      `Veo video generation failed: ${JSON.stringify(operation.error)}`,
      operation.error,
    );
  }

  const generatedVideo = operation.response?.generatedVideos?.[0];

  if (!generatedVideo?.video) {
    throw new ProviderOperationTerminalError(
      "Veo video generation completed without a video.",
    );
  }

  if (!operation.name) {
    throw new ProviderOperationPollingError(
      "Veo completed without the saved operation ID.",
    );
  }

  await onOperationSucceeded?.(operation.name);

  try {
    return await downloadGeneratedVideo(ai, generatedVideo);
  } catch (error) {
    throw new ProviderOperationPollingError(
      "Veo output could not be downloaded from the saved operation.",
      { cause: error },
    );
  }
}

export function buildVeoGenerationConfig(
  aspectRatio: VeoAspectRatio = "9:16",
): GenerateVideosConfig {
  return {
    aspectRatio,
    durationSeconds: VEO_DURATION_SECONDS,
    numberOfVideos: 1,
    personGeneration: "allow_adult",
    resolution: "720p",
  };
}

function getGoogleClient() {
  if (!googleClient) {
    googleClient = new GoogleGenAI({
      apiKey: getRequiredEnv("GEMINI_API_KEY"),
      // A generation submission is fenced in Supabase. Retrying this POST
      // inside the SDK could create another paid operation before its ID is saved.
      httpOptions: { retryOptions: { attempts: 1 } },
    });
  }

  return googleClient;
}

async function downloadReferenceImage(url: string): Promise<Image> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new ProviderRequestNotSubmittedError(
      "The Veo reference image could not be downloaded.",
      { cause: error, retryable: true },
    );
  }

  if (!response.ok) {
    throw new ProviderRequestNotSubmittedError(
      `Failed to download Veo reference image: ${response.status}`,
      { retryable: response.status === 429 || response.status >= 500 },
    );
  }

  const contentType = response.headers.get("content-type") ?? "image/png";

  if (!contentType.toLowerCase().includes("image")) {
    throw new ProviderRequestNotSubmittedError(
      `Expected image response, got ${contentType}.`,
    );
  }

  return {
    imageBytes: Buffer.from(await response.arrayBuffer()).toString("base64"),
    mimeType: contentType,
  };
}

async function downloadGeneratedVideo(
  ai: GoogleGenAI,
  generatedVideo: GeneratedVideo,
) {
  if (generatedVideo.video?.videoBytes) {
    return Buffer.from(generatedVideo.video.videoBytes, "base64");
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "ugc-veo-"));
  const downloadPath = path.join(tempDir, `${randomUUID()}.mp4`);

  try {
    await ai.files.download({
      downloadPath,
      file: generatedVideo,
    });

    return await readFile(downloadPath);
  } finally {
    await rm(tempDir, {
      force: true,
      recursive: true,
    });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ProviderRequestNotSubmittedError(`Missing ${name}`);
  }

  return value;
}
