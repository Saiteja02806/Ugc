import { getAvatarAsset } from "@/lib/avatars/avatar-storage";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import {
  serializeMediaAsset,
  upsertReadyMediaAsset,
} from "@/lib/media/media-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as { avatarId?: unknown } | null;
    const avatarId = typeof body?.avatarId === "string" ? body.avatarId.trim() : "";

    if (!avatarId) {
      return Response.json({ ok: false, error: "Choose an influencer first." }, { status: 400 });
    }

    const avatar = await getAvatarAsset(avatarId);

    if (avatar.status !== "ready") {
      return Response.json({ ok: false, error: "This influencer is not ready for editing." }, { status: 409 });
    }

    const asset = await upsertReadyMediaAsset({
      assetId: crypto.randomUUID(),
      collection: "influencer",
      durationSeconds: avatar.duration_seconds,
      height: avatar.height,
      metadata: { avatarAssetId: avatar.id, catalog: "ugc-pilot" },
      mimeType: getVideoMimeType(avatar.source_s3_key),
      ratio: avatar.ratio,
      sourceRecordId: avatar.id,
      sourceType: "catalog_influencer",
      storageKey: avatar.source_s3_key,
      thumbnailUrl: avatar.thumbnail_url,
      title: avatar.name,
      url: avatar.source_video_url,
      userId: user.uid,
      width: avatar.width,
    });

    return Response.json({ ok: true, asset: serializeMediaAsset(asset) });
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

    if (status >= 500) {
      console.error("Could not open catalog influencer in the editor:", error);
    }

    return Response.json(
      {
        ok: false,
        error: error instanceof FirebaseAuthRequestError ? error.message : "Could not prepare this influencer for editing.",
      },
      { status },
    );
  }
}

function getVideoMimeType(key: string) {
  const extension = key.split(".").pop()?.toLowerCase();

  if (extension === "webm") return "video/webm";
  if (extension === "mov") return "video/quicktime";
  return "video/mp4";
}
