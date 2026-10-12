import "server-only";
import { z } from "zod";
import { getMediaAssetForOwner, serializeMediaAsset } from "@/lib/media/media-storage";
import { isEditableMediaAsset } from "@/lib/media/editable-video";
import { EditDraftError } from "./draft-contract";
import { normalizeEditableVideoDraftInput } from "./video-library";
import { openSavedEditDraftRecord } from "./saved-drafts";

/** Website and IDE opening share source validation and atomic create-or-reuse. */
export async function openEditDraftForOwner(userId: string, assetId: unknown) {
  if (!z.uuid().safeParse(assetId).success)
    throw new EditDraftError("INVALID_ASSET", "Choose a saved video before opening Edit.");
  const source = await getMediaAssetForOwner({ userId, assetId: assetId as string });
  if (!source || source.deleted_at !== null)
    throw new EditDraftError("NOT_FOUND", "The source video was not found.", 404);
  const display = serializeMediaAsset(source);
  if (!isEditableMediaAsset(display))
    throw new EditDraftError("UNSUPPORTED_SOURCE", "Only raw Creative Assets videos can be edited.");
  if (source.status !== "ready")
    throw new EditDraftError("SOURCE_NOT_READY", "This source video is not ready for editing.", 409);
  // Keep the website's legacy source-metadata draft initialization. Never accept it from callers.
  const initialDraft = normalizeEditableVideoDraftInput(display.metadata.draft);
  return openSavedEditDraftRecord(userId, source.id, initialDraft);
}
