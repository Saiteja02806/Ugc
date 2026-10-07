import { GoogleGenAI } from "@google/genai";

import {
  ProviderOperationPollingError,
  ProviderOperationTerminalError,
  ProviderRequestNotSubmittedError,
} from "./generation-provider.js";
import type { AIStudioImageRatio } from "./image-output.js";
import { getRequiredProviderEnv } from "./provider-env.js";
import { downloadReferenceImageBytes } from "./reference-image-download.js";

const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-nano-banana-2.1";
export const GEMINI_3_PRO_IMAGE_MODEL = "gemini-3-pro-image";

let googleClient: GoogleGenAI | null = null;

export async function generateGeminiImageBuffer(
  prompt: string,
  aspectRatio: AIStudioImageRatio,
  referenceImageUrl?: string,
) {
  const ai = getGoogleClient();
  const model =
    process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  const referenceImage = referenceImageUrl
    ? await downloadReferenceImage(referenceImageUrl)
    : null;
  const interaction = await ai.interactions.create(
    buildGeminiImageRequest({
      aspectRatio,
      model,
      prompt,
      referenceImage,
    }),
  );

  if (interaction.status !== "completed") {
    throw new Error(
      `Nano Banana 2.1 generation ended with status ${interaction.status}.`,
    );
  }

  if (!interaction.output_image?.data) {
    throw new Error("Nano Banana 2.1 did not return image data.");
  }

  return {
    buffer: Buffer.from(interaction.output_image.data, "base64"),
    model,
    requestId: interaction.id,
  };
}

export function buildGeminiImageRequest(params: {
  aspectRatio: AIStudioImageRatio;
  model: string;
  prompt: string;
  referenceImage: { data: string; mimeType: string } | null;
  imageSize?: "1K" | "2K";
}) {
  return {
    input: params.referenceImage
      ? [
          {
            data: params.referenceImage.data,
            mime_type: params.referenceImage.mimeType,
            type: "image" as const,
          },
          { text: params.prompt, type: "text" as const },
        ]
      : params.prompt,
    model: params.model,
    response_format: {
      aspect_ratio: params.aspectRatio,
      image_size: params.imageSize ?? "1K",
      type: "image",
    },
  };
}

export async function generateGemini3ProImageBuffer(params: {
  aspectRatio: AIStudioImageRatio;
  prompt: string;
  referenceImageUrl?: string;
  providerOperationId?: string;
  onOperationCreated: (operationId: string) => Promise<void>;
  onOperationSucceeded: (operationId: string) => Promise<void>;
}, clientOverride?: GoogleGenAI) {
  const ai = clientOverride ?? getGoogleClient();
  const startedAt = Date.now();
  let interaction;
  if (params.providerOperationId) {
    try {
      interaction = await ai.interactions.get(params.providerOperationId);
    } catch (cause) {
      throw new ProviderOperationPollingError("Gemini 3 Pro image status could not be read.", { cause });
    }
  } else {
    const prompt = params.prompt.trim();
    if (!prompt) {
      throw new ProviderRequestNotSubmittedError("Gemini 3 Pro requires a non-empty prompt.");
    }
    const referenceImage = params.referenceImageUrl
      ? await downloadReferenceImage(params.referenceImageUrl)
      : null;
    interaction = await ai.interactions.create(buildGeminiImageRequest({
      aspectRatio: params.aspectRatio,
      imageSize: "2K",
      model: GEMINI_3_PRO_IMAGE_MODEL,
      prompt,
      referenceImage,
    }));
    if (!interaction.id) throw new Error("Google returned no image interaction ID; acceptance could not be confirmed.");
    await params.onOperationCreated(interaction.id);
  }
  while (interaction.status === "in_progress") {
    if (Date.now() - startedAt > 8 * 60_000) {
      throw new ProviderOperationPollingError("Gemini 3 Pro image generation is still processing.");
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    try {
      interaction = await ai.interactions.get(interaction.id);
    } catch (cause) {
      throw new ProviderOperationPollingError("Gemini 3 Pro image status could not be read.", { cause });
    }
  }
  if (interaction.status !== "completed" || !interaction.output_image?.data) {
    throw new ProviderOperationTerminalError(
      `Gemini 3 Pro image generation ended with status ${interaction.status} without image data.`,
      interaction,
    );
  }
  await params.onOperationSucceeded(interaction.id);
  return Buffer.from(interaction.output_image.data, "base64");
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
  const { buffer, contentType: mimeType } = await downloadReferenceImageBytes(url);
  if (!mimeType.startsWith("image/")) {
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image is invalid or too large.",
    );
  }

  return { data: buffer.toString("base64"), mimeType };
}
