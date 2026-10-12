import "server-only";
import { createHash } from "node:crypto";
import type { CreateUploadingMediaAssetInput, MediaAssetRow } from "@/lib/media/media-storage";
import { signMcpUpload } from "./upload-storage";
import { isPrivateUserMedia } from "@/lib/media/media-delivery";
import { privateMediaBucketName } from "@/lib/media/private-media-storage";
import { getMcpStore } from "./store";
import { isMcpUpload, assertMcpUploadConfirmable } from "./upload-validation";
import { ToolFailure } from "./read-tools";

function rpcFailure(message: string | undefined): never {
  const known = [
    ["mcp_upload_request_conflict", "UPLOAD_REQUEST_CONFLICT", "This request ID was already used for different upload inputs."],
    ["mcp_upload_deleted", "UPLOAD_DELETED", "This upload was deleted. Use a new request ID for a new upload."],
    ["mcp_upload_already_confirmed", "UPLOAD_ALREADY_CONFIRMED", "The upload is already confirmed. Retrieve it with get_upload or get_asset."],
    ["mcp_upload_not_found", "NOT_FOUND", "Upload not found."],
    ["mcp_upload_quota_exceeded", "UPLOAD_QUOTA_EXCEEDED", "Confirm or delete an unconfirmed upload before reserving another."],
  ];
  for (const [match, code, detail] of known) if (message?.includes(match)) throw new ToolFailure(code, detail);
  throw new ToolFailure("UPLOADS_UNAVAILABLE", "Could not access upload reservations.", true);
}

export async function reserveRecoverableUpload(input: CreateUploadingMediaAssetInput, requestId: string) {
  const fingerprint = createHash("sha256").update(JSON.stringify({
    collection: input.collection, file_name: input.fileName, file_size_bytes: input.fileSizeBytes,
    mime_type: input.mimeType, title: input.title,
  })).digest("hex");
  const { data, error } = await getMcpStore().rpc(isPrivateUserMedia({id: input.assetId, metadata: input.metadata}) ? "mcp_reserve_private_upload" : "mcp_reserve_upload", {
    p_user_id: input.userId, p_request_id: requestId, p_fingerprint: fingerprint,
    p_asset_id: input.assetId, p_collection: input.collection, p_source_type: input.sourceType,
    p_file_name: input.fileName, p_file_size_bytes: input.fileSizeBytes,
    p_mime_type: input.mimeType, p_storage_key: input.storageKey, p_title: input.title, p_url: input.url,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) rpcFailure(error?.message);
  return data as MediaAssetRow;
}

function metadata(row: MediaAssetRow) {
  return row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {};
}

export function uploadSummary(row: MediaAssetRow) {
  return { upload_id: row.id, request_id: typeof metadata(row).mcpUploadRequestKey === "string" ? metadata(row).mcpUploadRequestKey : null,
    collection: row.collection, status: row.status, file_name: row.file_name,
    mime_type: row.mime_type, file_size_bytes: row.file_size_bytes, title: row.title,
    width: row.width, height: row.height, duration_seconds: row.duration_seconds,
    created_at: row.created_at, updated_at: row.updated_at };
}

export async function getUploadForOwner(input: { userId: string; uploadId?: string; requestId?: string }) {
  let query = getMcpStore().from("media_assets").select("*").eq("user_id", input.userId)
    .eq("metadata->>mcpUpload", "true").is("deleted_at", null);
  if (input.uploadId) query = query.eq("id", input.uploadId);
  else if (input.requestId) query = query.eq("metadata->>mcpUploadRequestKey", input.requestId);
  else throw new ToolFailure("INVALID_INPUT", "Supply one upload ID or request ID.");
  const { data, error } = await query.maybeSingle();
  if (error) rpcFailure(error.message);
  if (!data || !isMcpUpload(data as MediaAssetRow)) throw new ToolFailure("NOT_FOUND", "Upload not found.");
  return data as MediaAssetRow;
}

export async function listUploadsForOwner(input: { userId: string; limit: number; status: string; after?: { id: string; updated_at: string } }) {
  let query = getMcpStore().from("media_assets").select("*").eq("user_id", input.userId)
    .eq("metadata->>mcpUpload", "true").is("deleted_at", null);
  if (input.status !== "all") query = query.eq("status", input.status);
  if (input.after) query = query.or(`updated_at.lt.${input.after.updated_at},and(updated_at.eq.${input.after.updated_at},id.lt.${input.after.id})`);
  const { data, error } = await query.order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(input.limit + 1);
  if (error || !Array.isArray(data)) rpcFailure(error?.message);
  return data as MediaAssetRow[];
}

export async function leaseUploadUrl(userId: string, uploadId: string) {
  const { data, error } = await getMcpStore().rpc("mcp_lease_upload_url", { p_user_id: userId, p_asset_id: uploadId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) rpcFailure(error?.message);
  const row = data as MediaAssetRow;
  assertMcpUploadConfirmable(row);
  if (row.id !== uploadId || row.user_id !== userId || row.status !== "uploading" || row.deleted_at !== null)
    throw new ToolFailure("NOT_FOUND", "Upload not found.");
  const expiresAt = String(metadata(row).mcpUploadUrlExpiresAt ?? "");
  const seconds = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 600) throw new ToolFailure("UPLOAD_LINK_EXPIRED", "Renew the upload link for this same upload ID.", true);
  try {
    const uploadUrl = await signMcpUpload(row, seconds);
    if (!uploadUrl.startsWith("https://")) throw new Error("Invalid destination");
    return { upload_id: row.id, upload_url: uploadUrl, expires_at: expiresAt,
      ...(isPrivateUserMedia(row) ? {storage_bucket:privateMediaBucketName()} : {}),
      required_headers: { "Content-Type": row.mime_type!, "x-goog-content-length-range": `1,${row.file_size_bytes}`, "x-goog-if-generation-match": "0" as const } };
  } catch (error) { if (error instanceof ToolFailure) throw error; throw new ToolFailure("STORAGE_UNAVAILABLE", "Could not sign this upload destination. Recover the same reservation with get_upload.", true); }
}
