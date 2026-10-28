import type { HookStartingFrameSelection } from "./hook-keyframe-client";

/** Store identities/settings only; refresh signed media URLs from an owned GET. */
export type HookComposerSelection = Pick<HookStartingFrameSelection,
  "ownerId" | "draftId" | "referenceId" | "sourceSha256" | "assetId" | "jobId" |
  "durationSeconds" | "motionInstructions" | "generateAudio">;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const hookComposerSelectionKey = (ownerId: string, namespace = "hook") => `ugc-explore:hook-composer:v1:${encodeURIComponent(ownerId)}${namespace === "hook" ? "" : `:${encodeURIComponent(namespace)}`}`;

export function readHookComposerSelection(raw: string | null, ownerId: string): HookComposerSelection | null {
  if (raw === null) return null;
  if (raw.length > 40000) throw new Error("The saved starting frame could not be verified. Choose it again from Starting frames.");
  const value = JSON.parse(raw);
  if (value?.version !== 1 || value.ownerId !== ownerId || !uuid.test(value.assetId) || !uuid.test(value.jobId) || !uuid.test(value.draftId) ||
    typeof value.referenceId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.referenceId) || !/^[a-f0-9]{64}$/.test(value.sourceSha256) ||
    ![4, 6, 8].includes(value.durationSeconds) || typeof value.generateAudio !== "boolean" || typeof value.motionInstructions !== "string" ||
    !value.motionInstructions.trim() || value.motionInstructions.length > 24000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value.motionInstructions)) {
    throw new Error("The saved starting frame could not be verified. Choose it again from Starting frames.");
  }
  return { ownerId, draftId: value.draftId, referenceId: value.referenceId, sourceSha256: value.sourceSha256,
    assetId: value.assetId, jobId: value.jobId, durationSeconds: value.durationSeconds,
    motionInstructions: value.motionInstructions, generateAudio: value.generateAudio };
}
export function serializeHookComposerSelection(frame: HookStartingFrameSelection): string {
  const { ownerId, draftId, referenceId, sourceSha256, assetId, jobId, durationSeconds, motionInstructions, generateAudio } = frame;
  return JSON.stringify({ version: 1, ...readHookComposerSelection(JSON.stringify({ version: 1, ownerId, draftId, referenceId,
    sourceSha256, assetId, jobId, durationSeconds, motionInstructions, generateAudio }), ownerId)! });
}
export function restoreHookComposerSelection(saved: HookComposerSelection, verified: HookStartingFrameSelection): HookStartingFrameSelection {
  for (const key of ["ownerId", "draftId", "referenceId", "sourceSha256", "assetId", "jobId"] as const) {
    if (saved[key] !== verified[key]) throw new Error("The saved starting frame changed. Choose it again from Starting frames.");
  }
  return { ...verified, durationSeconds: saved.durationSeconds, motionInstructions: saved.motionInstructions, generateAudio: saved.generateAudio };
}
