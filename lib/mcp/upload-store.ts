import "server-only";

import type { CreateUploadingMediaAssetInput, MediaAssetRow } from "@/lib/media/media-storage";
import { MEDIA_UPLOAD_EXPIRES_IN_SECONDS } from "@/lib/media/media-upload";
import { deleteStorageObject, uploadBufferToStorage } from "@/lib/storage/storage";
import { getMcpStore } from "./store";
import { isPrivateUserMedia } from "@/lib/media/media-delivery";

// These limits apply only to MCP reservations awaiting confirmation. A
// confirmed asset is retained under the existing media-library policy.
export const MCP_MAX_UNCONFIRMED_UPLOADS = 5;
export const MCP_MAX_UNCONFIRMED_UPLOAD_BYTES = 500 * 1024 * 1024;
const MCP_DELETED_UPLOAD_CLEANUP_GRACE_SECONDS = MEDIA_UPLOAD_EXPIRES_IN_SECONDS + 60;
const MCP_UPLOAD_TOMBSTONE = Buffer.from([0]);

export class McpUploadQuotaError extends Error {}

/** Occupy the object key so a still-valid create-only signed URL cannot refill it. */
export async function sealDeletedMcpUpload(asset: MediaAssetRow) {
  // No private cleanup is approved in this rollout. Fail before ANY object write.
  if (isPrivateUserMedia(asset)) throw new Error("Private MCP cleanup is disabled pending rollout approval.");
  await uploadBufferToStorage({
    key: asset.storage_key,
    buffer: MCP_UPLOAD_TOMBSTONE,
    contentType: "application/octet-stream",
    cacheControl: "no-store",
  });
}

export async function softDeleteUnconfirmedMcpUpload(params: { assetId: string; userId: string }) {
  const now = new Date().toISOString();
  const { data, error } = await getMcpStore()
    .from("media_assets")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", params.assetId)
    .eq("user_id", params.userId)
    .eq("status", "uploading")
    .contains("metadata", { mcpUpload: true })
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new Error("Could not delete MCP upload.");
  return data as MediaAssetRow | null;
}

/** Cleanup is only for owner-deleted uploads, never active pending confirmations. */
export async function cleanupDeletedMcpUploadsForAccount(userId: string) {
  const claimToken = crypto.randomUUID();
  const cutoff = new Date(Date.now() - MCP_DELETED_UPLOAD_CLEANUP_GRACE_SECONDS * 1000).toISOString();
  const { data, error } = await getMcpStore().rpc("mcp_claim_deleted_upload_cleanup", {
    p_user_id: userId,
    p_claim_token: claimToken,
    p_deleted_before: cutoff,
    p_limit: MCP_MAX_UNCONFIRMED_UPLOADS,
  });
  if (error) throw new Error("Could not check deleted MCP uploads for cleanup.");
  if (!Array.isArray(data)) throw new Error("Deleted MCP upload cleanup returned invalid data.");

  for (const asset of data as MediaAssetRow[]) {
    try {
      await sealDeletedMcpUpload(asset);
      await deleteStorageObject({ key: asset.storage_key });
      const finished = await getMcpStore().rpc("mcp_finish_deleted_upload_cleanup", {
        p_user_id: userId,
        p_asset_id: asset.id,
        p_claim_token: claimToken,
      });
      if (finished.error || finished.data !== true) {
        throw new Error("Could not record completed MCP upload cleanup.");
      }
    } catch (error) {
      console.error("MCP deleted upload cleanup will retry", {
        assetId: asset.id,
        error: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}

export async function createMcpUploadingMediaAsset(input: CreateUploadingMediaAssetInput): Promise<MediaAssetRow> {
  const { data, error } = await getMcpStore().rpc("mcp_create_upload_asset", {
    p_user_id: input.userId,
    p_asset_id: input.assetId,
    p_collection: input.collection,
    p_source_type: input.sourceType,
    p_file_name: input.fileName,
    p_file_size_bytes: input.fileSizeBytes,
    p_mime_type: input.mimeType,
    p_storage_key: input.storageKey,
    p_title: input.title,
    p_url: input.url,
    p_max_unconfirmed_count: MCP_MAX_UNCONFIRMED_UPLOADS,
    p_max_unconfirmed_bytes: MCP_MAX_UNCONFIRMED_UPLOAD_BYTES,
  });

  if (error?.message.includes("mcp_upload_quota_exceeded")) {
    throw new McpUploadQuotaError("Confirm or delete an unconfirmed upload before reserving another.");
  }
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Could not reserve MCP upload.");
  }
  return data as MediaAssetRow;
}
