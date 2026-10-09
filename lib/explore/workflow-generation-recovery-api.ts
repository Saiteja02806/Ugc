import "server-only";

import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getBackgroundJobByIdempotencyKey, getBackgroundJobForUser } from "@/lib/jobs/background-jobs";
import { readWorkflowGenerationReceipt, resolveWorkflowGenerationReceipt, type WorkflowGenerationReceipt } from "./workflow-generation-receipts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Owner-authenticated lookup only: no reservation, dispatch, retry or provider call. */
export async function handleWorkflowGenerationRecovery(request: Request) {
  let ownerId: string;
  try { ownerId = (await requireFirebaseUser(request)).uid; }
  catch (error) {
    return json({ ok: false, error: error instanceof FirebaseAuthRequestError ? error.message : "Could not verify your session." }, error instanceof FirebaseAuthRequestError ? error.status : 500);
  }
  const query = new URL(request.url).searchParams;
  const requestKey = query.get("requestKey") ?? "";
  const quantity = Number(query.get("quantity"));
  if (!UUID.test(requestKey) || ![1, 2, 4].includes(quantity)) return json({ ok: false, error: "Invalid recovery identity." }, 400);
  try {
    if (query.get("receipt") === "2") {
      const kind = query.get("kind");
      if (kind !== "hook" && kind !== "phone") return json({ ok: false, error: "Invalid recovery workflow." }, 400);
      const receipt = await readWorkflowGenerationReceipt(ownerId, requestKey);
      if (!receipt) return json({ ok: true, requestKey, jobs: [], resolved: false, canResolve: true,
        message: "No committed request was found. Resolve this request before starting another generation." });
      if (receipt.kind !== kind || receipt.quantity !== quantity) return json({ ok: false, error: "The saved request belongs to different work." }, 409);
      return await receiptResponse(receipt, ownerId);
    }
    const records = await Promise.all(Array.from({ length: quantity }, (_, index) => getBackgroundJobByIdempotencyKey(quantity === 1 ? requestKey : `${requestKey}:${index + 1}`, { userId: ownerId, jobType: "generate_hook_video" })));
    const jobs: { jobId: string; videoId: string }[] = [];
    for (const [index, job] of records.entries()) {
      if (!job) continue;
      const input = job.input;
      if (job.userId !== ownerId || job.jobType !== "generate_hook_video" || job.projectId !== "ai-studio" || !input || typeof input !== "object" || Array.isArray(input) ||
        input.batchSize !== quantity || input.batchIndex !== index + 1 || typeof input.videoId !== "string" || !UUID.test(input.videoId) || !UUID.test(job.id)) {
        return json({ ok: false, error: "The saved request could not be verified." }, 409);
      }
      jobs.push({ jobId: job.id, videoId: input.videoId });
    }
    // Missing children may still be being created. Absence is never proof of failure.
    return json({ ok: true, requestKey, jobs, resolved: jobs.length === quantity, partial: jobs.length < quantity,
      message: jobs.length === quantity ? "Your saved generation request was recovered." : "The previous request is not fully confirmed yet. Refresh status before starting another generation." });
  } catch {
    return json({ ok: false, error: "Could not read saved generation status." }, 503);
  }
}

/** Explicit resolution writes only a no-start fence, never a generation or dispatch. */
export async function handleWorkflowGenerationResolution(request: Request) {
  let ownerId: string;
  try { ownerId = (await requireFirebaseUser(request)).uid; }
  catch (error) {
    return json({ ok: false, error: error instanceof FirebaseAuthRequestError ? error.message : "Could not verify your session." }, error instanceof FirebaseAuthRequestError ? error.status : 500);
  }
  const query = new URL(request.url).searchParams;
  const requestKey = query.get("requestKey") ?? "", kind = query.get("kind"), quantity = Number(query.get("quantity"));
  const body = await request.json().catch(() => null);
  if (query.get("receipt") !== "2" || !UUID.test(requestKey) || ![1, 2, 4].includes(quantity) ||
      (kind !== "hook" && kind !== "phone") || body?.action !== "resolve") return json({ ok: false, error: "Invalid request resolution." }, 400);
  try { return await receiptResponse(await resolveWorkflowGenerationReceipt(ownerId, requestKey, kind, quantity), ownerId); }
  catch { return json({ ok: false, error: "Could not resolve the saved request. No new generation was submitted." }, 503); }
}

async function receiptResponse(receipt: WorkflowGenerationReceipt, ownerId: string) {
  const jobs: { jobId: string; videoId: string }[] = [];
  for (const [index, jobId] of receipt.jobIds.entries()) {
    const job = await getBackgroundJobForUser({ jobId, userId: ownerId });
    const input = job?.input;
    if (!job || job.id !== jobId || job.userId !== ownerId || job.jobType !== "generate_hook_video" || job.projectId !== "ai-studio" ||
        job.idempotencyKey !== `explore:${receipt.requestKey}:${index + 1}` ||
        !input || typeof input !== "object" || Array.isArray(input) || input.workflowRequestKey !== receipt.requestKey ||
        input.userId !== ownerId || input.projectId !== "ai-studio" || input.promptMode !== "direct" ||
        input.workflowKind !== receipt.kind || input.batchSize !== receipt.quantity || input.batchIndex !== index + 1 ||
        typeof input.videoId !== "string" || !UUID.test(input.videoId)) return json({ ok: false, error: "The saved generation jobs could not be verified." }, 409);
    jobs.push({ jobId, videoId: input.videoId });
  }
  if (new Set(jobs.map(job => job.videoId)).size !== jobs.length) return json({ ok: false, error: "The saved generation jobs could not be verified." }, 409);
  return json({ ok: true, receiptVersion: 2, requestKey: receipt.requestKey, kind: receipt.kind, quantity: receipt.quantity,
    outcome: receipt.outcome, jobs, resolved: true, partial: false,
    message: receipt.outcome === "not_started" ? "The previous request did not start. No new generation was submitted." : "Your saved generation request was recovered." });
}
