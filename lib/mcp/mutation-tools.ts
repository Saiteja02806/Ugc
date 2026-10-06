import "server-only";
import { assertPrivateMediaWritesDisabled, privateMediaHead } from "@/lib/media/private-media-storage";
import { isPrivateUserMedia } from "@/lib/media/media-delivery";

import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getMediaAssetForOwner, markMediaAssetReady, softDeleteMediaAsset, type MediaAssetRow } from "@/lib/media/media-storage";
import { MEDIA_UPLOAD_EXPIRES_IN_SECONDS } from "@/lib/media/media-upload";
import { createSignedPutUrl, headStorageObject } from "@/lib/storage/storage";
import { asset, executeTool, MCP_MEDIA_COLLECTIONS, oauthMetadata, principal, toAsset, ToolFailure } from "./read-tools";
import {
  assertMcpUploadConfirmable,
  isMcpUpload, prepareMcpUploadTarget, UploadValidationError, validateMcpUploadConfirmation,
} from "./upload-validation";
import {
  cleanupDeletedMcpUploadsForAccount, createMcpUploadingMediaAsset,
  McpUploadQuotaError, sealDeletedMcpUpload, softDeleteUnconfirmedMcpUpload,
} from "./upload-store";

const httpsUrl = z.url().regex(/^https:\/\//i);
const uploadCollection = z.enum(MCP_MEDIA_COLLECTIONS).describe(
  "Asset group: image for still images, video for videos, or influencer for creator footage.",
);

export const registeredMutationMcpTools = ["create_upload", "confirm_upload", "delete_asset"] as const;

function asToolFailure(error: unknown): never {
  if (error instanceof UploadValidationError) {
    throw new ToolFailure(error.code, error.message, error.code === "UPLOAD_NOT_READY");
  }
  if (error instanceof McpUploadQuotaError) {
    throw new ToolFailure("UPLOAD_QUOTA_EXCEEDED", error.message);
  }
  throw error;
}

function responseAsset(row: MediaAssetRow) {
  const result = toAsset(row);
  if (!asset.safeParse(result).success) {
    throw new ToolFailure("INTERNAL_ERROR", "The asset metadata is incomplete.", true);
  }
  return result;
}

function assertHttpsUrl(value: string) {
  if (!httpsUrl.safeParse(value).success) {
    throw new ToolFailure("STORAGE_UNAVAILABLE", "The upload destination is unavailable.", true);
  }
  return value;
}

export function registerMutationMcpTools(server: McpServer) {
  server.registerTool("create_upload", {
    description: "Reserve one media asset and return a temporary URL for directly uploading its bytes.",
    inputSchema: z.strictObject({
      collection: uploadCollection,
      file_name: z.string().trim().min(1).max(255).regex(/^[^/\\\0]+$/).describe("The display file name. Folder paths are not allowed."),
      mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"]).describe("Actual MIME type of the bytes that will be uploaded."),
      file_size_bytes: z.number().int().positive().describe("Exact upload size in bytes. Images allow up to 25 MB; videos up to 250 MB."),
      title: z.string().trim().min(1).max(140).optional().describe("Optional title shown in the creative library."),
    }),
    outputSchema: z.strictObject({
      upload_id: z.uuid(),
      upload_url: httpsUrl,
      expires_at: z.iso.datetime(),
      required_headers: z.strictObject({
        "Content-Type": z.string(),
        "x-goog-content-length-range": z.string(),
        "x-goog-if-generation-match": z.literal("0"),
      }),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    scopeChallenge: requireScopes("assets:write"),
    _meta: oauthMetadata("assets:write"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:write");
    assertPrivateMediaWritesDisabled();
    await cleanupDeletedMcpUploadsForAccount(userId);
    let target: ReturnType<typeof prepareMcpUploadTarget>;
    try {
      target = prepareMcpUploadTarget({
        collection: args.collection, fileName: args.file_name, fileSizeBytes: args.file_size_bytes,
        mimeType: args.mime_type, title: args.title, userId,
      });
    } catch (error) { asToolFailure(error); }

    const expiresAt = new Date(Date.now() + MEDIA_UPLOAD_EXPIRES_IN_SECONDS * 1000).toISOString();
    let uploadUrl: string;
    try {
      uploadUrl = assertHttpsUrl(await createSignedPutUrl({
        contentType: target.contentType,
        expiresInSeconds: MEDIA_UPLOAD_EXPIRES_IN_SECONDS,
        key: target.key,
        maxBytes: target.fileSize,
        createOnly: true,
      }));
      assertHttpsUrl(target.publicUrl);
    } catch {
      throw new ToolFailure("STORAGE_UNAVAILABLE", "The upload destination is unavailable.", true);
    }
    let row: MediaAssetRow;
    try {
      row = await createMcpUploadingMediaAsset({
        assetId: target.assetId,
        collection: target.collection,
        fileName: target.fileName,
        fileSizeBytes: target.fileSize,
        mimeType: target.contentType,
        sourceType: target.collection === "influencer" ? "influencer_upload" : "upload",
        storageKey: target.key,
        title: target.title,
        url: target.publicUrl,
        userId,
      });
    } catch (error) {
      asToolFailure(error);
    }
    return {
      upload_id: row.id, upload_url: uploadUrl, expires_at: expiresAt,
      required_headers: {
        "Content-Type": target.contentType,
        "x-goog-content-length-range": `1,${target.fileSize}`,
        "x-goog-if-generation-match": "0" as const,
      },
    };
  }));

  server.registerTool("confirm_upload", {
    description: "Verify an owned temporary upload in storage and make its asset ready.",
    inputSchema: z.strictObject({
      upload_id: z.uuid().describe("ID returned as upload_id by create_upload."),
      width: z.number().int().positive().describe("Width of the uploaded media in pixels."),
      height: z.number().int().positive().describe("Height of the uploaded media in pixels."),
      duration_seconds: z.number().positive().optional().describe("Required duration in seconds for video uploads; omit for images."),
    }),
    outputSchema: z.strictObject({ asset }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    scopeChallenge: requireScopes("assets:write"),
    _meta: oauthMetadata("assets:write"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:write");
    const current = await getMediaAssetForOwner({ assetId: args.upload_id, userId });
    if (!current) throw new ToolFailure("NOT_FOUND", "Upload not found.");
    try { assertMcpUploadConfirmable(current); } catch (error) { asToolFailure(error); }

    let object;
    try {
      object = isPrivateUserMedia(current) ? await privateMediaHead(current.storage_key)
        : await headStorageObject({ key: current.storage_key });
    } catch (error) {
      if (error instanceof Error && (error.name === "NoSuchKey" || (error as Error & { code?: string }).code === "NoSuchKey")) {
        throw new ToolFailure("UPLOAD_NOT_READY", "The uploaded file is not available yet.", true);
      }
      throw new ToolFailure("STORAGE_UNAVAILABLE", "Could not verify the uploaded file.", true);
    }

    let checked: ReturnType<typeof validateMcpUploadConfirmation>;
    try {
      checked = validateMcpUploadConfirmation({
        asset: current, object,
        input: { width: args.width, height: args.height, durationSeconds: args.duration_seconds },
      });
    } catch (error) { asToolFailure(error); }
    if (checked.alreadyReady) return { asset: responseAsset(current) };

    const ready = await markMediaAssetReady({
      assetId: current.id,
      durationSeconds: checked.durationSeconds,
      expectedStatus: "uploading",
      height: args.height,
      ratio: checked.ratio,
      userId,
      width: args.width,
    });
    if (ready) return { asset: responseAsset(ready) };

    const latest = await getMediaAssetForOwner({ assetId: current.id, userId });
    if (!latest) throw new ToolFailure("NOT_FOUND", "Upload not found.");
    try {
      const result = validateMcpUploadConfirmation({
        asset: latest, object,
        input: { width: args.width, height: args.height, durationSeconds: args.duration_seconds },
      });
      if (!result.alreadyReady) throw new UploadValidationError("UPLOAD_NOT_READY", "The upload is still being confirmed.");
    } catch (error) { asToolFailure(error); }
    return { asset: responseAsset(latest) };
  }));

  server.registerTool("delete_asset", {
    description: "Delete one owned media asset. Unconfirmed MCP uploads are removed from storage; ready assets remain soft-deleted.",
    inputSchema: z.strictObject({ asset_id: z.uuid() }),
    outputSchema: z.strictObject({ asset_id: z.uuid(), deleted: z.literal(true) }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    scopeChallenge: requireScopes("assets:write"),
    _meta: oauthMetadata("assets:write"),
  }, async ({ asset_id }, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:write");
    const current = await getMediaAssetForOwner({ assetId: asset_id, userId });
    if (!current) throw new ToolFailure("NOT_FOUND", "Asset not found.");
    if (current.status === "uploading" && isMcpUpload(current)) {
      const pending = await softDeleteUnconfirmedMcpUpload({ assetId: asset_id, userId });
      if (pending) {
        try {
          await sealDeletedMcpUpload(pending);
        } catch {
          // The row stays counted in the quota and the next upload retries
          // storage cleanup after the signed URL's validity window.
          console.error("MCP deleted upload storage sealing will retry", { assetId: asset_id });
        }
        return { asset_id, deleted: true };
      }
    }
    const deleted = await softDeleteMediaAsset({ assetId: asset_id, userId });
    if (!deleted) throw new ToolFailure("NOT_FOUND", "Asset not found.");
    return { asset_id, deleted: true };
  }));
}
