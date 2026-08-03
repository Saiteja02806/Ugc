import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getCreativeAssetGroupForOwner } from "@/lib/media/creative-asset-groups";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import {
  clearTrendingVideoSourceSelection,
  getTrendingVideoSourceSelection,
  isTrendingSourceVideoRow,
  isTrendingVideoSelectionKind,
  isTrendingVideoSourceFormat,
  saveTrendingVideoSourceSelection,
} from "@/lib/trending/video-source-selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SaveSelectionBody = {
  format?: unknown;
  groupId?: unknown;
  mediaAssetId?: unknown;
  selectionKind?: unknown;
};

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const format = new URL(request.url).searchParams.get("format");

    if (!isTrendingVideoSourceFormat(format)) {
      return json({ error: "Choose Hook video or Wall of text.", ok: false }, 400);
    }

    const selection = await getTrendingVideoSourceSelection({
      format,
      userId: user.uid,
    });

    return json({ ok: true, selection });
  } catch (error) {
    return selectionErrorResponse(error, "Could not load the video source.");
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as
      | SaveSelectionBody
      | null;

    if (
      !body ||
      !isTrendingVideoSourceFormat(body.format) ||
      !isTrendingVideoSelectionKind(body.selectionKind)
    ) {
      return json({ error: "Choose a valid video source.", ok: false }, 400);
    }

    if (body.selectionKind === "group") {
      const groupId = parseUuid(body.groupId);

      if (!groupId) {
        return json({ error: "Choose a valid video group.", ok: false }, 400);
      }

      const group = await getCreativeAssetGroupForOwner({
        groupId,
        userId: user.uid,
      });

      if (!group || group.mediaType !== "video") {
        return json({ error: "This video group is not available.", ok: false }, 404);
      }

      const selection = await saveTrendingVideoSourceSelection({
        format: body.format,
        groupId,
        selectionKind: "group",
        userId: user.uid,
      });

      return json({ ok: true, selection });
    }

    const mediaAssetId = parseUuid(body.mediaAssetId);

    if (!mediaAssetId) {
      return json({ error: "Choose a valid video.", ok: false }, 400);
    }

    const asset = await getMediaAssetForOwner({
      assetId: mediaAssetId,
      userId: user.uid,
    });

    if (!asset || !isTrendingSourceVideoRow(asset)) {
      return json(
        { error: "This Creative Assets video is not available.", ok: false },
        404,
      );
    }

    const selection = await saveTrendingVideoSourceSelection({
      format: body.format,
      mediaAssetId,
      selectionKind: "asset",
      userId: user.uid,
    });

    return json({ ok: true, selection });
  } catch (error) {
    return selectionErrorResponse(error, "Could not save the video source.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const format = new URL(request.url).searchParams.get("format");

    if (!isTrendingVideoSourceFormat(format)) {
      return json({ error: "Choose Hook video or Wall of text.", ok: false }, 400);
    }

    await clearTrendingVideoSourceSelection({
      format,
      userId: user.uid,
    });

    return json({ ok: true, selection: null });
  } catch (error) {
    return selectionErrorResponse(error, "Could not clear the video source.");
  }
}

function parseUuid(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const id = value.trim();
  return UUID_PATTERN.test(id) ? id : null;
}

function selectionErrorResponse(error: unknown, fallback: string) {
  const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

  if (status >= 500) {
    console.error(fallback, error);
  }

  return json(
    {
      error:
        error instanceof FirebaseAuthRequestError ? error.message : fallback,
      ok: false,
    },
    status,
  );
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
