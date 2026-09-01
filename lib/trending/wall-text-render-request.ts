import "server-only";

import {
  getMissingJobQueueEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/queues/job-queue";
import { shouldDeliverCarouselJobMessage } from "@/lib/jobs/background-job-delivery-logic";
import { sendBackgroundJobMessageWithBestEffortAttachment } from "@/lib/jobs/background-job-message-delivery";
import {
  attachQueueMessageToBackgroundJob,
  claimBackgroundJobDelivery,
  createBackgroundJobWithCreationResult,
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { loadSavedTrendingCreativeEditForDownstream } from "@/lib/trending/creative-edit-service";
import { TrendingCreativeEditAccessError } from "@/lib/trending/creative-edits";
import { resolveWallTextAudioSelection } from "@/lib/trending/wall-audio-db";
import {
  attachWallTextRenderJob,
  claimWallTextRender,
  getMissingWallTextDbEnvVars,
  getSelectedWallTextDraft,
  getWallTextGenerationAttribution,
  markWallTextRenderQueueFailed,
  type SavedWallTextDraft,
} from "@/lib/trending/wall-text-db";
import { isRenderableWallTextDuration } from "@/lib/trending/wall-text-feed-logic";
import { createWallTextDuplicateSignature } from "@/lib/trending/wall-text-duplicate-logic";
import { classifyWallTextEdit } from "@/lib/trending/wall-text-edit-attribution";
import { getWallTextPreviewTitle } from "@/lib/trending/wall-text-text-logic";
import { DEFAULT_TRENDING_TEXT_COLOR } from "@/lib/trending/text-color";

export const WALL_TEXT_RENDER_JOB_TYPE = "render_wall_text_video";

export class WallTextRenderRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "WallTextRenderRequestError";
    this.status = status;
  }
}

export type WallTextRenderRequestResult = {
  draft: SavedWallTextDraft;
  jobId: string | null;
  renderId: string | null;
};

/**
 * Starts (or joins) the durable render for one saved Wall-of-text assignment.
 * This is intentionally server-only: the caller can save a pending schedule
 * before it invokes this helper, so a browser closing cannot lose that choice.
 */
export async function requestWallTextRender(params: {
  assignmentId: string;
  userId: string;
}): Promise<WallTextRenderRequestResult> {
  const missingRuntimeEnv = getMissingWallTextRenderRuntimeEnvVars();

  if (missingRuntimeEnv.length > 0) {
    throw new WallTextRenderRequestError(
      "Wall-of-text video preparation is temporarily unavailable.",
      501,
    );
  }

  try {
    const draft = await getRequiredDraft(params.assignmentId, params.userId);
    const creativeEdit = await loadSavedTrendingCreativeEditForDownstream({
      creativeId: draft.id,
      format: "wall_text",
      userId: params.userId,
    });
    const editedContent =
      creativeEdit?.content.format === "wall_text"
        ? creativeEdit.content
        : null;
    const sourceVideoUrl =
      creativeEdit?.source?.resolvedAssetUrl ?? draft.previewUrl;
    const durationSeconds =
      creativeEdit?.source?.resolvedAssetDurationSeconds ??
      draft.durationSeconds;

    if (!isRenderableWallTextDuration(durationSeconds)) {
      throw new WallTextRenderRequestError(
        "Wall-of-text background videos must be 60 seconds or shorter.",
        409,
      );
    }

    if (!isTrustedStorageUrl(sourceVideoUrl)) {
      throw new WallTextRenderRequestError(
        "This Wall-of-text background is not available for rendering.",
        409,
      );
    }

    const generationAttribution = await getWallTextGenerationAttribution({
      creativeId: draft.id,
      userId: params.userId,
    });
    const lockedAudioAssetId = creativeEdit?.source
      ? null
      : generationAttribution?.lockedAudioAssetId ?? null;
    const audio = await resolveWallTextAudioSelection({
      content: editedContent?.content ?? draft.text,
      creativeId: draft.id,
      editId: creativeEdit?.id,
      editRevision: creativeEdit?.revision,
      lockedAudioAssetId,
      userId: params.userId,
      videoDurationSeconds: durationSeconds,
    });

    if (!isTrustedStorageUrl(audio.audioUrl)) {
      throw new WallTextRenderRequestError(
        "The selected Wall audio is not available for rendering.",
        409,
      );
    }

    const editAttribution = editedContent
      ? classifyWallTextEdit({
          editedText: editedContent.content.fullText,
          originalText: draft.text.fullText,
        })
      : null;
    const contentSignature =
      editAttribution?.duplicateSignature ??
      createWallTextDuplicateSignature(draft.text.fullText);

    let claimed = await claimWallTextRender({
      assignmentId: params.assignmentId,
      editId: creativeEdit?.id,
      editRevision: creativeEdit?.revision,
      userId: params.userId,
    });

    if (claimed.render_job_id) {
      const existingJob = await getBackgroundJobById(claimed.render_job_id);

      if (
        existingJob &&
        ["completed", "processing", "queued"].includes(existingJob.status)
      ) {
        return {
          draft: await getRequiredDraft(params.assignmentId, params.userId),
          jobId: existingJob.id,
          renderId: claimed.render_id ?? null,
        };
      }

      if (claimed.render_id) {
        await markWallTextRenderQueueFailed({
          assignmentId: claimed.id,
          errorMessage: "The previous Wall-of-text render could not continue.",
          renderId: claimed.render_id,
          userId: params.userId,
        });
        claimed = await claimWallTextRender({
          assignmentId: params.assignmentId,
          editId: creativeEdit?.id,
          editRevision: creativeEdit?.revision,
          userId: params.userId,
        });
      }
    }

    if (!claimed.render_id) {
      throw new WallTextRenderRequestError(
        "Could not prepare this Wall-of-text video.",
        409,
      );
    }

    const creationResult = await createBackgroundJobWithCreationResult({
      idempotencyKey: `wall-text-render:${claimed.render_id}`,
      input: {
        assignmentId: claimed.id,
        attribution: {
          contentHash: contentSignature.contentHash,
          editClassification: editAttribution?.classification ?? "none",
          formatId:
            generationAttribution?.formatId ?? draft.text.formatId ?? null,
          formatLearningEligible:
            Boolean(
              generationAttribution?.formatId ?? draft.text.formatId ?? null,
            ) &&
            generationAttribution?.sourceKind !== "instagram_reel" &&
            (editAttribution?.formatLearningEligible ?? true),
          formatVersion: generationAttribution?.formatVersion ?? 1,
          instagramReelTemplateId:
            creativeEdit?.source
              ? null
              : generationAttribution?.instagramReelTemplateId ?? null,
          selectionMode:
            generationAttribution?.selectionMode ?? "legacy_unknown",
          selectionWeight: generationAttribution?.selectionWeight ?? 1,
          selectorVersion:
            generationAttribution?.selectorVersion ?? "legacy_unknown",
          sourceKind: creativeEdit?.source
            ? "creative_asset"
            : generationAttribution?.sourceKind ?? "ugcpilot",
        },
        audio: {
          assetDurationSeconds: audio.audioAssetDurationSeconds,
          assetId: audio.audioAssetId,
          audioUrl: audio.audioUrl,
          cueStartSeconds: audio.cueStartSeconds,
          fadeOutSeconds: audio.fadeOutSeconds,
          fitMode: audio.fitMode,
          matchingVersion: audio.matchingVersion,
          selectionId: audio.selectionId,
        },
        creativeEditId: creativeEdit?.id ?? null,
        creativeEditRevision: creativeEdit?.revision ?? null,
        creativeId: draft.id,
        durationSeconds,
        layout: {
          placement: editedContent?.layout.placement ?? draft.layout.placement,
          safeArea: {
            bottom:
              editedContent?.layout.safeArea.bottom ?? draft.layout.safeArea.bottom,
            left:
              editedContent?.layout.safeArea.left ?? draft.layout.safeArea.left,
            right:
              editedContent?.layout.safeArea.right ?? draft.layout.safeArea.right,
            top:
              editedContent?.layout.safeArea.top ?? draft.layout.safeArea.top,
          },
          textBox: editedContent?.layout.textBox ?? draft.layout.textBox,
        },
        projectId: "trending-wall-text",
        renderId: claimed.render_id,
        sourceVideoUrl,
        text: editedContent?.content ?? draft.text,
        textColor: editedContent?.textColor ?? DEFAULT_TRENDING_TEXT_COLOR,
        title: getWallTextPreviewTitle(
          editedContent?.content.fullText ?? draft.text.fullText,
        ),
        userId: params.userId,
      },
      jobType: WALL_TEXT_RENDER_JOB_TYPE,
      projectId: "trending-wall-text",
      queueName: getQueueNameForJobType(WALL_TEXT_RENDER_JOB_TYPE),
      userId: params.userId,
    });
    const job = creationResult.job;

    await attachWallTextRenderJob({
      assignmentId: claimed.id,
      jobId: job.id,
      renderId: claimed.render_id,
      userId: params.userId,
    });

    if (
      shouldDeliverCarouselJobMessage({
        job,
        wasJustCreated: creationResult.created,
      })
    ) {
      const deliveryClaim = await claimBackgroundJobDelivery(job);

      if (deliveryClaim) {
        try {
          await sendBackgroundJobMessageWithBestEffortAttachment({
            attachMessage: (messageId) =>
              attachQueueMessageToBackgroundJob({
                queueMessageId: messageId,
                jobId: job.id,
              }),
            jobId: job.id,
            onAttachmentError: (error) => {
              console.error(
                "Wall-of-text render was sent without message metadata:",
                error,
              );
            },
            sendMessage: () =>
              sendJobMessage({
                jobId: job.id,
                jobType: WALL_TEXT_RENDER_JOB_TYPE,
              }),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not queue the render.";

          if (creationResult.created) {
            await Promise.allSettled([
              markBackgroundJobFailed({
                errorMessage: message,
                jobId: job.id,
              }),
              markWallTextRenderQueueFailed({
                assignmentId: claimed.id,
                errorMessage: message,
                renderId: claimed.render_id,
                userId: params.userId,
              }),
            ]);
          }

          console.error("Could not queue the Wall-of-text render:", error);
          throw new WallTextRenderRequestError(
            "Could not start preparing this Wall-of-text video.",
          );
        }
      }
    }

    return {
      draft: await getRequiredDraft(params.assignmentId, params.userId),
      jobId: job.id,
      renderId: claimed.render_id,
    };
  } catch (error) {
    if (
      error instanceof TrendingCreativeEditAccessError ||
      error instanceof WallTextRenderRequestError
    ) {
      throw error;
    }

    console.error("Could not save the Wall-of-text video:", error);
    throw new WallTextRenderRequestError(
      "Could not save and prepare this Wall-of-text video.",
    );
  }
}

export function getMissingWallTextRenderRuntimeEnvVars() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingWallTextDbEnvVars(),
      ...getMissingJobQueueEnvVars([WALL_TEXT_RENDER_JOB_TYPE]),
    ]),
  );
}

async function getRequiredDraft(assignmentId: string, userId: string) {
  const draft = await getSelectedWallTextDraft({ assignmentId, userId });

  if (!draft) {
    throw new WallTextRenderRequestError(
      "Selected Wall-of-text video could not be reloaded.",
      404,
    );
  }

  return draft;
}
