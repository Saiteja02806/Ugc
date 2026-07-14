import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import {
  listMediaAssets,
  serializeMediaAsset,
} from "@/lib/media/media-storage";
import { isMediaCollection } from "@/lib/media/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const rawCollection = new URL(request.url).searchParams.get("collection");
    const collection = isMediaCollection(rawCollection) ? rawCollection : null;

    if (rawCollection && !collection) {
      return Response.json(
        { ok: false, error: "Unknown media collection." },
        { status: 400 },
      );
    }

    const rows = await listMediaAssets({
      collection,
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
