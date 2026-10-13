import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { ExploreFinishError, isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import { ExploreFinishingRequestStore } from "./workflow-finishing-store";
import { fingerprintExploreFinish, getWorkflowFinishingForOwner, videoFinishingRuntime } from "./workflow-finishing-service";
import { getBackgroundJobForUser } from "@/lib/jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getScheduledPostForUser, updateScheduledPostRenderState } from "@/lib/scheduling/db";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { isVerifiedExploreFinishedVideo } from "@/lib/scheduling/explore-finished-video";
import { prepareExplorePendingSchedule, scheduleRenderedPost, reconcileExploreScheduleTargets, SchedulingRequestError } from "@/lib/scheduling/service";
import { ExplorePendingScheduleStore, type ExploreScheduleBinding } from "./pending-schedule-store";
import { explorePreparationDecision, parseExplorePendingSchedule, stableExploreScheduleJson, type ExplorePendingScheduleResult } from "./pending-schedule-contract";

function identity(owner: string, key: string) {
  if (!owner.trim() || owner.length > 128 || !isExploreUuid(key)) throw new ExploreFinishError("Invalid background schedule identity.");
  return key.toLowerCase();
}
export function assertExplorePendingSchedulingRuntime() {
  const runtime = videoFinishingRuntime();
  if (process.env.EXPLORE_PENDING_SCHEDULING_ENABLED !== "true" || !runtime.enabled || !runtime.configured || !runtime.editing) {
    throw new ExploreFinishError("Background scheduling is not enabled yet. Prepare your video before scheduling.", 503, "explore_pending_scheduling_unavailable");
  }
}

export async function explorePendingSchedulingAvailable() {
  try { assertExplorePendingSchedulingRuntime(); return await new ExplorePendingScheduleStore().available(); }
  catch { return false; }
}

/** Only durable reservation is awaited. Queue submission/rendering happen after
 * acknowledgement and are independently recovered from the database outbox. */
export async function reserveExplorePendingSchedule(owner: string, raw: unknown, access: { allowTikTokTargets?: boolean; allowYouTubeTargets?: boolean }) {
  const input = parseExplorePendingSchedule(raw), key = identity(owner, input.requestKey);
  const requestHash = createHash("sha256").update(stableExploreScheduleJson(input)).digest("hex");
  const store = new ExplorePendingScheduleStore(), prior = await store.read(owner, key);
  if (prior) {
    if (prior.request_hash !== requestHash) throw new ExploreFinishError("This schedule request was already used for different details.", 409, "explore_schedule_conflict");
    return { created: false, result: await getExplorePendingSchedule(owner, key) };
  }
  assertExplorePendingSchedulingRuntime();
  const runtime = videoFinishingRuntime();
  if ((input.draft.demoFraming || input.draft.sourceFraming) && !runtime.framing) throw new ExploreFinishError("Demo framing is not enabled yet.", 503);
  if (input.draft.subtitles && !runtime.subtitles) throw new ExploreFinishError("Subtitle finishing is not enabled yet.", 503);
  const schedule = await prepareExplorePendingSchedule({ ...access, userId: owner,
    input: { ...input.schedule, source: { kind: "media_asset", id: input.draft.sourceAssetId } } });
  await store.reserve({ owner, key, requestHash, fingerprint: fingerprintExploreFinish(input.draft), draft: input.draft, schedule });
  return { created: true, result: await getExplorePendingSchedule(owner, key) };
}

/** Status reads never create, dispatch, render, or publish. */
export async function getExplorePendingSchedule(owner: string, requestKey: string): Promise<ExplorePendingScheduleResult> {
  const key = identity(owner, requestKey), store = new ExplorePendingScheduleStore(), binding = await store.read(owner, key);
  if (!binding) return { ok: true, version: 1, requestKey: key, schedule: null,
    preparation: { state: "unconfirmed", jobId: null, mediaAssetId: null, message: "This schedule request is not confirmed. Check or submit the same saved request again." } };
  const [schedule, receipt] = await Promise.all([
    getScheduledPostForUser({ postId: binding.schedule_id, userId: owner }), new ExploreFinishingRequestStore().read(owner, key),
  ]);
  if (!schedule || !receipt || schedule.metadata.exploreFinishRequestKey !== key || schedule.metadata.exploreFinishFingerprint !== receipt.fingerprint ||
      schedule.metadata.exploreFinishOutputAssetId !== receipt.output_asset_id) throw new ExploreFinishError("Could not verify the saved background schedule.", 409);
  const state = schedule.status === "cancelled" ? "cancelled" : binding.state === "pending" ? "preparing" : binding.state;
  return { ok: true, version: 1, requestKey: key, schedule, preparation: { state, jobId: receipt.job_id,
    mediaAssetId: receipt.status === "completed" ? receipt.output_asset_id : null,
    message: state === "preparing" ? "Your schedule is saved. The video is preparing in the background; you can leave this screen." :
      state === "scheduled" ? "Your post is scheduled." : state === "cancelled" ? "This schedule was cancelled." :
      binding.last_error_message || "Video preparation or scheduling failed. Review this saved post before creating a new schedule." } };
}

async function failPreparation(store: ExplorePendingScheduleStore, binding: ExploreScheduleBinding, token: string, code: string, message: string) {
  // Cancellation and failure compete on the same locked post row. Never turn a
  // concurrently cancelled post back into a failed or publishable draft.
  await store.fail(binding, token, code, message);
}

/** Called by the worker after file confirmation and by periodic recovery. The
 * lease + existing target/job identities make duplicate delivery safe. */
export async function reconcileExplorePendingSchedule(owner: string, requestKey: string) {
  const key = identity(owner, requestKey), store = new ExplorePendingScheduleStore(), token = randomUUID();
  const binding = await store.claim(owner, key, token);
  if (!binding) return { inspected: 0, finalized: false };
  try {
    const receipt = await new ExploreFinishingRequestStore().read(owner, key);
    const schedule = await getScheduledPostForUser({ postId: binding.schedule_id, userId: owner });
    if (!receipt || !schedule || schedule.metadata.exploreFinishRequestKey !== key || schedule.metadata.exploreFinishFingerprint !== receipt.fingerprint ||
        schedule.metadata.exploreFinishOutputAssetId !== receipt.output_asset_id) throw new ExploreFinishError("The immutable preparation snapshot could not be verified.", 409);
    const progress = await getWorkflowFinishingForOwner(owner, key);
    const decision = explorePreparationDecision({ receiptCompleted: receipt.status === "completed", receiptUncertain: receipt.status === "uncertain" || progress.outcome === "uncertain",
      jobStatus: progress.status ?? "queued", scheduleStatus: schedule.status, hasTargets: schedule.targets.length > 0, deadlineAt: binding.deadline_at });
    if (decision === "cancelled") { await store.finish(binding, token, "cancelled"); return { inspected: 1, finalized: false }; }
    if (decision === "failed" || decision === "deadline_expired") {
      await failPreparation(store, binding, token, decision === "deadline_expired" ? "explore_schedule_deadline_elapsed" : "explore_preparation_failed",
        decision === "deadline_expired" ? "The video was not ready before its selected publish time. Choose a new future time; this post was not published." : progress.message);
      return { inspected: 1, finalized: false };
    }
    if (decision === "wait") {
      const job = await getBackgroundJobForUser({ userId: owner, jobId: receipt.job_id });
      if (!job) throw new ExploreFinishError("The saved preparation job is missing.", 409);
      await dispatchQueuedBackgroundJobForRecovery(job);
      await store.finish(binding, token, "pending");
      return { inspected: 1, finalized: false };
    }
    const asset = await getMediaAssetForOwner({ userId: owner, assetId: receipt.output_asset_id });
    if (!await isVerifiedExploreFinishedVideo(asset, owner)) throw new ExploreFinishError("The exact prepared video could not be verified.", 409);
    if (!schedule.targets.length) {
      const attached = await updateScheduledPostRenderState({ expectedStatus: schedule.status, expectedUpdatedAt: schedule.updatedAt,
        postId: schedule.id, userId: owner, mediaAssetId: receipt.output_asset_id,
        metadata: { exploreFinishStatus: "ready", combinedRenderStatus: "ready", finalScheduleStatus: "finalizing", scheduledVideoId: receipt.output_asset_id } });
      if (!attached) throw new SchedulingRequestError("This schedule changed while preparation was completing.", 409, "schedule_version_conflict");
      await scheduleRenderedPost({ postId: schedule.id, userId: owner, input: {}, leadPolicy: "render_finalization" });
    } else {
      await reconcileExploreScheduleTargets({ postId: schedule.id, userId: owner });
    }
    const final = await getScheduledPostForUser({ postId: schedule.id, userId: owner });
    if (final?.status === "cancelled") { await store.finish(binding, token, "cancelled"); return { inspected: 1, finalized: false }; }
    if (!final || !final.targets.length) throw new ExploreFinishError("Platform scheduling has not been confirmed.", 503);
    if (["failed", "partially_failed"].includes(final.status)) {
      await store.finish(binding, token, "failed", "explore_platform_scheduling_failed", "Your video is ready, but account scheduling needs review. Check this saved post in Scheduling.");
      return { inspected: 1, finalized: false };
    }
    await updateScheduledPostRenderState({ postId: final.id, userId: owner, metadata: { finalScheduleStatus: final.status } });
    await store.finish(binding, token, "scheduled");
    return { inspected: 1, finalized: true };
  } catch (error) {
    const terminal = (error instanceof ExploreFinishError || error instanceof SchedulingRequestError) && error.status < 500 &&
      !["schedule_version_conflict"].includes(error.code);
    if (terminal) await failPreparation(store, binding, token, error.code, error.message);
    else await store.finish(binding, token, "pending", "explore_reconciliation_retry", "Scheduling confirmation is pending and will be checked again automatically.");
    if (!terminal) throw error;
    return { inspected: 1, finalized: false };
  }
}

export async function reconcileDueExplorePendingSchedules(limit = 10) {
  // The rollout flag controls acceptance, never recovery of a committed post.
  // Disabling new requests must not strand previously acknowledged schedules.
  const bindings = await new ExplorePendingScheduleStore().due(limit), results = [];
  for (const binding of bindings) {
    try { results.push(await reconcileExplorePendingSchedule(binding.user_id, binding.request_key)); }
    catch { results.push({ inspected: 1, finalized: false, retrying: true }); }
  }
  return { inspected: bindings.length, results };
}
