import "server-only";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { headMcpUpload } from "./upload-storage";
import { decodeAssetCursor, encodeAssetCursor } from "./asset-cursor";
import { executeTool, MCP_MEDIA_COLLECTIONS, oauthMetadata, principal, ToolFailure } from "./read-tools";
import { getUploadForOwner, leaseUploadUrl, listUploadsForOwner, uploadSummary } from "./upload-recovery";

export const registeredUploadRecoveryMcpTools = ["get_upload", "list_uploads", "renew_upload"] as const;
export const uploadReservation = z.strictObject({ upload_id: z.uuid(), upload_url: z.url().regex(/^https:\/\//), expires_at: z.iso.datetime({ offset: true }),
  storage_bucket:z.string().regex(/^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$/).optional(),
  required_headers: z.strictObject({ "Content-Type": z.string(), "x-goog-content-length-range": z.string(), "x-goog-if-generation-match": z.literal("0") }) });
const summary = z.strictObject({ upload_id: z.uuid(), request_id: z.uuid().nullable(), collection: z.enum(MCP_MEDIA_COLLECTIONS),
  status: z.enum(["uploading", "ready", "processing", "failed"]), file_name: z.string().nullable(),
  mime_type: z.string().nullable(), file_size_bytes: z.number().int().positive().nullable(), title: z.string(),
  width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(),
  duration_seconds: z.number().positive().nullable(), created_at: z.string(), updated_at: z.string() });

export function registerUploadRecoveryMcpTools(server: McpServer) {
  server.registerTool("get_upload", {
    description: "Recover one owned MCP upload by saved upload ID or stable request ID. Returns metadata, not signed URLs or storage keys.",
    inputSchema: z.strictObject({ upload_id: z.uuid().optional(), request_id: z.uuid().optional() })
      .refine(value => Boolean(value.upload_id) !== Boolean(value.request_id), "Supply exactly one upload ID or request ID."),
    outputSchema: z.strictObject({ upload: summary }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    scopeChallenge: requireScopes("assets:read"), _meta: oauthMetadata("assets:read"),
  }, (args, ctx) => executeTool(async () => ({ upload: uploadSummary(await getUploadForOwner({
    userId: principal(ctx, "assets:read"), uploadId: args.upload_id, requestId: args.request_id,
  })) })));

  server.registerTool("list_uploads", {
    description: "Find owned pending MCP upload reservations, including older reservations whose response was lost. Never creates a replacement upload.",
    inputSchema: z.strictObject({ status: z.enum(["uploading", "ready", "all"]).default("uploading"),
      limit: z.number().int().min(1).max(50).default(20), cursor: z.string().max(2500).optional() }),
    outputSchema: z.strictObject({ items: z.array(summary), next_cursor: z.string().nullable() }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    scopeChallenge: requireScopes("assets:read"), _meta: oauthMetadata("assets:read"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:read");
    const cursor = args.cursor ? decodeAssetCursor(args.cursor) : null;
    if (args.cursor && (!cursor || cursor.user_id !== userId || cursor.collection !== "mcp-upload" ||
      cursor.source_type !== args.status || cursor.query !== null)) throw new ToolFailure("INVALID_CURSOR", "The upload cursor does not match this account and filter.");
    const rows = await listUploadsForOwner({ userId, status: args.status, limit: args.limit, after: cursor ?? undefined });
    const page = rows.slice(0, args.limit), last = page.at(-1);
    const next = rows.length > args.limit && last ? encodeAssetCursor({ v: 1, user_id: userId, collection: "mcp-upload",
      source_type: args.status, query: null, id: last.id, updated_at: new Date(last.updated_at).toISOString() }) : null;
    return { items: page.map(uploadSummary), next_cursor: next };
  }));

  server.registerTool("renew_upload", {
    description: "Renew the create-only PUT link for the same owned pending reservation. If bytes already exist, confirm the existing upload instead of transferring again. Renewing a link does not make the asset ready; confirm_upload verifies the stored bytes.",
    inputSchema: z.strictObject({ upload_id: z.uuid() }), outputSchema: uploadReservation,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scopeChallenge: requireScopes("assets:write"), _meta: oauthMetadata("assets:write"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:write");
    const row = await getUploadForOwner({ userId, uploadId: args.upload_id });
    if (row.status !== "uploading") throw new ToolFailure("UPLOAD_ALREADY_CONFIRMED", "Retrieve this asset instead of uploading again.");
    try {
      await headMcpUpload(row);
      throw new ToolFailure("UPLOAD_ALREADY_TRANSFERRED", "Bytes already exist. Confirm this same upload ID before attempting another transfer.");
    } catch (error) {
      if (error instanceof ToolFailure) throw error;
      if (!(error instanceof Error && (error.name === "NoSuchKey" || (error as Error & { code?: string }).code === "NoSuchKey")))
        throw new ToolFailure("STORAGE_UNAVAILABLE", "Could not determine whether this upload committed. Preserve its ID.", true);
    }
    return leaseUploadUrl(userId, row.id);
  }));
}
