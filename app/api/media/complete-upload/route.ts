import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import {
  getMediaAssetForOwner,
  markMediaAssetReady,
  serializeMediaAsset,
} from "@/lib/media/media-storage";
import { getAllowedContentTypes, getMaxUploadBytes } from "@/lib/media/media-upload";
import { isMediaRatio } from "@/lib/media/types";
import { headS3Object } from "@/lib/storage/s3";

export const runtime = "nodejs";

type CompleteUploadBody = {
  assetId?: unknown;
  durationSeconds?: unknown;
  height?: unknown;
  key?: unknown;
  ratio?: unknown;
  width?: unknown;
};

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as CompleteUploadBody | null;
    const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";
    const key = typeof body?.key === "string" ? body.key.trim().replace(/^\//, "") : "";

    if (!assetId || !key) {
      return Response.json(
        { ok: false, error: "The upload record and storage key are required." },
        { status: 400 },
      );
    }

    const asset = await getMediaAssetForOwner({ assetId, userId: user.uid });

    if (!asset) {
      return Response.json({ ok: false, error: "Media upload was not found." }, { status: 404 });
    }

    if (asset.storage_key !== key) {
      return Response.json(
        { ok: false, error: "The uploaded file does not belong to this media record." },
        { status: 409 },
      );
    }

    const object = await headS3Object({ key });
    const objectType = object.ContentType?.split(";", 1)[0]?.trim().toLowerCase() || "";
    const objectSize = object.ContentLength ?? 0;

    if (!getAllowedContentTypes(asset.collection).includes(objectType)) {
      return Response.json(
        { ok: false, error: "The uploaded file type does not match this media collection." },
        { status: 422 },
      );
    }

    if (objectType !== asset.mime_type) {
      return Response.json(
        { ok: false, error: "The uploaded file type changed during upload." },
        { status: 422 },
      );
    }

    if (objectSize <= 0 || objectSize > getMaxUploadBytes(asset.collection)) {
      return Response.json(
        { ok: false, error: "The uploaded file is empty or exceeds the size limit." },
        { status: objectSize > getMaxUploadBytes(asset.collection) ? 413 : 422 },
      );
    }

    const width = toPositiveInteger(body?.width);
    const height = toPositiveInteger(body?.height);

    if (!width || !height) {
      return Response.json(
        { ok: false, error: "Media width and height are required." },
        { status: 400 },
      );
    }

    const ratio = isMediaRatio(body?.ratio) ? body.ratio : getRatio(width, height);
    const durationSeconds =
      asset.collection === "image"
        ? null
        : typeof body?.durationSeconds === "number" &&
            Number.isFinite(body.durationSeconds) &&
            body.durationSeconds > 0
          ? body.durationSeconds
          : null;

    if (asset.collection !== "image" && durationSeconds === null) {
      return Response.json(
        { ok: false, error: "Video duration is required." },
        { status: 400 },
      );
    }

    const readyAsset = await markMediaAssetReady({
      assetId,
      durationSeconds,
      height,
      ratio,
      userId: user.uid,
      width,
    });

    return Response.json({ ok: true, asset: serializeMediaAsset(readyAsset) });
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

    if (status >= 500) {
      console.error("Could not complete media upload:", error);
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof FirebaseAuthRequestError
            ? error.message
            : "Could not verify the uploaded media.",
      },
      { status },
    );
  }
}

function toPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function getRatio(width: number, height: number) {
  const value = width / height;
  const ratios = [
    ["9:16", 9 / 16],
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["16:9", 16 / 9],
  ] as const;

  return ratios.find(([, expected]) => Math.abs(value - expected) <= 0.03)?.[0] ?? "other";
}
