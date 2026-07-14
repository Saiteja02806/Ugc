import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import {
  listMediaAssets,
  serializeMediaAsset,
} from "@/lib/media/media-storage";
import {
  isMediaCollection,
  isMediaSourceType,
  type MediaSourceType,
} from "@/lib/media/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const searchParams = new URL(request.url).searchParams;
    const rawCollection = searchParams.get("collection");
    const collection = isMediaCollection(rawCollection) ? rawCollection : null;
    const rawSourceTypes = searchParams.get("sourceTypes");
    const sourceTypes = parseSourceTypes(rawSourceTypes);

    if (rawCollection && !collection) {
      return Response.json(
        { ok: false, error: "Unknown media collection." },
        { status: 400 },
      );
    }

    if (rawSourceTypes && sourceTypes === null) {
      return Response.json(
        { ok: false, error: "Unknown media source type." },
        { status: 400 },
      );
    }

    const rows = await listMediaAssets({
      collection,
      sourceTypes,
      userId: user.uid,
    });

    return Response.json(
      {
        ok: true,
        assets: rows.map(serializeMediaAsset),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return mediaErrorResponse(error, "Could not load your media.");
  }
}

function parseSourceTypes(value: string | null): MediaSourceType[] | null {
  if (!value) {
    return null;
  }

  const sourceTypes = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (sourceTypes.length === 0) {
    return null;
  }

  if (!sourceTypes.every(isMediaSourceType)) {
    return null;
  }

  return Array.from(new Set(sourceTypes));
}

function mediaErrorResponse(error: unknown, fallback: string) {
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
