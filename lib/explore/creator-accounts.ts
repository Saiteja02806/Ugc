import "server-only";
import { createHash } from "node:crypto";
import { readCreatorPrivateFile, readCreatorPrivateJson, type CreatorCatalog, type CreatorReviews } from "./creator-private-files.ts";
import { canAccessCreatorAccounts } from "./creator-account-access.ts";
import type { RecreateReference } from "./recreate-types.ts";
import { buildHookFullRecreationOpeningImagePrompt } from "./hook-keyframe-image-prompt.ts";
import type { ReferenceText } from "./reference-text.ts";

import { buildSourceMotionDirections, validateMiddleFrameMotionEntry, type MiddleFrameMotionEntry } from "./hook-middle-frame-motion.ts";

const middleFramePrompts = readCreatorPrivateJson<{ entries: MiddleFrameMotionEntry[] }>("creator-middle-frame-prompts.json", { entries: [] });

export function getCreatorMiddleFramePrompt(referenceId: string, sourceSha256: string) {
  const source = getCreatorAccountSource(referenceId);
  const entry = middleFramePrompts.entries.find(row => row.referenceId === referenceId && row.sourceSha256 === sourceSha256);
  return source?.sourceSha256 === sourceSha256 && entry && entry.clarityFrame.index === source.startingFrame.index &&
    entry.clarityFrame.timeSeconds === source.startingFrame.timeSeconds && entry.clarityFrame.sha256 === source.startingFrame.sha256 &&
    validateMiddleFrameMotionEntry(entry) ? entry : undefined;
}

export type CreatorAccount = { id: string; label: string; items: RecreateReference[] };
const catalog = readCreatorPrivateJson<CreatorCatalog>("creator-accounts.json", {version: 1, accounts: []});
const reviews = readCreatorPrivateJson<CreatorReviews>("creator-account-reviews.json", {reviewedAt: "", method: "", items: []});

export function getCreatorAccountSource(referenceId: unknown) {
  return typeof referenceId === "string" ? catalog.accounts.flatMap(account => account.items).find(item => item.id === referenceId) : undefined;
}

function reviewFor(item: NonNullable<ReturnType<typeof getCreatorAccountSource>>) {
  return reviews.items.find(review => review.id === item.id && review.sourceSha256 === item.sourceSha256);
}

/** Internal history resolver; the caller must first verify the owned image job. */
export function creatorAccountLegacySelectedDirections(referenceId: string, sourceSha256: string, frameIndex = 0, frameSha256?: string) {
  const source = getCreatorAccountSource(referenceId);
  if (source?.sourceSha256 !== sourceSha256) return undefined;
  const review = reviewFor(source);
  return review && source.startingFrame.index === frameIndex && review.selectedFrameSha256 === frameSha256 ? review.selectedFrameDirections : review?.directions;
}

export function creatorAccountDirections(referenceId: string, sourceSha256: string, frameIndex = 0, frameSha256?: string) {
  const entry = getCreatorMiddleFramePrompt(referenceId, sourceSha256);
  return entry && entry.clarityFrame.index === frameIndex && entry.clarityFrame.sha256 === frameSha256
    ? buildSourceMotionDirections(entry) : creatorAccountLegacySelectedDirections(referenceId, sourceSha256, frameIndex, frameSha256);
}

export function getCreatorAccounts(user: Parameters<typeof canAccessCreatorAccounts>[0]): CreatorAccount[] {
  if (!canAccessCreatorAccounts(user)) return [];
  return catalog.accounts.map(account => ({ id: account.id, label: account.label, items: account.items.map(item => ({
    id: item.id, format: "hook", title: "Hook", category: null, categoryLabel: null, slides: [],
    creatorAccountId: account.id, sourceSha256: item.sourceSha256, durationSeconds: item.durationSeconds,
    generationPrompt: creatorAccountDirections(item.id, item.sourceSha256, item.startingFrame.index, item.startingFrame.sha256),
    startingImagePrompt: getCreatorMiddleFramePrompt(item.id, item.sourceSha256) ? buildHookFullRecreationOpeningImagePrompt({ personImageCount: 1, referenceId: item.id, sourceSha256: item.sourceSha256, assignedEntry: getCreatorMiddleFramePrompt(item.id, item.sourceSha256) }).prompt : undefined,
    legacySelectedGenerationPrompt: reviewFor(item)?.selectedFrameDirections,
    legacyGenerationPrompt: reviewFor(item)?.directions,
    startingFrame: item.startingFrame,
    posterUrl: `/api/explore/creator-media/${item.id}?variant=poster`,
    videoUrl: `/api/explore/creator-media/${item.id}?variant=video`,
  })) }));
}

/** Retain the legacy frame-zero poster and every selected frame by digest. */
export async function readCreatorStartingFrame(referenceId: string, requestedSha256?: string) {
  const source = getCreatorAccountSource(referenceId); if (!source) return null;
  const selected = source.startingFrame;
  if (requestedSha256 && requestedSha256 === source.posterSha256) {
    const original = await readCreatorAccountMedia(referenceId,"poster");
    return original ? { ...original, frame: { index: 0, timeSeconds: 0, sha256: source.posterSha256, width: source.width, height: source.height } } : null;
  }
  if (requestedSha256 && requestedSha256 !== selected.sha256) return null;
  const bytes = readCreatorPrivateFile(`creator-account-media/${selected.sha256}.png`);
  if (bytes.length !== selected.bytes || createHash("sha256").update(bytes).digest("hex") !== selected.sha256) throw new Error("Creator selected frame changed.");
  return { bytes, contentType: "image/png", source, frame: selected };
}

export function getCreatorAccountText(referenceId: string, user: Parameters<typeof canAccessCreatorAccounts>[0]): ReferenceText | null {
  const item = canAccessCreatorAccounts(user) ? getCreatorAccountSource(referenceId) : undefined;
  const review = item && reviewFor(item);
  if (!item || !review) return null;
  return { referenceId, slideId: null, format: "hook", sourceSha256: item.sourceSha256, status: "ready",
    blocks: [{ text: review.caption, startMs: 0, endMs: Math.round(item.durationSeconds * 1000) }],
    extractedAt: reviews.reviewedAt, model: "manual-source-frame-review", notes: reviews.method };
}

/** Only manifest-owned identities become filesystem paths; originals stay out of public/. */
export async function readCreatorAccountMedia(referenceId: string, variant: "poster" | "video") {
  const source = getCreatorAccountSource(referenceId);
  if (!source) return null;
  const poster = variant === "poster";
  const bytes = readCreatorPrivateFile(`creator-account-media/${source.sourceSha256}.${poster ? "png" : "mp4"}`);
  if (createHash("sha256").update(bytes).digest("hex") !== (poster ? source.posterSha256 : source.sourceSha256)
    || bytes.length !== (poster ? source.posterBytes : source.videoBytes)) throw new Error("Creator media identity changed.");
  return { bytes, contentType: poster ? "image/png" : "video/mp4", source };
}
