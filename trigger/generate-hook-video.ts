import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { uploadBufferToS3 } from "@/lib/storage/s3";
import { buildUgcVideoPrompt } from "@/lib/video/build-ugc-video-prompt";
import { generateRunwayHookVideoBuffer } from "@/lib/video/providers/runway";
import { generateVeoHookVideoBuffer } from "@/lib/video/providers/veo";
import {
  hookVideoCameraStyles,
  hookVideoEmotions,
  hookVideoProviders,
  type HookVideoProvider,
} from "@/lib/video/types";

const GenerateHookVideoPayloadSchema = z.object({
  videoId: z.string().min(1),
  userId: z.string().min(1),
  projectId: z.string().min(1),
  provider: z.enum(hookVideoProviders).optional(),
  avatarImageUrl: z.string().url().optional(),
  productName: z.string().min(1).optional(),
  productDescription: z.string().min(1).optional(),
  hookIdea: z.string().min(1).max(1_000),
  emotion: z.enum(hookVideoEmotions),
  cameraStyle: z.enum(hookVideoCameraStyles),
});

type GenerateHookVideoPayload = z.infer<typeof GenerateHookVideoPayloadSchema>;

async function generateWithProvider(
  provider: HookVideoProvider,
  payload: GenerateHookVideoPayload,
  prompt: string,
) {
  const params = {
    prompt,
    referenceImageUrl: payload.avatarImageUrl,
  };

  if (provider === "runway") {
    return {
      buffer: await generateRunwayHookVideoBuffer(params),
      provider,
    };
  }

  return {
    buffer: await generateVeoHookVideoBuffer(params),
    provider,
  };
}

async function generateWithFallback(
  payload: GenerateHookVideoPayload,
  prompt: string,
) {
  const preferredProvider = payload.provider ?? "veo";

  if (preferredProvider === "runway") {
    return generateWithProvider("runway", payload, prompt);
  }

  try {
    return await generateWithProvider("veo", payload, prompt);
  } catch (veoError) {
    logger.warn("Veo hook video generation failed; trying Runway fallback", {
      videoId: payload.videoId,
      error: veoError instanceof Error ? veoError.message : String(veoError),
    });

    try {
      return await generateWithProvider("runway", payload, prompt);
    } catch (runwayError) {
      throw new Error(
        `Veo failed: ${
          veoError instanceof Error ? veoError.message : String(veoError)
        }. Runway fallback failed: ${
          runwayError instanceof Error ? runwayError.message : String(runwayError)
        }`,
      );
    }
  }
}

export const generateHookVideoTask = task({
  id: "generate-hook-video",
  run: async (rawPayload: unknown) => {
    const payload = GenerateHookVideoPayloadSchema.parse(rawPayload);

    logger.info("Hook video task started", {
      videoId: payload.videoId,
      userId: payload.userId,
      projectId: payload.projectId,
      provider: payload.provider ?? "veo",
    });

    const prompt = buildUgcVideoPrompt(payload);
    const { buffer, provider } = await generateWithFallback(payload, prompt);

    logger.info("Hook video generated", {
      videoId: payload.videoId,
      provider,
      bufferSize: buffer.length,
    });

    const key = `videos/hooks/${payload.userId}/${payload.projectId}/${payload.videoId}.mp4`;
    const result = await uploadBufferToS3({
      key,
      buffer,
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000, immutable",
    });

    logger.info("Hook video uploaded to S3", {
      videoId: payload.videoId,
      provider,
      key: result.key,
      url: result.url,
    });

    return {
      ok: true,
      videoId: payload.videoId,
      provider,
      key: result.key,
      url: result.url,
    };
  },
});
