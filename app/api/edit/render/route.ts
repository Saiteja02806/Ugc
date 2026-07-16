import { NextResponse } from "next/server";

import {
  getMissingSqsEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/aws/sqs";
import {
  createQueuedRenderJob,
  DEFAULT_EDIT_PROJECT_ID,
  isEditRenderPersistenceConfigured,
  markRenderJobFailed,
} from "@/lib/edit/render-storage";
import { buildEditOverlayTextLayout } from "@/lib/edit/overlay-render-spec";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  attachAwsMessageToBackgroundJob,
  createBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";
import { isTrustedStorageUrl } from "@/lib/storage/s3";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import {
  markDemoVideoFailed,
  markDemoVideoRendering,
} from "@/lib/demo/demo-storage";

export const runtime = "nodejs";

const videoRatios = new Set(["9:16", "1:1", "4:5", "16:9"]);
const videoSources = new Set(["hook", "demo", "draft", "final"]);
const editableMediaSourceTypes = new Set([
  "upload",
  "influencer_upload",
  "catalog_influencer",
  "demo_upload",
  "generated_video",
]);
const textOverlayPositions = new Set(["top", "middle", "bottom"]);
const textOverlayStyles = new Set(["clean", "minimal", "bubble"]);
const MAX_TEXT_OVERLAYS = 3;
const AWS_RENDER_JOB_TYPE = "render_edit_video";

type RenderRequestBody = {
  draft?: {
    textOverlay?: {
      id?: unknown;
      position?: unknown;
      style?: unknown;
      text?: unknown;
    };
    textOverlays?: unknown;
    trimEndSeconds?: unknown;
    trimStartSeconds?: unknown;
  };
  durationSeconds?: unknown;
  projectId?: unknown;
  ratio?: unknown;
  source?: unknown;
  sourceVideoId?: unknown;
  sourceVideoUrl?: unknown;
  thumbnailUrl?: unknown;
  title?: unknown;
};

type RawTextOverlay = {
  id?: unknown;
  position?: unknown;
  style?: unknown;
  text?: unknown;
};

type RenderTextOverlay = {
  id: string;
  position: "top" | "middle" | "bottom";
  style: "clean" | "minimal" | "bubble";
  text: string;
};

type RenderDraftBody = NonNullable<RenderRequestBody["draft"]>;

function cleanText(value: unknown, fallback = "", maxLength = 180) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();

  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function cleanPathSegment(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return normalized || fallback;
}

function cleanChoice<TValue extends string>(
  value: unknown,
  allowedValues: Set<string>,
  fallback: TValue,
) {
  return typeof value === "string" && allowedValues.has(value)
    ? (value as TValue)
    : fallback;
}

function cleanTextOverlays(draft: RenderDraftBody | undefined): RenderTextOverlay[] {
  const rawOverlays = Array.isArray(draft?.textOverlays)
    ? draft.textOverlays
    : draft?.textOverlay
      ? [draft.textOverlay]
      : [];
  const overlays: RenderTextOverlay[] = [];
  const usedPositions = new Set<string>();

  for (const rawOverlay of rawOverlays) {
    if (
      !rawOverlay ||
      typeof rawOverlay !== "object" ||
      Array.isArray(rawOverlay)
    ) {
      continue;
    }

    const record = rawOverlay as RawTextOverlay;
    const position =
      typeof record.position === "string" &&
      textOverlayPositions.has(record.position)
        ? record.position
        : getAvailableTextOverlayPosition(usedPositions);

    if (!position || usedPositions.has(position)) {
      continue;
    }

    overlays.push({
      id: cleanText(record.id, crypto.randomUUID(), 96),
      position: position as RenderTextOverlay["position"],
      style: cleanChoice(record.style, textOverlayStyles, "bubble"),
      text: cleanText(record.text, "", 100),
    });
    usedPositions.add(position);

    if (overlays.length === MAX_TEXT_OVERLAYS) {
      break;
    }
  }

  return overlays.sort(
    (first, second) =>
      getTextOverlayPositionOrder(first.position) -
      getTextOverlayPositionOrder(second.position),
  );
}

function cleanSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function cleanOptionalUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value.trim());

    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanSourceVideoUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value.trim());

    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as RenderRequestBody;
  } catch {
    return null;
  }
}

function getAwsRenderMissingEnvVars() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingSqsEnvVars([AWS_RENDER_JOB_TYPE]),
    ]),
  );
}

export async function POST(request: Request) {
  let user;

  try {
    user = await requireFirebaseUser(request);
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status },
      );
    }

    console.error("Failed to verify render requester:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not verify your sign-in session.",
      },
      { status: 500 },
    );
  }

  const body = await readBody(request);

  if (!body) {
    return NextResponse.json(
      {
        ok: false,
        error: "Send save details as JSON.",
      },
      { status: 400 },
    );
  }

  const sourceVideoUrl = cleanSourceVideoUrl(body.sourceVideoUrl);

  if (!sourceVideoUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "A valid source video URL is required.",
      },
      { status: 400 },
    );
  }

  if (!isTrustedStorageUrl(sourceVideoUrl)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Save source must be an app-owned S3 or CloudFront video URL.",
      },
      { status: 400 },
    );
  }

  const sourceVideoId = cleanPathSegment(
    body.sourceVideoId,
    "source-video",
  );
  const sourceAsset = await getMediaAssetForOwner({
    assetId: sourceVideoId,
    userId: user.uid,
  });

  if (
    !sourceAsset ||
    sourceAsset.collection === "image" ||
    !editableMediaSourceTypes.has(sourceAsset.source_type)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Choose a video from Creative Assets before saving.",
      },
      { status: 404 },
    );
  }

  if (sourceAsset.url !== sourceVideoUrl) {
    return NextResponse.json(
      { ok: false, error: "The save source does not match this media asset." },
      { status: 409 },
    );
  }
  const projectId = cleanPathSegment(body.projectId, DEFAULT_EDIT_PROJECT_ID);

  if (typeof body.ratio !== "string" || !videoRatios.has(body.ratio)) {
    return NextResponse.json(
      { ok: false, error: "Choose a supported output ratio before exporting." },
      { status: 400 },
    );
  }

  const ratio = body.ratio as "9:16" | "1:1" | "4:5" | "16:9";
  const source = cleanChoice(body.source, videoSources, "draft");
  const trimStartSeconds = cleanSeconds(body.draft?.trimStartSeconds) ?? 0;
  const rawTrimEndSeconds = cleanSeconds(body.draft?.trimEndSeconds);
  const trimEndSeconds =
    rawTrimEndSeconds !== null && rawTrimEndSeconds > trimStartSeconds
      ? rawTrimEndSeconds
      : null;
  const draft = {
    trimStartSeconds,
    trimEndSeconds,
    textOverlays: cleanTextOverlays(body.draft),
  };

  if (
    draft.textOverlays.some(
      (overlay) =>
        buildEditOverlayTextLayout(overlay.text, overlay.style, ratio)
          .isTruncated,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A text layer has too many line breaks to fit safely. Shorten it before exporting.",
      },
      { status: 400 },
    );
  }

  const renderId = crypto.randomUUID();
  const persistenceEnabled = isEditRenderPersistenceConfigured();
  const renderPayload = {
    renderId,
    userId: user.uid,
    projectId,
    sourceVideoId,
    sourceVideoUrl,
    ratio,
    draft,
  };

  if (persistenceEnabled) {
    try {
      await createQueuedRenderJob({
        draft,
        durationSeconds: cleanSeconds(body.durationSeconds),
        projectId,
        ratio,
        renderId,
        source,
        sourceVideoId,
        sourceVideoUrl,
        thumbnailUrl: cleanOptionalUrl(body.thumbnailUrl),
        title: cleanText(body.title, "Untitled video", 140),
        userId: user.uid,
      });

      if (sourceAsset.source_type === "demo_upload") {
        await markDemoVideoRendering({
          demoId: sourceVideoId,
          projectId,
          renderId,
          userId: user.uid,
        });
      }
    } catch (error) {
      console.error("Failed to persist queued edited video render:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Could not prepare this video save.",
        },
        { status: 500 },
      );
    }
  } else {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Video saving requires Supabase persistence to be configured.",
      },
      { status: 501 },
    );
  }

  const missingAwsEnvVars = getAwsRenderMissingEnvVars();

  if (missingAwsEnvVars.length > 0) {
    if (sourceAsset.source_type === "demo_upload") {
      try {
        await markDemoVideoFailed({
          demoId: sourceVideoId,
          errorMessage: "Video save queue is not configured.",
          projectId,
          userId: user.uid,
        });
      } catch (persistenceError) {
        console.error("Failed to mark demo render configuration failure:", persistenceError);
      }
    }

    try {
      await markRenderJobFailed({
        errorMessage: "Video save queue is not configured.",
        projectId,
        renderId,
        sourceVideoId,
        userId: user.uid,
      });
    } catch (persistenceError) {
      console.error("Failed to persist render configuration failure:", persistenceError);
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Video saving is not configured. Add ${missingAwsEnvVars.join(
          ", ",
        )}.`,
      },
      { status: 501 },
    );
  }

  let backgroundJob;

  try {
    backgroundJob = await createBackgroundJob({
      input: renderPayload,
      jobType: AWS_RENDER_JOB_TYPE,
      projectId,
      queueName: getQueueNameForJobType(AWS_RENDER_JOB_TYPE),
      userId: user.uid,
    });

    const message = await sendJobMessage({
      jobId: backgroundJob.id,
      jobType: AWS_RENDER_JOB_TYPE,
    });
    const updatedJob = await attachAwsMessageToBackgroundJob({
      awsMessageId: message.messageId,
      jobId: backgroundJob.id,
    });

    return NextResponse.json({
      ok: true,
      backend: "aws",
      message: "Video save started.",
      renderId,
      jobId: updatedJob.id,
      sourceVideoId,
    });
  } catch (error) {
    console.error("Failed to enqueue AWS edited video render:", error);

    if (backgroundJob) {
      try {
        await markBackgroundJobFailed({
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to start video save.",
          jobId: backgroundJob.id,
        });
      } catch (persistenceError) {
        console.error("Failed to persist AWS render queue failure:", persistenceError);
      }
    }

    try {
      await markRenderJobFailed({
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to start video save.",
        projectId,
        renderId,
        sourceVideoId,
        userId: user.uid,
      });
    } catch (persistenceError) {
      console.error("Failed to persist render queue failure:", persistenceError);
    }

    if (sourceAsset.source_type === "demo_upload") {
      try {
        await markDemoVideoFailed({
          demoId: sourceVideoId,
          errorMessage:
            error instanceof Error ? error.message : "Failed to start video save.",
          projectId,
          userId: user.uid,
        });
      } catch (persistenceError) {
        console.error("Failed to persist demo render queue failure:", persistenceError);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to start saving this video.",
      },
      { status: 500 },
    );
  }
}

function getAvailableTextOverlayPosition(usedPositions: Set<string>) {
  return ["top", "middle", "bottom"].find(
    (position) => !usedPositions.has(position),
  );
}

function getTextOverlayPositionOrder(position: RenderTextOverlay["position"]) {
  if (position === "top") {
    return 0;
  }

  if (position === "middle") {
    return 1;
  }

  return 2;
}
