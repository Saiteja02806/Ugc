import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { ValidatedWorkflowVideoBatch } from "@/lib/ai-studio/video-generation-api";
import { getBackgroundJobForUser } from "@/lib/jobs/background-jobs";
import type { WorkflowKind } from "./workflow-generation-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
export type WorkflowGenerationReceipt = { requestKey: string; kind: WorkflowKind; quantity: 1 | 2 | 4; outcome: "accepted" | "not_started"; jobIds: string[] };
export class WorkflowGenerationReceiptError extends Error {
  constructor(message: string, public readonly status = 503) { super(message); }
}

function db() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new WorkflowGenerationReceiptError("Generation request storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function parseReceipt(value: unknown, ownerId: string, requestKey: string): WorkflowGenerationReceipt {
  if (!isRecord(value) || value.user_id !== ownerId || value.request_key !== requestKey ||
      !["hook", "phone"].includes(String(value.workflow_kind)) || ![1, 2, 4].includes(Number(value.quantity)) || typeof value.quantity !== "number" ||
      !["accepted", "not_started"].includes(String(value.outcome)) || !Array.isArray(value.job_ids) ||
      value.job_ids.some((id) => typeof id !== "string" || !UUID.test(id)) || new Set(value.job_ids).size !== value.job_ids.length ||
      value.job_ids.length !== (value.outcome === "accepted" ? value.quantity : 0)) {
    throw new WorkflowGenerationReceiptError("The saved generation request could not be verified.", 409);
  }
  return { requestKey, kind: value.workflow_kind as WorkflowKind, quantity: value.quantity as 1 | 2 | 4,
    outcome: value.outcome as WorkflowGenerationReceipt["outcome"], jobIds: value.job_ids as string[] };
}

export async function readWorkflowGenerationReceipt(ownerId: string, requestKey: string) {
  const { data, error } = await db().from("explore_generation_requests")
    .select("user_id,request_key,workflow_kind,quantity,outcome,job_ids").eq("user_id", ownerId).eq("request_key", requestKey).maybeSingle();
  if (error) throw new WorkflowGenerationReceiptError("Could not read the saved generation request.");
  return data ? parseReceipt(data, ownerId, requestKey) : null;
}

export async function resolveWorkflowGenerationReceipt(ownerId: string, requestKey: string, kind: WorkflowKind, quantity: number) {
  const { data, error } = await db().rpc("explore_resolve_generation_request", {
    p_user_id: ownerId, p_request_key: requestKey, p_workflow_kind: kind, p_quantity: quantity,
  });
  if (error) throw new WorkflowGenerationReceiptError("Could not resolve the saved generation request.", error.message.includes("conflict") ? 409 : 503);
  const receipt = parseReceipt(data, ownerId, requestKey);
  if (receipt.kind !== kind || receipt.quantity !== quantity) throw new WorkflowGenerationReceiptError("The saved request belongs to different work.", 409);
  return receipt;
}

/** The fingerprint excludes random output IDs, but includes every validated input and its cost. */
export function fingerprintWorkflowGenerationBatch(batch: ValidatedWorkflowVideoBatch, kind: WorkflowKind) {
  return createHash("sha256").update(JSON.stringify({ kind, ownerId: batch.userId, amount: batch.amountPerVideo,
    inputs: batch.inputs.map((input) => Object.fromEntries(Object.entries(input).filter(([key]) => key !== "videoId"))) })).digest("hex");
}

export async function createWorkflowGenerationBatch(batch: ValidatedWorkflowVideoBatch, kind: WorkflowKind) {
  const fingerprint = fingerprintWorkflowGenerationBatch(batch, kind);
  const inputs = batch.inputs.map((input) => ({ ...input, workflowKind: kind, workflowRequestKey: batch.requestKey, workflowRequestFingerprint: fingerprint }));
  const { data, error } = await db().rpc("explore_create_reserved_generation_batch", {
    p_user_id: batch.userId, p_request_key: batch.requestKey, p_workflow_kind: kind,
    p_fingerprint: fingerprint, p_amount_per_video: batch.amountPerVideo, p_inputs_json: inputs,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("conflict") || message.includes("request_closed")) throw new WorkflowGenerationReceiptError("This request was already resolved or belongs to different work. Refresh its saved status.", 409);
    if (message.includes("insufficient_billing_credits")) throw new WorkflowGenerationReceiptError("There are not enough AI credits for the complete batch.", 403);
    if (message.includes("paid_subscription_required")) throw new WorkflowGenerationReceiptError("An active Starter or Growth subscription is required.", 403);
    throw new WorkflowGenerationReceiptError("Could not save the generation request. Refresh status before trying again.");
  }
  if (!isRecord(data) || typeof data.created !== "boolean" || !Array.isArray(data.jobs) || data.jobs.length !== batch.inputs.length) {
    throw new WorkflowGenerationReceiptError("The generation response could not be verified.");
  }
  const expectedKey = (index: number) => `explore:${batch.requestKey}:${index + 1}`;
  const verifiedInput = (input: unknown, index: number): input is Record<string, unknown> => isRecord(input) &&
    input.userId === batch.userId && input.projectId === "ai-studio" && input.promptMode === "direct" &&
    input.workflowKind === kind && input.workflowRequestKey === batch.requestKey && input.workflowRequestFingerprint === fingerprint &&
    input.batchSize === inputs.length && input.batchIndex === index + 1 && typeof input.videoId === "string" && UUID.test(input.videoId);
  const outputIds: string[] = [];
  const ids = data.jobs.map((job, index) => {
    if (!isRecord(job) || typeof job.id !== "string" || !UUID.test(job.id) || job.user_id !== batch.userId ||
        job.job_type !== "generate_hook_video" || job.project_id !== "ai-studio" || job.idempotency_key !== expectedKey(index) ||
        !verifiedInput(job.input_json, index)) throw new WorkflowGenerationReceiptError("The saved generation jobs could not be verified.");
    outputIds.push(job.input_json.videoId as string);
    return job.id;
  });
  if (new Set(ids).size !== ids.length || new Set(outputIds).size !== outputIds.length) throw new WorkflowGenerationReceiptError("The saved generation jobs could not be verified.");
  const jobs = await Promise.all(ids.map((jobId) => getBackgroundJobForUser({ jobId, userId: batch.userId })));
  if (jobs.some((job, index) => !job || job.id !== ids[index] || job.userId !== batch.userId || job.jobType !== "generate_hook_video" ||
      job.projectId !== "ai-studio" || job.idempotencyKey !== expectedKey(index) || !verifiedInput(job.input, index) ||
      job.input.videoId !== outputIds[index])) throw new WorkflowGenerationReceiptError("Could not confirm the saved generation jobs.");
  return jobs.filter((job) => job !== null);
}
