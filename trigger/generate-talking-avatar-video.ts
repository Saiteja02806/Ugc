import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { uploadBufferToS3 } from "@/lib/storage/s3";
import { upsertReadyMediaAsset } from "@/lib/media/media-storage";
import { generateHeyGenTalkingAvatarVideoBuffer } from "@/lib/video/providers/heygen";

const GenerateTalkingAvatarVideoPayloadSchema = z.object({
  videoId: z.string().min(1),
  userId: z.string().min(1),
  projectId: z.string().min(1),
  avatarImageUrl: z.string().url().optional(),
  avatarId: z.string().min(1).optional(),
  voiceId: z.string().min(1).optional(),
  script: z.string().min(1).max(2_000),
});

export const generateTalkingAvatarVideoTask = task({
  id: "generate-talking-avatar-video",
  run: async (rawPayload: unknown) => {
    const payload = GenerateTalkingAvatarVideoPayloadSchema.parse(rawPayload);

    logger.info("Talking avatar video task started", {
      videoId: payload.videoId,
      userId: payload.userId,
      projectId: payload.projectId,
    });

    const buffer = await generateHeyGenTalkingAvatarVideoBuffer({
      avatarId: payload.avatarId,
      avatarImageUrl: payload.avatarImageUrl,
      script: payload.script,
      voiceId: payload.voiceId,
    });

    logger.info("Talking avatar video generated", {
      videoId: payload.videoId,
      bufferSize: buffer.length,
    });

    const key = `videos/talking-avatar/${payload.userId}/${payload.projectId}/${payload.videoId}.mp4`;
    const result = await uploadBufferToS3({
      key,
      buffer,
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000, immutable",
    });

    logger.info("Talking avatar video uploaded to S3", {
      videoId: payload.videoId,
      key: result.key,
      url: result.url,
    });

    await upsertReadyMediaAsset({
      assetId: payload.videoId,
      collection: "video",
      metadata: { provider: "heygen" },
      mimeType: "video/mp4",
      projectId: payload.projectId,
      ratio: "9:16",
      sourceRecordId: payload.videoId,
      sourceType: "generated_video",
      storageKey: result.key,
      title: "Talking influencer video",
      url: result.url,
      userId: payload.userId,
    });

    return {
      ok: true,
      videoId: payload.videoId,
      provider: "heygen",
      key: result.key,
      url: result.url,
    };
  },
});
