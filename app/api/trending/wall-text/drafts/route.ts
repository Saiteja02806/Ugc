import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getMissingJobQueueEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/queues/job-queue";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
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
import { isRenderableWallTextDuration } from "@/lib/trending/wall-text-feed-logic";
import {
  attachWallTextRenderJob,
  claimWallTextRender,
  getMissingWallTextDbEnvVars,
  getSavedWallTextDraft,
  listSavedWallTextDrafts,
  markWallTextRenderQueueFailed,
} from "@/lib/trending/wall-text-db";
import { getWallTextPreviewTitle } from "@/lib/trending/wall-text-text-logic";
import { DEFAULT_TRENDING_TEXT_COLOR } from "@/lib/trending/text-color";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALL_TEXT_RENDER_JOB_TYPE = "render_wall_text_video";
const SaveWallTextDraftSchema = z
  .object({
    assignmentId: z.string().uuid(),
  })
  .strict();

export async function GET(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const assignmentId = new URL(request.url).searchParams.get("assignmentId");

    if (assignmentId) {
      const parsedAssignmentId = z.string().uuid().safeParse(assignmentId);

      if (!parsedAssignmentId.success) {
        return json({ error: "Choose a valid Wall-of-text video.", ok: false }, 400);
      }

      const draft = await getSavedWallTextDraft({
        assignmentId: parsedAssignmentId.data,
        userId,
      });

      if (!draft) {
        return json({ error: "This Wall-of-text video was not found.", ok: false }, 404);
      }

      return json({ draft, ok: true });
    }

    return json({
      drafts: await listSavedWallTextDrafts({ userId }),
      ok: true,
    });
  } catch (error) {
    console.error("Could not load saved Wall-of-text videos:", error);
    return json(
      { error: "Could not load saved Wall-of-text videos.", ok: false },
      500,
    );
  }
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = SaveWallTextDraftSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return json({ error: "Choose a valid Wall-of-text video.", ok: false }, 400);
  }

  const missingRuntimeEnv = Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingWallTextDbEnvVars(),
      ...getMissingJobQueueEnvVars([WALL_TEXT_RENDER_JOB_TYPE]),
    ]),
  );

  if (missingRuntimeEnv.length > 0) {
    return json(
      {
        error: "Wall-of-text video preparation is temporarily unavailable.",
        ok: false,
      },
      501,
    );
  }

  try {
    const draft = await getRequiredDraft(parsed.data.assignmentId, userId);
    const creativeEdit = await loadSavedTrendingCreativeEditForDownstream({
      creativeId: draft.id,
      format: "wall_text",
      userId,
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
      return json(
        {
          error: "Wall-of-text background videos must be 60 seconds or shorter.",
          ok: false,
        },
        409,
      );
    }

    if (!isTrustedStorageUrl(sourceVideoUrl)) {
      return json(
        { error: "This Wall-of-text background is not available for rendering.", ok: false },
        409,
      );
    }

    const audio = await resolveWallTextAudioSelection({
      content: editedContent?.content ?? draft.text,
      creativeId: draft.id,
      editId: creativeEdit?.id,
      editRevision: creativeEdit?.revision,
      userId,
      videoDurationSeconds: durationSeconds,
    });

    if (!isTrustedStorageUrl(audio.audioUrl)) {
      return json(
        { error: "The selected Wall audio is not available for rendering.", ok: false },
        409,
      );
    }

    let claimed = await claimWallTextRender({
      assignmentId: parsed.data.assignmentId,
      editId: creativeEdit?.id,
      editRevision: creativeEdit?.revision,
      userId,
    });

    if (claimed.render_job_id) {
    const existingJob = await getBackgroundJobById(claimed.render_job_id);

    if (
      existingJob &&
      ["completed", "processing", "queued"].includes(existingJob.status)
    ) {
      return json({ draft, jobId: existingJob.id, ok: true });
    }

    if (claimed.render_id) {
      await markWallTextRenderQueueFailed({
        assignmentId: claimed.id,
        errorMessage: "The previous Wall-of-text render could not continue.",
        renderId: claimed.render_id,
        userId,
      });
      claimed = await claimWallTextRender({
        assignmentId: parsed.data.assignmentId,
        editId: creativeEdit?.id,
        editRevision: creativeEdit?.revision,
        userId,
      });
    }
  }

  if (!claimed.render_id) {
    return json(
      { error: "Could not prepare this Wall-of-text video.", ok: false },
      409,
    );
  }

  const creationResult = await createBackgroundJobWithCreationResult({
    idempotencyKey: `wall-text-render:${claimed.render_id}`,
    input: {
      assignmentId: claimed.id,
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
          top: editedContent?.layout.safeArea.top ?? draft.layout.safeArea.top,
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
      userId,
    },
    jobType: WALL_TEXT_RENDER_JOB_TYPE,
    projectId: "trending-wall-text",
    queueName: getQueueNameForJobType(WALL_TEXT_RENDER_JOB_TYPE),
    userId,
  });
  const job = creationResult.job;

  await attachWallTextRenderJob({
    assignmentId: claimed.id,
    jobId: job.id,
    renderId: claimed.render_id,
    userId,
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
            console.error("Wall-of-text render was sent without message metadata:", error);
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
              userId,
            }),
          ]);
        }

        console.error("Could not queue the Wall-of-text render:", error);
        return json(
          { error: "Could not start preparing this Wall-of-text video.", ok: false },
          500,
        );
      }
    }
  }

    return json({
      draft: await getRequiredDraft(parsed.data.assignmentId, userId),
      jobId: job.id,
      ok: true,
    });
  } catch (error) {
    if (error instanceof TrendingCreativeEditAccessError) {
      return json({ error: error.message, ok: false }, error.status);
    }

    console.error("Could not save the Wall-of-text video:", error);
    return json(
      { error: "Could not save and prepare this Wall-of-text video.", ok: false },
      500,
    );
  }
}

async function getRequiredDraft(assignmentId: string, userId: string) {
  const draft = await getSavedWallTextDraft({ assignmentId, userId });

  if (!draft) {
    throw new Error("Saved Wall-of-text video could not be reloaded.");
  }

  return draft;
}

function authErrorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        error:
          error.status === 401
            ? "Sign in before saving Wall-of-text videos."
            : error.message,
        ok: false,
      },
      error.status,
    );
  }

  console.error("Failed to verify Wall-of-text requester:", error);
  return json({ error: "Could not verify your sign-in session.", ok: false }, 500);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
