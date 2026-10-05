import "server-only";

import { createHash } from "node:crypto";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getBackgroundJobForUser, getMissingBackgroundJobStorageEnvVars, type BackgroundJobRecord } from "@/lib/jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { ExploreFinishError, EXPLORE_RENDER_VERSION, isExploreUuid, parseExploreFinishDraft, type ExploreFinishDraft, type ExploreFinishReceipt } from "@/worker/src/lib/explore-finishing-contract";
import { SCRIBE_PROVIDER_KEY } from "@/worker/src/subtitles/elevenlabs-contract";
import { ExploreFinishingRequestStore } from "./workflow-finishing-store";

const MAX_BODY_BYTES = 8 * 1024;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization" } });
const terminal = new Set(["completed", "failed", "cancelled"]);
const safeErrors: Record<string, string> = {
  SUBTITLE_LANGUAGE_UNSUPPORTED: "Auto subtitles support English speech only.",
  SUBTITLE_DURATION_UNSUPPORTED: "Auto subtitles support up to 60 seconds in total. Your video was not shortened.",
  NO_SPEECH: "No speech was detected. Your original video is unchanged.",
  PROVIDER_REQUEST_UNCERTAIN: "The transcription response is unconfirmed. It will not be submitted again automatically.",
  provider_submission_uncertain: "The transcription may already have been submitted. It will not be submitted again automatically.",
  PROVIDER_AUTH_FAILED: "Subtitle transcription is unavailable. Your original video is unchanged.",
  PROVIDER_RATE_LIMIT: "The subtitle provider is temporarily unavailable. Your original video is unchanged.",
};

/** Bind normalized edits to the worker/render policy, not client-supplied IDs. */
export function fingerprintExploreFinish(draft: ExploreFinishDraft) {
  return createHash("sha256").update(JSON.stringify({ renderer: EXPLORE_RENDER_VERSION,
    transcription: draft.subtitles ? SCRIBE_PROVIDER_KEY : null, draft })).digest("hex");
}

async function bodyJson(request: Request) {
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new ExploreFinishError("Send a JSON finishing draft.", 415);
  const declared = request.headers.get("Content-Length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) throw new ExploreFinishError("The finishing draft is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ExploreFinishError("Choose a finishing draft.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY_BYTES) throw new ExploreFinishError("The finishing draft is too large.", 413);
      chunks.push(chunk.value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
    catch { throw new ExploreFinishError("Choose a valid JSON finishing draft."); }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

function verifyJob(job: BackgroundJobRecord | null, receipt: ExploreFinishReceipt) {
  const input = job?.input;
  if (!job || job.id !== receipt.job_id || job.userId !== receipt.user_id || job.jobType !== "render_demo_video" || job.projectId !== "explore" ||
      job.idempotencyKey !== `explore-finish:${receipt.request_key}` || !input || typeof input !== "object" || Array.isArray(input) ||
      input.version !== 1 || input.userId !== receipt.user_id || input.requestKey !== receipt.request_key ||
      input.outputAssetId !== receipt.output_asset_id || input.fingerprint !== receipt.fingerprint) throw new ExploreFinishError("The saved finishing job could not be verified.", 409);
  if (job.status === "completed" && receipt.status !== "completed") throw new ExploreFinishError("The finished-media record is not confirmed yet.", 503);
  return job;
}

async function responseFor(store: ExploreFinishingRequestStore, receipt: ExploreFinishReceipt, job: BackgroundJobRecord, status = 200) {
  const verified = verifyJob(job, receipt);
  if (receipt.status === "completed") await store.asset(receipt.user_id, receipt.output_asset_id, "video");
  const uncertain = receipt.status === "uncertain" || ["PROVIDER_REQUEST_UNCERTAIN", "provider_submission_uncertain"].includes(verified.errorCode ?? "");
  const outcome = receipt.status === "completed" ? "completed" : uncertain ? "uncertain" :
    verified.status === "failed" ? "failed" : verified.status === "cancelled" ? "cancelled" : "pending";
  const failureMessage = safeErrors[verified.errorCode ?? ""];
  return json({ ok: true, receiptVersion: 1, requestKey: receipt.request_key, kind: receipt.draft.kind,
    jobId: receipt.job_id, outcome, status: verified.status,
    progress: typeof verified.progress === "number" && Number.isFinite(verified.progress) ? Math.max(0, Math.min(100, verified.progress)) : null,
    mediaAssetId: outcome === "completed" ? receipt.output_asset_id : null,
    message: outcome === "completed" ? "Your finished video is saved." : uncertain ? "Transcription needs review; no automatic resubmission will be made." :
      outcome === "failed" ? typeof failureMessage === "string" ? failureMessage : "Finishing did not complete. Your original media is unchanged." :
      outcome === "cancelled" ? "Finishing was cancelled. Your original media is unchanged." : "Your finishing request is saved and is being processed." }, status);
}

/** Queues a committed, owned edit only. No ffmpeg or paid ASR in the app route. */
export async function handleWorkflowFinishingStart(request: Request) {
  try {
    const owner = (await requireAIStudioProUser(request)).uid;
    // Enable only after the migration and matching worker are ready. This gate
    // is not authorization to omit Explore from the complete release.
    if (process.env.EXPLORE_FINISHING_ENABLED !== "true") throw new ExploreFinishError("Video finishing is not enabled yet.", 503);
    const body = await bodyJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ExploreFinishError("Choose a valid finishing request.");
    const raw = body as Record<string, unknown>;
    if (Object.keys(raw).some(key => !["requestKey", "draft"].includes(key)) || !isExploreUuid(raw.requestKey) ||
        request.headers.get("Idempotency-Key")?.toLowerCase() !== raw.requestKey.toLowerCase()) throw new ExploreFinishError("Invalid finishing request identity.");
    const key = raw.requestKey.toLowerCase(), draft = parseExploreFinishDraft(raw.draft), fingerprint = fingerprintExploreFinish(draft);
    const store = new ExploreFinishingRequestStore();
    // Replays recover their job even if new subtitle creation is off.
    const prior = await store.read(owner, key);
    if (prior && (prior.fingerprint !== fingerprint || JSON.stringify(prior.draft) !== JSON.stringify(draft))) throw new ExploreFinishError("This request was already used for different edits.", 409);
    if (!prior) {
      if (draft.subtitles && process.env.EXPLORE_FINISHING_SUBTITLES_ENABLED !== "true") throw new ExploreFinishError("Subtitle finishing is not enabled yet.", 503);
      if (getMissingBackgroundJobStorageEnvVars().length || getMissingJobQueueEnvVars(["render_demo_video"]).length) throw new ExploreFinishError("Video finishing dispatch is not configured.", 503);
    }
    const receipt = prior ?? await store.create(owner, key, fingerprint, draft);
    const job = verifyJob(await getBackgroundJobForUser({ jobId: receipt.job_id, userId: owner }), receipt);
    // A lost queue acknowledgement leaves this job available to durable
    // recovery; never create a replacement job here.
    const dispatched = receipt.status === "queued" && !terminal.has(job.status) ? await dispatchQueuedBackgroundJobForRecovery(job) : job;
    return await responseFor(store, receipt, dispatched, receipt.status === "completed" ? 200 : 202);
  } catch (error) { return errorResponse(error); }
}

/** Read-only owner recovery, even when starts are off. Absence is not proof an
 * interrupted POST cannot still commit. Never create or dispatch from GET. */
export async function handleWorkflowFinishingStatus(request: Request) {
  try {
    const owner = (await requireFirebaseUser(request)).uid;
    const query = new URL(request.url).searchParams, key = query.get("requestKey");
    if (!isExploreUuid(key) || Array.from(query.keys()).some(name => name !== "requestKey") || query.getAll("requestKey").length !== 1) throw new ExploreFinishError("Invalid saved finishing identity.");
    const normalized = key.toLowerCase(), store = new ExploreFinishingRequestStore(), receipt = await store.read(owner, normalized);
    if (!receipt) return json({ ok: true, receiptVersion: 1, requestKey: normalized, outcome: "unconfirmed", jobId: null, mediaAssetId: null,
      message: "This request is not confirmed yet. Keep the same request identity when checking or submitting again." });
    const job = verifyJob(await getBackgroundJobForUser({ jobId: receipt.job_id, userId: owner }), receipt);
    return await responseFor(store, receipt, job);
  } catch (error) { return errorResponse(error); }
}

function errorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) return json({ ok: false, error: error.message }, error.status);
  if (error instanceof ExploreFinishError) return json({ ok: false, error: error.message, code: error.code }, error.status);
  return json({ ok: false, error: "Could not confirm finishing. Check this saved request before starting another edit." }, 503);
}
