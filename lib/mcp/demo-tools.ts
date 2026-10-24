import "server-only";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { findDemoVideo, type DemoVideoRow } from "@/lib/demo/demo-storage";
import { deleteDemoForOwner, DemoLibraryError, listDemosForOwner, registerDemoForOwner } from "@/lib/demo/demo-library";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { decodeAssetCursor, encodeAssetCursor } from "./asset-cursor";
import { confirmableOutputSchema, confirmedToolDescription, requireConfirmation, withConfirmToken } from "./confirm-token";
import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";

const projectId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/).default("test-project-001");
const demoSummary = z.strictObject({
  demo_id: z.uuid(), project_id: z.string(), title: z.string(),
  status: z.enum(["uploading", "processing", "ready", "draft", "rendering", "rendered", "failed"]),
  duration_seconds: z.number().positive().nullable(), width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(), created_at: z.string(), updated_at: z.string(),
});
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
export const registeredDemoMcpTools = ["register_demo", "list_demos", "get_demo", "delete_demo"] as const;

async function withDemoErrors<T>(run: () => Promise<T>) {
  try { return await run(); } catch (error) {
    if (error instanceof DemoLibraryError) throw new ToolFailure(error.code, error.message, error.code === "DEMOS_UNAVAILABLE");
    if (error instanceof ToolFailure) throw error;
    throw new ToolFailure("DEMOS_UNAVAILABLE", "The Demo library is temporarily unavailable.", true);
  }
}
function summary(row: DemoVideoRow) {
  return demoSummary.parse({ demo_id: row.id, project_id: row.project_id, title: row.title, status: row.status,
    duration_seconds: row.duration_seconds, width: row.width, height: row.height,
    created_at: row.created_at, updated_at: row.updated_at });
}

export function registerDemoMcpTools(server: McpServer) {
  server.registerTool("register_demo", {
    description: "Register a confirmed create_upload/confirm_upload video in the application's dedicated Demo library. Requires 1–60 seconds and at most 100 MB. Keeps the same asset ID for attaching it to hooks. Replay preserves website edits; no new upload or render is submitted.",
    inputSchema: z.strictObject({ asset_id: z.uuid(), project_id: projectId }),
    outputSchema: z.strictObject({ demo_id: z.uuid(), asset_id: z.uuid(), project_id: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    scopeChallenge: requireScopes("assets:write"), _meta: oauthMetadata("assets:write"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:write");
    return withDemoErrors(() => registerDemoForOwner({ userId, assetId: args.asset_id, projectId: args.project_id }));
  }));

  server.registerTool("list_demos", {
    description: "Browse the connected account's dedicated Demo library, including website demos and unfinished uploads. Use get_demo to check whether a demo has a ready asset for composition.",
    inputSchema: z.strictObject({ project_id: projectId, limit: z.number().int().min(1).max(50).default(20), cursor: z.string().min(1).max(2048).optional() }),
    outputSchema: z.strictObject({ items: z.array(demoSummary), next_cursor: z.string().nullable() }),
    annotations: readOnly, scopeChallenge: requireScopes("assets:read"), _meta: oauthMetadata("assets:read"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:read");
    const expected = { user_id: userId, collection: "demo", source_type: args.project_id, query: null };
    const cursor = args.cursor ? decodeAssetCursor(args.cursor) : null;
    if (args.cursor && (!cursor || Object.entries(expected).some(([key, value]) => cursor[key as keyof typeof expected] !== value))) {
      throw new ToolFailure("INVALID_CURSOR", "The Demo cursor is invalid for this account or project.");
    }
    const rows = await withDemoErrors(() => listDemosForOwner({ userId, projectId: args.project_id, limit: args.limit,
      after: cursor ? { updatedAt: cursor.updated_at, id: cursor.id } : undefined }));
    const page = rows.slice(0, args.limit), last = page.at(-1);
    return { items: page.map(summary), next_cursor: rows.length > args.limit && last
      ? encodeAssetCursor({ v: 1, ...expected, updated_at: last.updated_at, id: last.id }) : null };
  }));

  server.registerTool("get_demo", {
    description: "Get an owned Demo record and its ready source asset ID, when available. Retrieve playable media through get_asset. Does not expose raw storage keys or draft internals.",
    inputSchema: z.strictObject({ demo_id: z.uuid(), project_id: projectId }),
    outputSchema: z.strictObject({ demo: demoSummary, asset_id: z.uuid().nullable() }),
    annotations: readOnly, scopeChallenge: requireScopes("assets:read"), _meta: oauthMetadata("assets:read"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:read");
    return withDemoErrors(async () => {
      const row = await findDemoVideo({ userId, demoId: args.demo_id, projectId: args.project_id });
      if (!row) throw new ToolFailure("NOT_FOUND", "Demo not found.");
      const asset = await getMediaAssetForOwner({ userId, assetId: args.demo_id });
      const usable = asset?.status === "ready" && asset.collection === "video" && asset.source_type === "demo_upload"
        && asset.project_id === row.project_id && asset.source_record_id === row.id && asset.storage_key === row.source_s3_key;
      return { demo: summary(row), asset_id: usable ? asset.id : null };
    });
  }));

  server.registerTool("delete_demo", {
    description: confirmedToolDescription("Remove an owned Demo and its linked source asset from the active libraries together. Retains stored bytes for existing renders. Repeating deletion is safe; does not cancel jobs or erase finished outputs."),
    inputSchema: withConfirmToken(z.strictObject({ demo_id: z.uuid(), project_id: projectId })),
    outputSchema: confirmableOutputSchema(z.strictObject({ demo_id: z.uuid(), deleted: z.literal(true) })),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: true },
    scopeChallenge: requireScopes("assets:write"), _meta: oauthMetadata("assets:write"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:write");
    return requireConfirmation({
      tool: "delete_demo", accountId: userId, args, effect: "delete",
      summary: "Remove the selected Demo and its linked source from the active libraries. Existing renders keep their stored bytes.",
      creditCost: 0, creditCostIsEstimate: false,
      affected: [{ type: "demo", id: args.demo_id, label: "Dedicated Demo" }],
      run: async () => {
        await withDemoErrors(() => deleteDemoForOwner({ userId, demoId: args.demo_id, projectId: args.project_id }));
        return { demo_id: args.demo_id, deleted: true };
      },
    });
  }));
}
