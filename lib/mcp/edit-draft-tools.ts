import "server-only";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { EditDraftError, editDraftInput, editDraftRevision } from "@/lib/edit/draft-contract";
import { openEditDraftForOwner } from "@/lib/edit/open-draft";
import { normalizeEditableVideoDraftInput } from "@/lib/edit/video-library";
import { getSavedEditDraftForOwner, listSavedEditDraftsForOwner, updateSavedEditDraftForOwner, type SavedEditDraftRow } from "@/lib/edit/saved-drafts";
import { getMediaAssetForOwner, serializeMediaAsset } from "@/lib/media/media-storage";
import { isEditableMediaAsset } from "@/lib/media/editable-video";
import { decodeAssetCursor, encodeAssetCursor } from "./asset-cursor";
import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";

export const registeredEditDraftMcpTools = ["list_edit_drafts", "get_edit_draft", "update_edit_draft", "open_edit_draft"] as const;
const summarySchema = z.strictObject({ draft_id: z.uuid(), project_id: z.string(), title: z.string(),
  source: z.enum(["hook", "demo", "draft", "final"]), status: z.enum(["ready", "draft", "rendering", "rendered", "failed"]),
  ratio: z.enum(["9:16", "1:1", "4:5", "16:9"]), duration_seconds: z.number().nonnegative().nullable(),
  has_draft: z.boolean(), revision: editDraftRevision, created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }) });
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
function summary(row: SavedEditDraftRow) { return summarySchema.parse({ draft_id: row.id, project_id: row.project_id,
  title: row.title, source: row.source, status: row.status, ratio: row.ratio, duration_seconds: row.duration_seconds,
  has_draft: row.draft_json !== null, revision: row.draft_revision, created_at: row.created_at, updated_at: row.updated_at }); }
async function errors<T>(run: () => Promise<T>) {
  try { return await run(); } catch (error) {
    if (error instanceof EditDraftError) throw new ToolFailure(error.code, error.message, error.status >= 500);
    if (error instanceof ToolFailure) throw error;
    throw new ToolFailure("DRAFTS_UNAVAILABLE", "Saved Edit drafts are temporarily unavailable.", true);
  }
}
export function registerEditDraftMcpTools(server: McpServer) {
  server.registerTool("open_edit_draft", {
    description: "Open or create the application's Edit-page draft for one ready owned raw video/influencer asset. Resolve the asset through list_assets/get_asset first. Reopening or retrying the same asset returns its current saved draft, preserving text, trims, revision and render history. Source metadata initializes new drafts only. No video is generated/rendered, no credits are spent, and Explore compositions/slideshows are separate.",
    inputSchema: z.strictObject({ asset_id: z.uuid() }),
    outputSchema: z.strictObject({ draft: summarySchema, content: editDraftInput.nullable(), source_asset_id: z.uuid(), reused: z.boolean() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scopeChallenge: requireScopes("creative:write"), _meta: oauthMetadata("creative:write"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "creative:write");
    return errors(async () => {
      const opened = await openEditDraftForOwner(userId, args.asset_id);
      return { draft: summary(opened.video), content: normalizeEditableVideoDraftInput(opened.video.draft_json),
        source_asset_id: args.asset_id, reused: opened.reused };
    });
  }));
  server.registerTool("list_edit_drafts", {
    description: "List the connected account's existing Edit-page projects and saved drafts, including website edits. Explore compositions and slideshows use separate draft systems. No render is submitted.",
    inputSchema: z.strictObject({ project_id: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/).optional(),
      limit: z.number().int().min(1).max(50).default(20), cursor: z.string().min(1).max(2500).optional() }),
    outputSchema: z.strictObject({ items: z.array(summarySchema), next_cursor: z.string().nullable() }),
    annotations: readOnly, scopeChallenge: requireScopes("assets:read"), _meta: oauthMetadata("assets:read"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:read");
    return errors(async () => {
      const cursor = args.cursor ? decodeAssetCursor(args.cursor) : null;
      if (args.cursor && (!cursor || cursor.user_id !== userId || cursor.collection !== "edit-draft" ||
          cursor.source_type !== (args.project_id ?? null) || cursor.query !== null))
        throw new ToolFailure("INVALID_CURSOR", "The draft cursor does not match this account and project.");
      const rows = await listSavedEditDraftsForOwner({ userId, projectId: args.project_id, limit: args.limit,
        after: cursor ? { createdAt: cursor.updated_at, id: cursor.id } : undefined });
      const page = rows.slice(0, args.limit), last = page.at(-1);
      return { items: page.map(summary), next_cursor: rows.length > args.limit && last ? encodeAssetCursor({ v: 1,
        user_id: userId, collection: "edit-draft", source_type: args.project_id ?? null, query: null, updated_at: last.created_at, id: last.id }) : null };
    });
  }));
  server.registerTool("get_edit_draft", {
    description: "Read the exact saved Edit-page trim/text draft and its revision. Returns a ready owned source asset ID for get_asset when available; no private URLs or storage/provider details. Does not render.",
    inputSchema: z.strictObject({ draft_id: z.uuid() }),
    outputSchema: z.strictObject({ draft: summarySchema, content: editDraftInput.nullable(), source_asset_id: z.uuid().nullable(), can_edit: z.boolean() }),
    annotations: readOnly, scopeChallenge: requireScopes("assets:read"), _meta: oauthMetadata("assets:read"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:read");
    return errors(async () => {
      const row = await getSavedEditDraftForOwner(userId, args.draft_id);
      const asset = z.uuid().safeParse(row.source_video_id).success ? await getMediaAssetForOwner({ userId, assetId: row.source_video_id }) : null;
      const ready = !!asset && asset.status === "ready" && asset.deleted_at === null && isEditableMediaAsset(serializeMediaAsset(asset));
      return { draft: summary(row), content: normalizeEditableVideoDraftInput(row.draft_json), source_asset_id: ready ? asset!.id : null, can_edit: ready };
    });
  }));
  server.registerTool("update_edit_draft", {
    description: "Save trim and up to three text overlays to the SAME draft used by the Edit page. Blank text is allowed. Read its revision first; save a stable request UUID and reuse every input after a lost response. A conflict requires rereading and explicitly reconciling edits. Saving does not generate/export media or spend credits. The response is the accepted snapshot; reread before making later edits after recovery.",
    inputSchema: z.strictObject({ draft_id: z.uuid(), request_id: z.uuid(), expected_revision: editDraftRevision, content: editDraftInput }),
    outputSchema: z.strictObject({ draft: summarySchema, content: editDraftInput, request_id: z.uuid(), replayed: z.boolean() }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    scopeChallenge: requireScopes("creative:write"), _meta: oauthMetadata("creative:write"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "creative:write");
    return errors(async () => {
      const receipt = await updateSavedEditDraftForOwner({ userId, draftId: args.draft_id, requestId: args.request_id,
        expectedRevision: args.expected_revision, draft: args.content });
      return { draft: summary(receipt.video), content: editDraftInput.parse(receipt.video.draft_json), request_id: args.request_id, replayed: receipt.replayed };
    });
  }));
}
