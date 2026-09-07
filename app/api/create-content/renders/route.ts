import { NextResponse } from "next/server";
import { z } from "zod";

import { getCreateContentCardForOwner } from "@/lib/create-content/card-storage";
import { buildCreateContentRenderOverlay } from "@/lib/create-content/render-contract";
import {
  attachCreateContentRenderJob,
  createOrRetryQueuedCreateContentRender,
  failCreateContentRender,
  getCreateContentRenderForCard,
  getMissingCreateContentRenderEnvVars,
} from "@/lib/create-content/render-storage";
import { isCreateContentVideo } from "@/lib/create-content/video-assets";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  attachQueueMessageToBackgroundJob,
  createBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";
import { getMediaAssetForOwner, serializeMediaAsset } from "@/lib/media/media-storage";
import {
  getMissingJobQueueEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/queues/job-queue";
import { isTrustedStorageUrl } from "@/lib/storage/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RENDER_JOB_TYPE = "render_create_content_video";
const REQUEST_SCHEMA = z.object({ sourceMediaAssetId: z.string().uuid() }).strip();

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const sourceMediaAssetId = new URL(request.url).searchParams.get("assetId");
    const assetId = z.string().uuid().safeParse(sourceMediaAssetId);

    if (!assetId.success) {
      return json({ error: "Choose a valid video.", ok: false }, 400);
    }

    const card = await getCreateContentCardForOwner({
      sourceMediaAssetId: assetId.data,
      userId: user.uid,
    });
    if (!card) {
      return json({ error: "Add text to this video before preparing it.", ok: false }, 404);
    }

    const render = await getCreateContentRenderForCard({
      cardRevision: card.revision,
      sourceMediaAssetId: card.sourceMediaAssetId,
      userId: user.uid,
    });

    return json({ ok: true, render });
  } catch (error) {
    return errorResponse(error, "Could not check video preparation.");
  }
}

export async function POST(request: Request) {
  let renderId: string | null = null;
  let userId: string | null = null;
  let backgroundJobId: string | null = null;

  try {
    const user = await requireFirebaseUser(request);
    userId = user.uid;
    const body = REQUEST_SCHEMA.safeParse(
      await request.json().catch(() => null),
    );

    if (!body.success) {
      return json({ error: "Choose a valid video.", ok: false }, 400);
    }

    const missing = Array.from(
      new Set([
        ...getMissingCreateContentRenderEnvVars(),
        ...getMissingBackgroundJobStorageEnvVars(),
        ...getMissingJobQueueEnvVars([RENDER_JOB_TYPE]),
      ]),
    );
    if (missing.length > 0) {
      return json(
        { error: `Video preparation is not configured. Add ${missing.join(", ")}.`, ok: false },
        501,
      );
    }

    const [card, source] = await Promise.all([
      getCreateContentCardForOwner({
        sourceMediaAssetId: body.data.sourceMediaAssetId,
        userId: user.uid,
      }),
      getMediaAssetForOwner({
        assetId: body.data.sourceMediaAssetId,
        userId: user.uid,
      }),
    ]);
    const sourceAsset = source ? serializeMediaAsset(source) : null;

    if (!card || !sourceAsset || !isCreateContentVideo(sourceAsset)) {
      return json(
        { error: "This Creative Assets video or its text is no longer available.", ok: false },
        404,
      );
    }

    if (!isTrustedStorageUrl(sourceAsset.url)) {
      return json(
        { error: "This Creative Assets video is not ready to render yet.", ok: false },
        409,
      );
    }

    let overlay;
    try {
      overlay = buildCreateContentRenderOverlay(card);
    } catch (error) {
      return json(
        {
          error: getErrorMessage(error, "This text cannot be prepared yet."),
          ok: false,
        },
        400,
      );
    }

    const queued = await createOrRetryQueuedCreateContentRender({
      cardRevision: card.revision,
      id: crypto.randomUUID(),
      overlay,
      sourceMediaAssetId: sourceAsset.id,
      userId: user.uid,
    });
    renderId = queued.render.id;

    if (!queued.created) {
      return json({ ok: true, render: queued.render }, queued.render.status === "ready" ? 200 : 202);
    }

    const backgroundJob = await createBackgroundJob({
      // The render snapshot is deduplicated by its card revision. A retry must
      // use a new delivery-job key, otherwise a previous failed background job
      // would be returned instead of being dispatched again.
      idempotencyKey: `create-content-render:${queued.render.id}:${crypto.randomUUID()}`,
      input: {
        cardRevision: card.revision,
        overlay,
        projectId: sourceAsset.projectId ?? "create-content",
        renderId: queued.render.id,
        sourceVideoId: sourceAsset.id,
        sourceVideoUrl: sourceAsset.url,
        title: sourceAsset.title,
        userId: user.uid,
      },
      jobType: RENDER_JOB_TYPE,
      projectId: sourceAsset.projectId,
      queueName: getQueueNameForJobType(RENDER_JOB_TYPE),
      userId: user.uid,
    });
    backgroundJobId = backgroundJob.id;
    const jobAttached = await attachCreateContentRenderJob({
      jobId: backgroundJob.id,
      renderId: queued.render.id,
      userId: user.uid,
    });
    const message = await sendJobMessage({
      jobId: backgroundJob.id,
      jobType: RENDER_JOB_TYPE,
    });
    await attachQueueMessageToBackgroundJob({
      jobId: backgroundJob.id,
      queueMessageId: message.messageId,
    });

    return json({ ok: true, render: jobAttached }, 202);
  } catch (error) {
    const message = getErrorMessage(error, "Could not start video preparation.");

    if (backgroundJobId) {
      try {
        await markBackgroundJobFailed({ errorMessage: message, jobId: backgroundJobId });
      } catch (failureError) {
        console.error("Could not reconcile Create Content background job failure:", failureError);
      }
    }
    if (renderId && userId) {
      try {
        await failCreateContentRender({ errorMessage: message, renderId, userId });
      } catch (failureError) {
        console.error("Could not reconcile Create Content preparation failure:", failureError);
      }
    }

    return errorResponse(error, message);
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        error: error.status === 401 ? "Sign in before preparing this video." : error.message,
        ok: false,
      },
      error.status,
    );
  }

  console.error(fallback, error);
  return json({ error: fallback, ok: false }, 500);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
