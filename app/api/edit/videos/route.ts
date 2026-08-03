import {
  DEFAULT_EDIT_PROJECT_ID,
  ensureEditableVideo,
  listEditableVideosForOwner,
} from "@/lib/edit/render-storage";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMediaAssetForOwner,
  serializeMediaAsset,
} from "@/lib/media/media-storage";
import {
  getEditableVideoSource,
  isEditableMediaAsset,
} from "@/lib/media/editable-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpenEditableVideoBody = {
  sourceVideoId?: unknown;
};

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const videos = await listEditableVideosForOwner(user.uid);

    return Response.json(
      { ok: true, videos },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return editVideoErrorResponse(error, "Could not load your Edit projects.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as
      | OpenEditableVideoBody
      | null;
    const sourceVideoId =
      typeof body?.sourceVideoId === "string" ? body.sourceVideoId.trim() : "";

    if (!sourceVideoId) {
      return Response.json(
        { ok: false, error: "Choose a Creative Asset before opening Edit." },
        { status: 400 },
      );
    }

    const sourceRow = await getMediaAssetForOwner({
      assetId: sourceVideoId,
      userId: user.uid,
    });

    if (!sourceRow) {
      return Response.json(
        { ok: false, error: "The source Creative Asset was not found." },
        { status: 404 },
      );
    }

    const sourceAsset = serializeMediaAsset(sourceRow);

    if (!isEditableMediaAsset(sourceAsset)) {
      return Response.json(
        {
          ok: false,
          error: "Only raw Creative Assets videos can be edited.",
        },
        { status: 400 },
      );
    }

    if (sourceAsset.status !== "ready") {
      return Response.json(
        { ok: false, error: "This source video is not ready for editing." },
        { status: 409 },
      );
    }

    const video = await ensureEditableVideo({
      draft: sourceAsset.metadata.draft,
      durationSeconds: sourceAsset.durationSeconds,
      projectId: sourceAsset.projectId ?? DEFAULT_EDIT_PROJECT_ID,
      ratio:
        sourceAsset.ratio === "other"
          ? getClosestEditableRatio(sourceAsset.width, sourceAsset.height)
          : sourceAsset.ratio,
      source: getEditableVideoSource(sourceAsset),
      sourceVideoId: sourceAsset.id,
      sourceVideoUrl: sourceAsset.url,
      thumbnailUrl: sourceAsset.thumbnailUrl,
      title: sourceAsset.title,
      userId: user.uid,
    });

    return Response.json(
      { ok: true, video },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return editVideoErrorResponse(error, "Could not open this video in the editor.");
  }
}

function getClosestEditableRatio(width: number | null, height: number | null) {
  if (!width || !height || width <= 0 || height <= 0) {
    return "9:16" as const;
  }

  const sourceRatio = width / height;
  const supportedRatios = [
    { ratio: "9:16" as const, value: 9 / 16 },
    { ratio: "1:1" as const, value: 1 },
    { ratio: "4:5" as const, value: 4 / 5 },
    { ratio: "16:9" as const, value: 16 / 9 },
  ];

  return supportedRatios.reduce((closest, candidate) =>
    Math.abs(Math.log(sourceRatio / candidate.value)) <
    Math.abs(Math.log(sourceRatio / closest.value))
      ? candidate
      : closest,
  ).ratio;
}

function editVideoErrorResponse(error: unknown, fallback: string) {
  const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

  if (status >= 500) {
    console.error(fallback, error);
  }

  return Response.json(
    {
      ok: false,
      error:
        error instanceof FirebaseAuthRequestError ? error.message : fallback,
    },
    { status },
  );
}
