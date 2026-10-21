import { hookKeyframeInputKey, type HookKeyframeDraft, type HookKeyframeScope } from "./hook-keyframe-draft.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type HookKeyframeCheckpoint = { version: 1; scope: HookKeyframeScope; inputKey: string; requestKey: string; jobId: string | null };
export type HookStartingFrameSelection = {
  ownerId: string; draftId: string; referenceId: string; sourceSha256: string;
  assetId: string; jobId: string; url: string; width: number; height: number;
  durationSeconds: 4 | 8; motionInstructions: string; generateAudio: boolean;
};
export type HookKeyframeJob = {
  id: string; status: string; isTerminal: boolean; error: string | null;
  receipt: { version: 1; purpose: "hook_starting_frame"; ownerId: string; draftId: string; referenceId: string; sourceSha256: string; inputKey: string };
  output: null | { mediaAssetId: string; url: string; width: number; height: number };
};
export function hookKeyframeCheckpointKey(scope: HookKeyframeScope) {
  return `ugc-explore:hook-frame-job:v1:${encodeURIComponent(scope.ownerId)}:${scope.draftId}:${scope.referenceId}`;
}
export function readHookKeyframeCheckpoint(raw: string | null, scope: HookKeyframeScope): HookKeyframeCheckpoint | null {
  if (raw === null) return null;
  try {
    if (raw.length > 24_000) throw Error();
    const value = JSON.parse(raw) as HookKeyframeCheckpoint;
    if (value.version !== 1 || !value.scope || Object.keys(scope).some(key => value.scope[key as keyof HookKeyframeScope] !== scope[key as keyof HookKeyframeScope]) ||
      typeof value.inputKey !== "string" || !value.inputKey || value.inputKey.length > 20_000 || !UUID.test(value.requestKey) || value.jobId !== null && !UUID.test(value.jobId)) throw Error();
    return { version: 1, scope: { ...scope }, inputKey: value.inputKey, requestKey: value.requestKey, jobId: value.jobId };
  } catch { throw new Error("The saved starting-image request could not be verified. Its recovery record has been preserved."); }
}
export function createHookKeyframeCheckpoint(draft: HookKeyframeDraft, requestKey: string): HookKeyframeCheckpoint {
  return readHookKeyframeCheckpoint(JSON.stringify({ version: 1, scope: draft.scope, inputKey: hookKeyframeInputKey(draft), requestKey, jobId: null }), draft.scope)!;
}
export function verifiedHookKeyframeJob(value: unknown, checkpoint: HookKeyframeCheckpoint): HookKeyframeJob {
  const job = value as HookKeyframeJob;
  const receipt = job?.receipt;
  if (!job || !UUID.test(job.id) || checkpoint.jobId && job.id !== checkpoint.jobId || typeof job.status !== "string" || typeof job.isTerminal !== "boolean" ||
    job.error !== null && typeof job.error !== "string" ||
    !receipt || receipt.version !== 1 || receipt.purpose !== "hook_starting_frame" || receipt.inputKey !== checkpoint.inputKey ||
    Object.keys(checkpoint.scope).some(key => receipt[key as keyof HookKeyframeScope] !== checkpoint.scope[key as keyof HookKeyframeScope])) {
    throw new Error("This starting image does not match the saved account, reference and photo selection.");
  }
  let validUrl = false;
  try { const url = new URL(job.output?.url ?? ""); validUrl = url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password; } catch { /* No usable output URL. */ }
  if (job.output && (job.status !== "completed" || !job.isTerminal || job.error !== null || !UUID.test(job.output.mediaAssetId) || !validUrl ||
    !Number.isInteger(job.output.width) || job.output.width <= 0 || !Number.isInteger(job.output.height) || job.output.height <= 0)) {
    throw new Error("The generated starting image is not ready to use.");
  }
  return job;
}
