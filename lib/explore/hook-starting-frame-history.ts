import "server-only";
import { listBackgroundJobsForUser } from "../jobs/background-jobs";
import { resolveApprovedHookStartingFrame, HookKeyframeGenerationError } from "./hook-keyframe-result.ts";
import { createHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
import type { HookStartingFrameSelection } from "./hook-keyframe-client.ts";
import { startingFrameWorkflowDirections } from "./starting-frame-workflow.ts";
import { hookKeyframeReceiptImageModel } from "../../worker/src/lib/hook-keyframe-image-model.ts";
import { creatorAccountDirections } from "./creator-accounts.ts";

/** Reusable frames retain the verified source and its reviewed motion plan. */
export async function resolveRecentHookStartingFrame(ownerId: string, jobId: string, assetId: string): Promise<HookStartingFrameSelection> {
  const result = await resolveApprovedHookStartingFrame({ ownerId, imageJobId: jobId, assetId });
  const scope = { ownerId, draftId: result.receipt.draftId, referenceId: result.referenceId, sourceSha256: result.sourceSha256 };
  const preview = result.workflow === "wall_text" || result.workflow === "talking_head"
    ? { requiresDecision: false, animationError: null, durationSeconds: 4, directions: startingFrameWorkflowDirections(result.workflow) }
    : getHookKeyframePromptPreview({ ...createHookKeyframeDraft(scope), version: result.receipt.version,
      imageModel: hookKeyframeReceiptImageModel(result.receipt), sourceFrame: result.receipt.sourceFrame }, "hook", creatorAccountDirections(result.referenceId, result.sourceSha256, result.startingFrameIndex, result.receipt.sourceFrame.sha256));
  if (preview.requiresDecision || preview.animationError || !preview.directions.trim()) throw new HookKeyframeGenerationError("This frame's motion instructions need review before use.", 409);
  return { ...scope, assetId: result.assetId, jobId, url: result.imageUrl, width: result.output.width, height: result.output.height,
    durationSeconds: preview.durationSeconds === 8 ? 8 : 4, motionInstructions: preview.directions, generateAudio: false };
}

export async function listRecentHookStartingFrames(ownerId: string) {
  const jobs = await listBackgroundJobsForUser({ userId: ownerId, jobType: "generate_image", projectId: "hook-starting-frame", completedOnly: true, limit: 48 });
  const frames: HookStartingFrameSelection[] = [];
  // Bound owned-record verification concurrency; no generation or retries here.
  for (let offset = 0; offset < jobs.length && frames.length < 24; offset += 4) {
    const batch = await Promise.all(jobs.slice(offset, offset + 4).map(async job => {
      const output = job.output && typeof job.output === "object" && !Array.isArray(job.output) ? job.output : null;
      if (typeof output?.mediaAssetId !== "string") return null;
      const input = job.input && typeof job.input === "object" && !Array.isArray(job.input) ? job.input : null;
      const receipt = input?.hookKeyframe && typeof input.hookKeyframe === "object" && !Array.isArray(input.hookKeyframe) ? input.hookKeyframe : null;
      if (input?.exploreFormat === "wall_text" || typeof receipt?.referenceId === "string" && receipt.referenceId.startsWith("talking-")) return null;
      try {
        const frame = await resolveRecentHookStartingFrame(ownerId, job.id, output.mediaAssetId);
        // This legacy shelf belongs to Hook. Other workflow drafts still restore
        // their exact owned job/asset through the single-result GET.
        return frame;
      }
      catch (error) { if (error instanceof HookKeyframeGenerationError && [404, 409].includes(error.status)) return null; throw error; }
    }));
    frames.push(...batch.filter((frame): frame is HookStartingFrameSelection => frame !== null));
  }
  return frames.slice(0, 24);
}
