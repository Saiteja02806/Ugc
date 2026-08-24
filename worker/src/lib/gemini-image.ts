import { GoogleGenAI } from "@google/genai";

import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import type { AIStudioImageRatio } from "./image-output.js";

const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";
const MAX_REFERENCE_IMAGE_BYTES = 25 * 1024 * 1024;

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
  const interaction = await ai.interactions.create({
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
      delivery: "inline",
      image_size: "1K",
      type: "image",
    },
  });

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

function getGoogleClient() {
  if (!googleClient) {
    googleClient = new GoogleGenAI({
      apiKey: getRequiredEnv("GEMINI_API_KEY"),
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
      "The uploaded reference image could not be downloaded.",
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image could not be downloaded.",
    );
  }

  const mimeType =
    response.headers.get("content-type")?.split(";", 1)[0] ?? "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());

  if (
    !mimeType.startsWith("image/") ||
    buffer.length === 0 ||
    buffer.length > MAX_REFERENCE_IMAGE_BYTES
  ) {
    throw new ProviderRequestNotSubmittedError(
      "The uploaded reference image is invalid or too large.",
    );
  }

  return { data: buffer.toString("base64"), mimeType };
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ProviderRequestNotSubmittedError(`Missing ${name}.`);
  }

  return value;
}
