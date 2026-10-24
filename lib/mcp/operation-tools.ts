import "server-only";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ACTIVE_BACKGROUND_JOB_STATUSES, CANONICAL_BACKGROUND_JOB_TYPES, getImplementationBackgroundJobTypes } from "@/lib/jobs/background-job-contract";
import { listBackgroundJobsForUser } from "@/lib/jobs/background-jobs";
import { decodeAssetCursor, encodeAssetCursor } from "./asset-cursor";
import { controlOperation, getOperationForOwner, operationDetails, operationSummary } from "./operation-service";
import { confirmableOutputSchema, confirmedToolDescription, requireConfirmation, withConfirmToken } from "./confirm-token";
import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";

export const registeredOperationMcpTools = ["list_operations", "get_operation", "cancel_operation", "retry_operation"] as const;
const timestamp = z.iso.datetime({ offset: true });
const statuses = ["cancelled", "cancel_requested", "completed", "created", "failed", "processing", "queued",
  "rendering", "stalled", "uploading_output", "waiting_external_service"] as const;
const summary = z.strictObject({ id: z.uuid(), type: z.enum(CANONICAL_BACKGROUND_JOB_TYPES), status: z.enum(statuses),
  project_id: z.string().nullable(), progress: z.number().min(0).max(100).nullable(), stage: z.string().nullable(),
  created_at: timestamp, updated_at: timestamp, expected_updated_at: timestamp,
  attempt_count: z.number().int().nonnegative(), max_attempts: z.number().int().positive(),
  cancellation_requested_at: timestamp.nullable(), can_cancel: z.boolean(), can_retry: z.boolean(),
  error: z.strictObject({ code: z.string(), message: z.string(), retryable: z.boolean() }).nullable() });
const controlInput = z.strictObject({ operation_id: z.uuid(), request_id: z.uuid().describe("Save a new stable UUID before this action. Reuse it and every input to recover a lost response."),
  expected_updated_at: timestamp.describe("The exact expected_updated_at returned by get_operation. Preserve its full precision. Changed operations require an explicit new action.") });
const controlOutput = z.strictObject({ operation: summary, request_id: z.uuid(), replayed: z.boolean(), accepted_at: timestamp });

export function registerOperationMcpTools(server: McpServer) {
  server.registerTool("list_operations", {
    description: "Discover owned application and MCP jobs across generation, finishing, preparation, publishing and analytics. Returns safe status summaries without inputs, diagnostics or provider/storage identifiers.",
    inputSchema: z.strictObject({ type: z.enum(CANONICAL_BACKGROUND_JOB_TYPES).optional(),
      status: z.enum(["all", "active", ...statuses]).default("all"), project_id: z.string().trim().min(1).max(120).optional(),
      limit: z.number().int().min(1).max(50).default(20), cursor: z.string().max(2500).optional() }),
    outputSchema: z.strictObject({ items: z.array(summary), next_cursor: z.string().nullable() }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    scopeChallenge: requireScopes("jobs:read"), _meta: oauthMetadata("jobs:read"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "jobs:read"), cursor = args.cursor ? decodeAssetCursor(args.cursor) : null;
    const filter = JSON.stringify({ status: args.status, project_id: args.project_id ?? null });
    if (args.cursor && (!cursor || cursor.user_id !== userId || cursor.collection !== "background-job" ||
      cursor.source_type !== (args.type ?? null) || cursor.query !== filter))
      throw new ToolFailure("INVALID_CURSOR", "The history cursor does not match this account and filters.");
    let rows;
    try {
      rows = await listBackgroundJobsForUser({ userId, limit: args.limit + 1, jobTypes: getImplementationBackgroundJobTypes(args.type),
        statuses: args.status === "active" ? [...ACTIVE_BACKGROUND_JOB_STATUSES] : args.status === "all" ? undefined : [args.status],
        projectId: args.project_id, after: cursor ? { createdAt: cursor.updated_at, id: cursor.id } : undefined });
    } catch { throw new ToolFailure("OPERATIONS_UNAVAILABLE", "Job history is temporarily unavailable.", true); }
    const page = rows.slice(0, args.limit), last = page.at(-1);
    return { items: page.map(operationSummary), next_cursor: rows.length > args.limit && last ? encodeAssetCursor({
      v: 1, user_id: userId, collection: "background-job", source_type: args.type ?? null, query: filter,
      updated_at: last.createdAt, id: last.id }) : null };
  }));
  server.registerTool("get_operation", {
    description: "Read any owned customer job, its safe retry/cancellation status and verified completed output IDs. Recover finishing or saved Edit export request IDs when available; use get_video_finish or get_edit_export for their receipts. Never submits work.",
    inputSchema: z.strictObject({ operation_id: z.uuid() }),
    outputSchema: z.strictObject({ operation: summary, output_asset_ids: z.array(z.uuid()).max(20), finishing_request_id: z.uuid().nullable(), edit_export_request_id: z.uuid().nullable() }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    scopeChallenge: requireScopes("jobs:read"), _meta: oauthMetadata("jobs:read"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "jobs:read");
    return operationDetails(await getOperationForOwner(userId, args.operation_id), userId);
  }));
  server.registerTool("cancel_operation", {
    description: confirmedToolDescription("Request cancellation of the selected owned job using the application's existing cancellation policy. Running work may stop asynchronously. Reuse saved inputs after a lost response."),
    inputSchema: withConfirmToken(controlInput), outputSchema: confirmableOutputSchema(controlOutput),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    scopeChallenge: requireScopes("jobs:write"), _meta: oauthMetadata("jobs:write"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "jobs:write");
    return requireConfirmation({
      tool: "cancel_operation", accountId: userId, args, effect: "mutate",
      summary: "Request cancellation of the selected job. Running work may stop asynchronously.",
      creditCost: 0, creditCostIsEstimate: false,
      affected: [{ type: "operation", id: args.operation_id, label: "Owned job cancellation" }],
      run: () => controlOperation({ userId, jobId: args.operation_id, requestId: args.request_id, expectedUpdatedAt: args.expected_updated_at, action: "cancel" }),
    });
  }));
  server.registerTool("retry_operation", {
    description: confirmedToolDescription("Retry a supported owned failed/stalled job using existing attempt, provider and original-plan credit rules. May reserve credits again. Save the request ID and exact revision before calling; replay recovers this action without funding another retry."),
    inputSchema: withConfirmToken(controlInput), outputSchema: confirmableOutputSchema(controlOutput),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    scopeChallenge: requireScopes("jobs:write"), _meta: oauthMetadata("jobs:write"),
  }, (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "jobs:write");
    return requireConfirmation({
      tool: "retry_operation", accountId: userId, args, effect: "spend_credits",
      summary: "Retry the selected job. A generation retry may reserve credits again.",
      creditCost: null, creditCostIsEstimate: true,
      affected: [{ type: "operation", id: args.operation_id, label: "Owned job retry" }],
      run: () => controlOperation({ userId, jobId: args.operation_id, requestId: args.request_id, expectedUpdatedAt: args.expected_updated_at, action: "retry" }),
    });
  }));
}
