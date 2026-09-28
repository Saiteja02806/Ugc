import { GoogleGenAI } from "@google/genai";

import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import type { AIStudioImageRatio } from "./image-output.js";
import { getRequiredProviderEnv } from "./provider-env.js";
import { downloadReferenceImageBytes } from "./reference-image-download.js";

const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

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
      `Nano Banana 2 generation ended with status ${interaction.status}.`,
    );
  }

  if (!interaction.output_image?.data) {
    throw new Error("Nano Banana 2 did not return image data.");
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
      image_size: "1K",
      type: "image",
    },
  };
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
