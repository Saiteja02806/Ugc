import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ProviderOperationPollingError,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";

type GenerateGeminiOmniVideoParams = {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  onOperationCreated?: (operationId: string) => Promise<void>;
  onOperationSucceeded?: (
    operationId: string,
    outputUrl?: string,
  ) => Promise<void>;
  prompt: string;
  providerOperationId?: string;
  referenceImageUrl?: string;
};

const DEFAULT_OMNI_MODEL = "gemini-omni-flash-preview";
const POLL_INTERVAL_MS = 10_000;
const TIMEOUT_MS = 10 * 60_000;

let googleClient: GoogleGenAI | null = null;

export async function generateGeminiOmniVideoBuffer({
  aspectRatio,
  durationSeconds,
  onOperationCreated,
  onOperationSucceeded,
  prompt,
  providerOperationId,
  referenceImageUrl,
}: GenerateGeminiOmniVideoParams) {
  const ai = getGoogleClient();
  const startedAt = Date.now();
  const model = process.env.GEMINI_OMNI_MODEL?.trim() || DEFAULT_OMNI_MODEL;
  let interaction;

  if (providerOperationId) {
    try {
      interaction = await ai.interactions.get(providerOperationId);
    } catch (error) {
      throw new ProviderOperationPollingError(
        "Google Omni generation status could not be read.",
        { cause: error },
      );
    }
  } else {
    const referenceImage = referenceImageUrl
      ? await downloadReferenceImage(referenceImageUrl)
      : null;
    interaction = await ai.interactions.create({
      input: referenceImage
        ? [
            {
              data: referenceImage.data,
              mime_type: referenceImage.mimeType,
              type: "image" as const,
            },
            { text: prompt, type: "text" as const },
          ]
        : prompt,
      model,
      response_format: {
        aspect_ratio: aspectRatio,
        delivery: "uri",
        duration: `${durationSeconds}s`,
        type: "video",
      },
    });
    await onOperationCreated?.(interaction.id);
  }

  while (interaction.status === "in_progress") {
    if (Date.now() - startedAt > TIMEOUT_MS) {
      throw new ProviderOperationPollingError(
        "Google Omni video generation is still processing.",
      );
    }

    await sleep(POLL_INTERVAL_MS);

    try {
      interaction = await ai.interactions.get(interaction.id);
    } catch (error) {
      throw new ProviderOperationPollingError(
        "Google Omni generation status could not be read.",
        { cause: error },
      );
    }
  }

  if (interaction.status !== "completed" || !interaction.output_video) {
    throw new ProviderOperationTerminalError(
      `Google Omni generation ended with status ${interaction.status}.`,
      interaction,
    );
  }

  await onOperationSucceeded?.(
    interaction.id,
    getHttpUrl(interaction.output_video.uri),
  );

  if (interaction.output_video.data) {
    return Buffer.from(interaction.output_video.data, "base64");
  }

  if (!interaction.output_video.uri) {
    throw new ProviderOperationTerminalError(
      "Google Omni completed without a downloadable video.",
    );
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "ugc-omni-"));
  const downloadPath = path.join(tempDir, `${randomUUID()}.mp4`);

  try {
    await ai.files.download({
      downloadPath,
      file: interaction.output_video.uri,
    });
    return await readFile(downloadPath);
  } catch (error) {
    throw new ProviderOperationPollingError(
      "Google Omni output could not be downloaded.",
      { cause: error },
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function getGoogleClient() {
  if (!googleClient) {
    googleClient = new GoogleGenAI({
      apiKey: getRequiredProviderEnv("GEMINI_API_KEY"),
      httpOptions: { retryOptions: { attempts: 1 } },
    });
  }

  return googleClient;
}

async function downloadReferenceImage(url: string) {
  let response: Response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new ProviderRequestNotSubmittedError(
      "The Google Omni reference image could not be downloaded.",
      { cause: error, retryable: true },
    );
  }

  if (!response.ok) {
    throw new ProviderRequestNotSubmittedError(
      "The Google Omni reference image could not be downloaded.",
      { retryable: response.status === 429 || response.status >= 500 },
    );
  }

  const mimeType =
    response.headers.get("content-type")?.split(";", 1)[0] ?? "image/png";
  const data = Buffer.from(await response.arrayBuffer());

  if (!mimeType.startsWith("image/") || data.length === 0) {
    throw new ProviderRequestNotSubmittedError(
      "The Google Omni reference image is invalid.",
    );
  }

  return { data: data.toString("base64"), mimeType };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHttpUrl(value: string | undefined) {
  return value && /^https?:\/\//i.test(value) ? value : undefined;
}
