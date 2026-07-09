import { GoogleGenAI, type GeneratedVideo, type Image } from "@google/genai";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type GenerateVeoHookVideoParams = {
  prompt: string;
  referenceImageUrl?: string;
};

const VEO_MODEL = "veo-3.1-lite-generate-preview";
const VEO_DURATION_SECONDS = 4;
const VEO_POLL_INTERVAL_MS = 10_000;
const VEO_TIMEOUT_MS = 8 * 60_000;

let googleClient: GoogleGenAI | null = null;

export async function generateVeoHookVideoBuffer({
  prompt,
  referenceImageUrl,
}: GenerateVeoHookVideoParams) {
  const ai = getGoogleClient();
  const referenceImage = referenceImageUrl
    ? await downloadReferenceImage(referenceImageUrl)
    : undefined;
  const startedAt = Date.now();
  let operation = await ai.models.generateVideos({
    model: VEO_MODEL,
    ...(referenceImage
      ? {
          image: referenceImage,
          prompt,
        }
      : {
          source: {
            prompt,
          },
        }),
    config: {
      aspectRatio: "9:16",
      durationSeconds: VEO_DURATION_SECONDS,
      enhancePrompt: true,
      generateAudio: false,
      negativePrompt:
        "text overlays, captions, logos, watermarks, distorted face, extra people, robotic expression, glossy AI look",
      numberOfVideos: 1,
      personGeneration: "allow_adult",
    },
  });

  while (!operation.done) {
    if (Date.now() - startedAt > VEO_TIMEOUT_MS) {
      throw new Error("Veo video generation timed out.");
    }

    await sleep(VEO_POLL_INTERVAL_MS);
    operation = await ai.operations.getVideosOperation({ operation });
  }

  if (operation.error) {
    throw new Error(`Veo video generation failed: ${JSON.stringify(operation.error)}`);
  }

  const generatedVideo = operation.response?.generatedVideos?.[0];

  if (!generatedVideo?.video) {
    throw new Error("Veo video generation completed without a video.");
  }

  return downloadGeneratedVideo(ai, generatedVideo);
}

function getGoogleClient() {
  if (!googleClient) {
    googleClient = new GoogleGenAI({
      apiKey: getRequiredEnv("GEMINI_API_KEY"),
    });
  }

  return googleClient;
}

async function downloadReferenceImage(url: string): Promise<Image> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download Veo reference image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "image/png";

  if (!contentType.toLowerCase().includes("image")) {
    throw new Error(`Expected image response, got ${contentType}.`);
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
    throw new Error(`Missing ${name}`);
  }

  return value;
}
