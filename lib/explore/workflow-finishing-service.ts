import "server-only";

import { createHash } from "node:crypto";
import { FORMAT_TEXT_SEQUENCE_RENDER_VERSION } from "@/worker/src/lib/explore-format-edit";
import { getBackgroundJobForUser, getMissingBackgroundJobStorageEnvVars, type BackgroundJobRecord } from "@/lib/jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { ExploreFinishError, EXPLORE_RENDER_VERSION, DEMO_FRAMING_RENDER_VERSION, EXPLORE_COMPOSITION_RENDER_VERSION, isExploreUuid, parseExploreFinishDraft, type ExploreFinishDraft, type ExploreFinishReceipt } from "@/worker/src/lib/explore-finishing-contract";
import { SCRIBE_PROVIDER_KEY } from "@/worker/src/subtitles/elevenlabs-contract";
import { ExploreFinishingRequestStore } from "./workflow-finishing-store";
import type { SubtitleTranscript } from "@/worker/src/subtitles/contracts";

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

export type WorkflowFinishingResult = {
  ok: true;
  receiptVersion: 1;
  requestKey: string;
  kind?: ExploreFinishDraft["kind"];
  jobId: string | null;
  outcome: "unconfirmed" | "pending" | "completed" | "captions_ready" | "failed" | "cancelled" | "uncertain";
  captionTranscript?: SubtitleTranscript;
  status?: BackgroundJobRecord["status"];
  progress?: number | null;
  mediaAssetId: string | null;
  message: string;
};

/** Keep normalized drafts and legacy renderer fingerprints identical across clients. */
export function fingerprintExploreFinish(draft: ExploreFinishDraft) {
  return createHash("sha256").update(JSON.stringify({ renderer: draft.composition ? EXPLORE_COMPOSITION_RENDER_VERSION : draft.sourceFraming ? "explore-finish-single-pan-v1" : draft.editing ? draft.editing.textOverlays === undefined ? "explore-format-edit-v1" : FORMAT_TEXT_SEQUENCE_RENDER_VERSION : draft.demoFraming ? DEMO_FRAMING_RENDER_VERSION : EXPLORE_RENDER_VERSION,
    transcription: draft.subtitles ? SCRIBE_PROVIDER_KEY : null, draft })).digest("hex");
}

export function videoFinishingRuntime() {
  return {
    enabled: process.env.EXPLORE_FINISHING_ENABLED === "true",
    configured: !getMissingBackgroundJobStorageEnvVars().length && !getMissingJobQueueEnvVars(["render_demo_video"]).length,
    editing: process.env.EXPLORE_FORMAT_EDITING_ENABLED === "true",
    framing: process.env.EXPLORE_DEMO_FRAMING_ENABLED === "true",
    subtitles: process.env.EXPLORE_FINISHING_SUBTITLES_ENABLED === "true",
  };
}

function identity(owner: string, key: string) {
  if (!owner.trim() || !isExploreUuid(key)) throw new ExploreFinishError("Invalid saved finishing identity.");
  return key.toLowerCase();
}

function verifyJob(job: BackgroundJobRecord | null, receipt: ExploreFinishReceipt) {
  const input = job?.input;
  if (!job || job.id !== receipt.job_id || job.userId !== receipt.user_id || job.jobType !== "render_demo_video" || job.projectId !== "explore" ||
      job.idempotencyKey !== `explore-finish:${receipt.request_key}` || !input || typeof input !== "object" || Array.isArray(input) ||
      input.version !== 1 || input.userId !== receipt.user_id || input.requestKey !== receipt.request_key ||
      input.outputAssetId !== receipt.output_asset_id || input.fingerprint !== receipt.fingerprint) throw new ExploreFinishError("The saved finishing job could not be verified.", 409);
  if (job.status === "completed" && receipt.status !== "completed" && !(receipt.draft.captionPreview && receipt.transcript)) throw new ExploreFinishError("The finished-media record is not confirmed yet.", 503);
  return job;
}

function pendingFinishMessage(job: BackgroundJobRecord) {
  if (job.status === "cancel_requested") return "Cancellation requested. Waiting for video processing to stop safely.";
  if (job.status === "stalled") return "Video processing stopped responding. Check the save status or cancel this save before trying again.";
  if (job.stage === "render_job_launched") return "Your video is queued. Preparing the video processor…";
  if (job.status === "queued") return "Your finishing request is saved and waiting for the video processor.";
  if (job.stage === "downloading_owned_media") return "Preparing your selected clips for editing…";
  if (job.stage === "transcribing_composed_audio") return "Transcribing the finished video's audio…";
  if (job.stage === "uploading_finished_video") return "Your video is rendered. Saving the finished file…";
  if (job.stage === "saving_finished_video") return "Your finished file is saved. Confirming it in your media library…";
  if (job.status === "rendering") return "Rendering your video edits…";
  if (job.status === "waiting_external_service") return "Waiting for video processing to finish…";
  return "Your finishing request is saved and is being processed.";
}

async function resultFor(store: ExploreFinishingRequestStore, receipt: ExploreFinishReceipt, job: BackgroundJobRecord): Promise<WorkflowFinishingResult> {
  const verified = verifyJob(job, receipt);
  if (receipt.status === "completed") await store.asset(receipt.user_id, receipt.output_asset_id, "video");
  const uncertain = receipt.status === "uncertain" || ["PROVIDER_REQUEST_UNCERTAIN", "provider_submission_uncertain"].includes(verified.errorCode ?? "");
  const outcome = receipt.draft.captionPreview && verified.status === "completed" && receipt.transcript ? "captions_ready" : receipt.status === "completed" ? "completed" : uncertain ? "uncertain" :
    verified.status === "failed" ? "failed" : verified.status === "cancelled" ? "cancelled" : "pending";
  const failureMessage = safeErrors[verified.errorCode ?? ""];
  return { ok: true, receiptVersion: 1, requestKey: receipt.request_key, kind: receipt.draft.kind,
    jobId: receipt.job_id, outcome, status: verified.status,
    progress: typeof verified.progress === "number" && Number.isFinite(verified.progress) ? Math.max(0, Math.min(100, verified.progress)) : null,
    mediaAssetId: outcome === "completed" ? receipt.output_asset_id : null,
    ...(receipt.transcript ? { captionTranscript: receipt.transcript } : {}),
    message: outcome === "captions_ready" ? "Captions are ready. Review the words, then prepare your final video." : outcome === "completed" ? "Your finished video is saved." : uncertain ? "Transcription needs review; no automatic resubmission will be made." :
      outcome === "failed" ? typeof failureMessage === "string" ? failureMessage : "Finishing did not complete. Your original media is unchanged." :
      outcome === "cancelled" ? "Finishing was cancelled. Your original media is unchanged." : pendingFinishMessage(verified) };
}

/** Callers authenticate the owner and enforce creation entitlement before entering this boundary. */
export async function startWorkflowFinishingForOwner(owner: string, requestKey: string, rawDraft: unknown, options: { modernSubtitles?: boolean } = {}) {
  const key = identity(owner, requestKey);
  if (process.env.EXPLORE_FINISHING_ENABLED !== "true") throw new ExploreFinishError("Video finishing is not enabled yet.", 503);
  if (Buffer.byteLength(JSON.stringify(rawDraft) ?? "", "utf8") > 32 * 1024) throw new ExploreFinishError("The finishing draft is too large.", 413);
  let draft = parseExploreFinishDraft(rawDraft);
  const store = new ExploreFinishingRequestStore();
  const prior = await store.read(owner, key);
  // New connector requests use the same bounded warm path as the website.
  // An omitted version is resolved from an accepted receipt on exact replay:
  // old requests retain their speech identity and cannot be silently upgraded.
  if (options.modernSubtitles && draft.subtitles && draft.subtitles.version === undefined && (!prior || prior.draft.subtitles?.version === 2)) {
    draft = { ...draft, subtitles: { ...draft.subtitles, version: 2 } };
  }
  const fingerprint = fingerprintExploreFinish(draft);
  if (prior && (prior.fingerprint !== fingerprint || JSON.stringify(prior.draft) !== JSON.stringify(draft))) throw new ExploreFinishError("This request was already used for different edits.", 409);
  if (!prior) {
    const runtime = videoFinishingRuntime();
    if ((draft.editing || draft.composition) && !runtime.editing) throw new ExploreFinishError("Format video editing is not enabled yet.", 503);
    if ((draft.demoFraming || draft.sourceFraming) && !runtime.framing) throw new ExploreFinishError("Demo framing is not enabled yet.", 503);
    if (draft.subtitles && !runtime.subtitles) throw new ExploreFinishError("Subtitle finishing is not enabled yet.", 503);
    if (!runtime.configured) throw new ExploreFinishError("Video finishing dispatch is not configured.", 503);
  }
  const receipt = prior ?? await store.create(owner, key, fingerprint, draft);
  const job = verifyJob(await getBackgroundJobForUser({ jobId: receipt.job_id, userId: owner }), receipt);
  const dispatched = receipt.status === "queued" && !terminal.has(job.status) ? await dispatchQueuedBackgroundJobForRecovery(job) : job;
  return { result: await resultFor(store, receipt, dispatched), httpStatus: receipt.status === "completed" ? 200 : 202 };
}

/** Read-only recovery stays available when creation gates or plan eligibility change. */
export async function getWorkflowFinishingForOwner(owner: string, requestKey: string): Promise<WorkflowFinishingResult> {
  const key = identity(owner, requestKey), store = new ExploreFinishingRequestStore(), receipt = await store.read(owner, key);
  if (!receipt) return { ok: true, receiptVersion: 1, requestKey: key, outcome: "unconfirmed", jobId: null, mediaAssetId: null,
    message: "This request is not confirmed yet. Keep the same request identity when checking or submitting again." };
  const job = verifyJob(await getBackgroundJobForUser({ jobId: receipt.job_id, userId: owner }), receipt);
  return resultFor(store, receipt, job);
}
