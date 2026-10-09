import "server-only";

import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { createSignedDownloadUrl, headStorageObject } from "@/lib/storage/storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function handleVideoDownload(request: Request, assetId: string) {
  try {
    const user = await requireFirebaseUser(request);
    if (!UUID.test(assetId)) return unavailable();
    const asset = await getMediaAssetForOwner({ assetId, userId: user.uid });
    if (!asset || asset.user_id !== user.uid || asset.deleted_at !== null ||
      asset.status !== "ready" || asset.collection !== "video") return unavailable();

    // Sign only the saved object in the app's media bucket, never a client URL/key.
    const key = asset.storage_key;
    if (!key || key !== key.trim() || /[:\\\u0000-\u001f]/.test(key) ||
      key.split("/").some(part => !part || part === "." || part === "..") ||
      isPrivateMedia(asset.metadata)) return unavailable();

    // Report missing objects in the workflow before handing a URL to the browser.
    await headStorageObject({ key });
    const extension = asset.mime_type === "video/webm" ? "webm"
      : asset.mime_type === "video/quicktime" ? "mov"
      : key.match(/\.(mp4|mov|webm)$/i)?.[1]?.toLowerCase() ?? "mp4";
    const baseName = (asset.title || asset.file_name || "Generated video")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .toLowerCase();
    const fileName = `${baseName || "generated-video"}.${extension}`;
    const url = await createSignedDownloadUrl({ key, fileName, expiresInSeconds: 300 });
    return Response.json({ ok: true, url, fileName }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status, headers: NO_STORE });
    }
    if (isMissingObject(error)) return unavailable();
    console.error("Could not prepare video download.");
    return Response.json({ ok: false, error: "Could not prepare your download. Please try again." },
      { status: 503, headers: NO_STORE });
  }
}

function unavailable() {
  return Response.json({ ok: false, error: "This video is no longer available to download." },
    { status: 404, headers: NO_STORE });
}

function isPrivateMedia(metadata: unknown) {
  return Boolean(metadata && typeof metadata === "object" && "storageLocation" in metadata &&
    metadata.storageLocation === "private_user_media");
}

function isMissingObject(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error &&
    (error.code === "NoSuchKey" || Number(error.code) === 404));
}
