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
import { downloadVideoReference, readMp4DurationSeconds, OMNI_EDIT_MAX_VIDEO_SECONDS } from "./video-reference-input.js";

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
  referenceImageUrls?: string[];
  referenceVideoUrl?: string;
  referenceVideoDurationSeconds?: number;
  referenceVideoMode?: "edit";
  resolution: "480p" | "720p" | "1080p";
};

const DEFAULT_OMNI_MODEL = "gemini-omni-1.1-flash";
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
  referenceImageUrls,
  referenceVideoUrl,
  referenceVideoDurationSeconds,
  referenceVideoMode,
  resolution,
}: GenerateGeminiOmniVideoParams) {
  const ai = getGoogleClient();
  const startedAt = Date.now();
  const model = process.env.GEMINI_OMNI_MODEL?.trim() || DEFAULT_OMNI_MODEL;
  let interaction;

  if (resolution === "480p") {
    throw new ProviderRequestNotSubmittedError(
      "Google Omni supports 720p or 1080p video quality.",
    );
  }

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
    if (referenceVideoUrl && (referenceVideoMode !== "edit" || !referenceVideoDurationSeconds || !Number.isFinite(referenceVideoDurationSeconds) || referenceVideoDurationSeconds <= 0 || referenceVideoDurationSeconds > OMNI_EDIT_MAX_VIDEO_SECONDS)) {
      throw new ProviderRequestNotSubmittedError("Google Omni video editing requires a source video up to 10 seconds.");
    }
    if (referenceVideoMode && !referenceVideoUrl) {
      throw new ProviderRequestNotSubmittedError("The source video is missing. No generation was submitted.");
    }
    const imageUrls = referenceImageUrls?.length
      ? referenceImageUrls
      : referenceImageUrl ? [referenceImageUrl] : [];
    if (imageUrls.length > 6) {
      throw new ProviderRequestNotSubmittedError("UGC Pilot accepts up to 6 Google Omni reference images.");
    }
    const referenceImages = await Promise.all(imageUrls.map(downloadReferenceImage));
    let referenceVideo;
    if (referenceVideoUrl) {
      try {
        const video = await downloadVideoReference(referenceVideoUrl);
        if (video.buffer.subarray(4, 8).toString("ascii") === "ftyp") {
          const actualDuration = readMp4DurationSeconds(video.buffer);
          if (actualDuration > OMNI_EDIT_MAX_VIDEO_SECONDS || Math.abs(actualDuration - referenceVideoDurationSeconds!) > 0.25) {
            throw new Error("The reference video's actual duration does not match its saved duration.");
          }
        }
        referenceVideo = { data: video.buffer.toString("base64"), mimeType: video.mimeType };
      } catch (error) {
        throw new ProviderRequestNotSubmittedError("Could not load the source video. No generation was submitted.", { cause: error });
      }
    }
    const generationPrompt = referenceVideo
      ? `[# Sources <VIDEO_0>@Video1]${referenceImages.length ? ` [# References ${referenceImages.map((_, index) => `<IMAGE_REF_${index}>@Image${index + 1}`).join(" ")}]` : ""}\nEdit the supplied source video. Preserve its actions, timing, camera, lighting and scene except for the changes requested below.${referenceImages.length ? " Use the supplied image(s) as appearance references, not as starting frames." : ""}\n${prompt}`
      : prompt;
    await validateOmniInputTokens(ai, model, generationPrompt, [...referenceImages, ...(referenceVideo ? [referenceVideo] : [])]);
    interaction = await ai.interactions.create({
      input: referenceImages.length || referenceVideo
        ? [
            ...(referenceVideo ? [{ data: referenceVideo.data, mime_type: referenceVideo.mimeType, type: "video" as const }] : []),
            ...referenceImages.map((image) => ({
              data: image.data,
              mime_type: image.mimeType,
              type: "image" as const,
            })),
            { text: generationPrompt, type: "text" as const },
          ]
        : prompt,
      model,
      ...(referenceVideo ? { generation_config: { video_config: { task: "edit" as const } } } : {}),
      response_format: {
        // Edits inherit the source framing; Google rejects aspect_ratio for edit.
        ...(!referenceVideo ? { aspect_ratio: aspectRatio } : {}),
        delivery: "uri",
        // Edit mode retains the source timeline; an output duration would ask
        // the provider to shorten or extend the footage instead.
        ...(!referenceVideo ? { duration: `${durationSeconds}s` } : {}),
        resolution,
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

async function validateOmniInputTokens(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  referenceImages: { data: string; mimeType: string }[],
) {
  let inputTokenLimit: number | undefined;
  let totalTokens: number | undefined;

  try {
    const [modelInfo, count] = await Promise.all([
      ai.models.get({ model }),
      ai.models.countTokens({
        model,
        contents: referenceImages.length
          ? [...referenceImages.map(image => ({ inlineData: image })), { text: prompt }]
          : prompt,
      }),
    ]);
    inputTokenLimit = modelInfo.inputTokenLimit;
    totalTokens = count.totalTokens;
  } catch (error) {
    // These are read-only preflight requests. No video was submitted, so a
    // temporary outage must remain retryable rather than an uncertain paid call.
    throw new ProviderRequestNotSubmittedError(
      "Could not check Google Omni's prompt limit. Please try again.",
      { cause: error, retryable: true },
    );
  }

  if (
    inputTokenLimit === undefined || !Number.isSafeInteger(inputTokenLimit) || inputTokenLimit <= 0 ||
    totalTokens === undefined || !Number.isSafeInteger(totalTokens) || totalTokens < 0
  ) {
    throw new ProviderRequestNotSubmittedError(
      "Could not check Google Omni's prompt limit. Please try again.",
      { retryable: true },
    );
  }

  if (totalTokens > inputTokenLimit) {
    throw new ProviderRequestNotSubmittedError(
      `Google Omni supports up to ${inputTokenLimit.toLocaleString("en-US")} input tokens, including reference media. Shorten your prompt and try again.`,
    );
  }
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
