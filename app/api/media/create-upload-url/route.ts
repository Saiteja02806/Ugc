import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import {
  createUploadingMediaAsset,
  serializeMediaAsset,
} from "@/lib/media/media-storage";
import {
  createMediaUploadTarget,
  MEDIA_UPLOAD_EXPIRES_IN_SECONDS,
} from "@/lib/media/media-upload";
import { isMediaCollection } from "@/lib/media/types";
import {
  createSignedPutUrl,
  getMissingStorageEnvVars,
} from "@/lib/storage/storage";

export const runtime = "nodejs";

type CreateUploadBody = {
  collection?: unknown;
  contentType?: unknown;
  fileName?: unknown;
  fileSize?: unknown;
  projectId?: unknown;
  title?: unknown;
};

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as CreateUploadBody | null;

    if (!body || !isMediaCollection(body.collection)) {
      return Response.json(
        { ok: false, error: "Choose Influencers, Videos, or Images before uploading." },
        { status: 400 },
      );
    }

    const missingStorage = getMissingStorageEnvVars();

    if (missingStorage.length > 0) {
      throw new Error(`Media upload is not configured: ${missingStorage.join(", ")}`);
    }

    const target = createMediaUploadTarget({
      collection: body.collection,
      contentType: typeof body.contentType === "string" ? body.contentType : "",
      fileName: typeof body.fileName === "string" ? body.fileName : "",
      fileSize: typeof body.fileSize === "number" ? body.fileSize : Number.NaN,
      title: typeof body.title === "string" ? body.title : undefined,
      userId: user.uid,
    });

    if (!target.ok) {
      return Response.json(
        { ok: false, error: target.error },
        { status: target.status },
      );
    }

    const uploadUrl = await createSignedPutUrl({
      contentType: target.target.contentType,
      expiresInSeconds: MEDIA_UPLOAD_EXPIRES_IN_SECONDS,
      key: target.target.key,
    });
    const row = await createUploadingMediaAsset({
      assetId: target.target.assetId,
      collection: target.target.collection,
      fileName: target.target.fileName,
      fileSizeBytes: target.target.fileSize,
      mimeType: target.target.contentType,
      projectId: typeof body.projectId === "string" ? body.projectId.trim().slice(0, 96) || null : null,
      sourceType: target.target.collection === "influencer" ? "influencer_upload" : "upload",
      storageKey: target.target.key,
      title: target.target.title,
      url: target.target.publicUrl,
      userId: user.uid,
    });

    return Response.json({
      ok: true,
      asset: serializeMediaAsset(row),
      assetId: row.id,
      expiresInSeconds: MEDIA_UPLOAD_EXPIRES_IN_SECONDS,
      key: row.storage_key,
      requiredHeaders: { "Content-Type": row.mime_type },
      uploadUrl,
    });
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

    if (status >= 500) {
      console.error("Could not prepare media upload:", error);
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof FirebaseAuthRequestError
            ? error.message
            : "Could not prepare this media upload.",
      },
      { status },
    );
  }
}
