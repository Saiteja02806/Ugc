import "server-only";

import { handleAIStudioVideoGeneration } from "@/lib/ai-studio/video-generation-api";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { createWorkflowGenerationBatch, WorkflowGenerationReceiptError } from "./workflow-generation-receipts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Only Explore uses the additive atomic batch; the existing AI Studio route is unchanged. */
export async function handleWorkflowGenerationStart(request: Request) {
  if (process.env.EXPLORE_GENERATION_ENABLED !== "true" && !(process.env.NODE_ENV === "development" && process.env.EXPLORE_GENERATION_DEVELOPMENT_ENABLED === "true")) {
    return json({ ok: false, error: "Workflow generation is not enabled yet." }, 503);
  }
  const body = await request.clone().json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || !["hook", "phone"].includes(body.workflowKind) ||
      ![1, 2, 4].includes(body.quantity) || typeof body.idempotencyKey !== "string" || !UUID.test(body.idempotencyKey) ||
      request.headers.get("Idempotency-Key") !== body.idempotencyKey) return json({ ok: false, error: "Invalid workflow request identity." }, 400);
  try {
    const response = await handleAIStudioVideoGeneration(request, { startBatch: async (batch) => {
      const jobs = await createWorkflowGenerationBatch(batch, body.workflowKind);
      // Dispatch AFTER the entire transaction commits. A queue failure leaves
      // the same queued jobs available to the existing recovery scheduler.
      const dispatched = await Promise.all(jobs.map(dispatchQueuedBackgroundJobForRecovery));
      const outputs = dispatched.map((job) => ({ jobId: job.id, videoId: (job.input as Record<string, unknown>).videoId }));
      return json({ ok: true, receiptVersion: 2, requestKey: batch.requestKey, kind: body.workflowKind,
        quantity: outputs.length, outcome: "accepted", jobId: outputs[0].jobId, jobs: outputs, partial: false,
        message: `${outputs.length} video generation${outputs.length === 1 ? "" : "s"} saved.` }, 202);
    } });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return json({ ok: false, error: error instanceof WorkflowGenerationReceiptError ? error.message : "Could not confirm generation. Refresh its saved status." },
      error instanceof WorkflowGenerationReceiptError ? error.status : 503);
  }
}
