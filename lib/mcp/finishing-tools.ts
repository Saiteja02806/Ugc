import "server-only";

import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getUserSubscription } from "@/lib/billing/subscription-db";
import { getWorkflowFinishingForOwner, startWorkflowFinishingForOwner, videoFinishingRuntime, type WorkflowFinishingResult } from "@/lib/explore/workflow-finishing-service";
import { ExploreFinishError, EXPLORE_FINISH_STYLES, MAX_DEMO_FRAMING_POINTS, parseExploreFinishDraft } from "@/worker/src/lib/explore-finishing-contract";
import { MAX_FORMAT_TEXT_OVERLAYS } from "@/worker/src/lib/explore-format-edit";
import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";

const uuid = z.uuid();
const playback = z.enum(["once", "repeat"]);
const framing = z.strictObject({
  version: z.literal(1), width: z.number().min(.01).max(1), height: z.number().min(.01).max(1),
  points: z.array(z.tuple([z.number().int().min(0).max(120_000), z.number().min(0).max(1), z.number().min(0).max(1)])).min(1).max(MAX_DEMO_FRAMING_POINTS),
});
const text = z.strictObject({
  value: z.string().min(1).max(600).describe("Exact words to render; preserve authored line breaks."),
  width: z.number().min(.4).max(.94), y: z.number().min(.03).max(.9), fontSize: z.number().min(24).max(84),
  color: z.string().regex(/^#[0-9a-f]{6}$/i), startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(),
  preset: z.enum(["bold", "snapchat-classic"]).optional(), backgroundOpacity: z.number().min(0).max(1).optional(),
});
export const videoFinishDraftSchema = z.strictObject({
  version: z.literal(1).default(1), kind: z.enum(["hook", "phone"]).default("hook"),
  sourceAssetId: uuid.describe("Owned ready opening video or creator footage; generated and uploaded clips are supported."),
  demoAssetId: uuid.nullable().default(null).describe("Owned ready demo video appended after the opening."),
  demoAudioAssetId: uuid.nullable().default(null), demoAudioPlayback: playback.default("once"),
  backgroundAssetId: uuid.nullable().default(null), backgroundPlayback: playback.default("once"),
  demoFraming: framing.optional(), sourceFraming: framing.optional(),
  editing: z.strictObject({
    version: z.literal(1), format: z.enum(["hook", "wall_text"]),
    trimStartMs: z.number().int().min(0), trimEndMs: z.number().int().max(120_000),
    originalVolume: z.number().min(0).max(1), musicVolume: z.number().min(0).max(1),
    text: text.nullable(), textOverlays: z.array(text).max(MAX_FORMAT_TEXT_OVERLAYS).optional(),
  }).optional().describe("Independent single-clip preparation. Finish it first, then compose its output with a demo."),
  subtitles: z.strictObject({ language: z.literal("en"), style: z.enum(EXPLORE_FINISH_STYLES), placement: z.enum(["bottom", "middle", "top"]).optional() }).nullable().default(null),
});

const finishOutput = z.strictObject({
  request_key: uuid, job_id: uuid.nullable(),
  outcome: z.enum(["unconfirmed", "pending", "completed", "failed", "cancelled", "uncertain"]),
  status: z.string().nullable(), progress: z.number().min(0).max(100).nullable(),
  output_asset_ids: z.array(uuid).max(1), message: z.string(),
});
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
export const registeredFinishingMcpTools = ["get_video_finishing_capabilities", "finish_video", "get_video_finish"] as const;

function toOutput(result: WorkflowFinishingResult) {
  return { request_key: result.requestKey, job_id: result.jobId, outcome: result.outcome,
    status: result.status ?? null, progress: result.progress ?? null,
    output_asset_ids: result.mediaAssetId ? [result.mediaAssetId] : [], message: result.message };
}

async function finishingAccess(userId: string) {
  try {
    const subscription = await getUserSubscription(userId, { strict: true, refreshCredits: false, initializeFreeCredits: false });
    // Match the website's finishing eligibility, including existing free allowances.
    return subscription.isActive || subscription.freeGenerationCredits.granted > 0;
  } catch {
    throw new ToolFailure("ENTITLEMENTS_UNAVAILABLE", "Current finishing access is temporarily unavailable.", true);
  }
}

function finishingFailure(error: unknown): never {
  if (error instanceof ExploreFinishError) {
    const code = error.status === 409 ? "FINISH_CONFLICT" : error.status === 404 ? "NOT_FOUND" : error.status >= 500 ? "FINISHING_UNAVAILABLE" : "INVALID_INPUT";
    throw new ToolFailure(code, error.message, error.status >= 500);
  }
  throw new ToolFailure("FINISHING_UNAVAILABLE", "Could not confirm finishing. Keep this request key and check its status before submitting again.", true);
}

export function registerFinishingMcpTools(server: McpServer) {
  server.registerTool("get_video_finishing_capabilities", {
    description: "Check this account's video editing/composition rollout and prerequisites without submitting work.",
    inputSchema: z.strictObject({}),
    outputSchema: z.strictObject({
      available: z.boolean(), reason: z.enum(["available", "not_enabled", "not_configured", "access_required"]),
      manual_editing: z.boolean(), framing: z.boolean(), subtitles: z.boolean(),
      required_write_scope: z.literal("creative:write"),
      composition_order: z.literal("opening_then_demo"), separate_preparation_required: z.literal(true),
    }),
    annotations: readOnly, scopeChallenge: requireScopes("account:read"), _meta: oauthMetadata("account:read"),
  }, async (_args, ctx) => executeTool(async () => {
    const owner = principal(ctx, "account:read"), access = await finishingAccess(owner), runtime = videoFinishingRuntime();
    const enabled = process.env.MCP_VIDEO_FINISHING_ENABLED === "true" && runtime.enabled;
    const reason = !enabled ? "not_enabled" : !runtime.configured ? "not_configured" : !access ? "access_required" : "available";
    const available = reason === "available";
    return { available, reason, manual_editing: available && runtime.editing, framing: available && runtime.framing,
      subtitles: available && runtime.subtitles, required_write_scope: "creative:write",
      composition_order: "opening_then_demo", separate_preparation_required: true };
  }));

  server.registerTool("finish_video", {
    description: "Save and queue owned video edits or opening-plus-demo composition. Prepare edits/framing in separate stages before demo/subtitle composition. Reuse the exact request key and draft after interruption; returns a durable receipt, not an instant video.",
    inputSchema: z.strictObject({
      request_key: uuid.describe("Caller-created stable UUID. Reuse only for the identical draft; save it to recover after interruption."),
      draft: videoFinishDraftSchema,
    }),
    outputSchema: finishOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: true },
    scopeChallenge: requireScopes("creative:write"), _meta: oauthMetadata("creative:write"),
  }, async (args, ctx) => executeTool(async () => {
    const owner = principal(ctx, "creative:write");
    if (process.env.MCP_VIDEO_FINISHING_ENABLED !== "true") throw new ToolFailure("FINISHING_UNAVAILABLE", "IDE video finishing is not enabled yet.", true);
    if (!await finishingAccess(owner)) throw new ToolFailure("ACCESS_REQUIRED", "Your account does not currently have video finishing access.");
    // The worker's canonical parser validates combinations, timing and crop paths.
    let draft;
    try { draft = parseExploreFinishDraft(args.draft); }
    catch (error) { throw new ToolFailure("INVALID_INPUT", error instanceof Error ? error.message : "Choose a valid video finishing draft."); }
    try { return toOutput((await startWorkflowFinishingForOwner(owner, args.request_key, draft)).result); }
    catch (error) { return finishingFailure(error); }
  }));

  server.registerTool("get_video_finish", {
    description: "Read an owned saved video-finishing receipt by request key, including website requests. Never submits or requeues work; remains available when creation is disabled.",
    inputSchema: z.strictObject({ request_key: uuid }), outputSchema: finishOutput,
    annotations: readOnly, scopeChallenge: requireScopes("jobs:read"), _meta: oauthMetadata("jobs:read"),
  }, async ({ request_key }, ctx) => executeTool(async () => {
    const owner = principal(ctx, "jobs:read");
    try { return toOutput(await getWorkflowFinishingForOwner(owner, request_key)); }
    catch (error) { return finishingFailure(error); }
  }));
}
