import { HOOK_KEYFRAME_MOTION_VERSION, type HookMotionCompilation } from "./hook-keyframe-motion.ts";

/** Browser draft checkpoints only. A future admission endpoint must independently
 * resolve the canonical source, verify asset ownership and freeze paid requests. */
export const HOOK_KEYFRAME_MAX_PERSON_IMAGES = 5;
export const HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS = 2_000;
export const HOOK_KEYFRAME_MAX_MOTION_INSTRUCTIONS = 6_000;
const MAX_DRAFT_LENGTH = 24_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u;

export type HookKeyframeScope = {
  ownerId: string; draftId: string; referenceId: string; sourceSha256: string;
};
export type HookSourceFrame = {
  index: 0; timeSeconds: 0; width: number; height: number; sha256: string;
};
type GeneratedImage = { assetId: string; inputKey: string; promptVersion: 1 };
type ApprovedImage = { assetId: string; inputKey: string };
export type HookKeyframeDraft = {
  version: 1;
  scope: HookKeyframeScope;
  sourceFrame: HookSourceFrame | null;
  /** Main photo first, optional different views of that same person afterward. */
  imageAssetIds: string[];
  instructions: string;
  /** null uses this Hook's suggested motion; an empty string is an explicit edit. */
  motionInstructions: string | null;
  generateAudio: boolean;
  generatedImage: GeneratedImage | null;
  approval: ApprovedImage | null;
};
export class HookKeyframeDraftError extends Error {
  constructor() {
    super("This starting-image preparation could not be verified. The source or saved inputs changed. Review them before continuing.");
    this.name = "HookKeyframeDraftError";
  }
}
function invalid(): never { throw new HookKeyframeDraftError(); }
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(value).every(key => allowed.includes(key));

function validScope(value: unknown): value is HookKeyframeScope {
  return object(value) && fields(value, ["ownerId", "draftId", "referenceId", "sourceSha256"]) &&
    typeof value.ownerId === "string" && value.ownerId.length > 0 && value.ownerId.length <= 128 &&
    !CONTROL.test(value.ownerId) &&
    typeof value.draftId === "string" && UUID.test(value.draftId) &&
    typeof value.referenceId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value.referenceId) &&
    typeof value.sourceSha256 === "string" && SHA256.test(value.sourceSha256);
}
function validFrame(value: unknown): value is HookSourceFrame {
  return object(value) && fields(value, ["index", "timeSeconds", "width", "height", "sha256"]) &&
    value.index === 0 && value.timeSeconds === 0 &&
    Number.isInteger(value.width) && (value.width as number) > 0 && (value.width as number) <= 8_192 &&
    Number.isInteger(value.height) && (value.height as number) > 0 && (value.height as number) <= 8_192 &&
    typeof value.sha256 === "string" && SHA256.test(value.sha256);
}
function assetId(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }

export function hookKeyframeDraftStorageKey(ownerId: string, draftId: string, referenceId: string) {
  if (!validScope({ ownerId, draftId, referenceId, sourceSha256: "0".repeat(64) })) invalid();
  return `ugc-explore:hook-starting-image:v1:${encodeURIComponent(ownerId)}:${draftId}:${referenceId}`;
}
export function createHookKeyframeDraft(scope: HookKeyframeScope): HookKeyframeDraft {
  if (!validScope(scope)) invalid();
  return { version: 1, scope: { ...scope }, sourceFrame: null, imageAssetIds: [], instructions: "", motionInstructions: null,
    generateAudio: false, generatedImage: null, approval: null };
}

/** Exact, deterministic input binding; it is not a signature or ownership proof.
 * Sound belongs to animation and does not invalidate an already approved still. */
export function hookKeyframeInputKey(draft: Pick<HookKeyframeDraft, "scope" | "sourceFrame" | "imageAssetIds" | "instructions">) {
  const { ownerId, draftId, referenceId, sourceSha256 } = draft.scope;
  const frame = draft.sourceFrame;
  return JSON.stringify({ version: 1, ownerId, draftId, referenceId, sourceSha256,
    sourceFrame: frame ? { index: frame.index, timeSeconds: frame.timeSeconds, width: frame.width, height: frame.height, sha256: frame.sha256 } : null,
    imageAssetIds: draft.imageAssetIds, instructions: draft.instructions });
}

function parseDraft(value: unknown, scope: HookKeyframeScope): HookKeyframeDraft {
  if (!validScope(scope) || !object(value) || !fields(value, ["version", "scope", "sourceFrame", "imageAssetIds", "instructions", "motionInstructions", "generateAudio", "generatedImage", "approval"]) ||
    value.version !== 1 || !validScope(value.scope) ||
    Object.keys(scope).some(key => value.scope !== null && (value.scope as HookKeyframeScope)[key as keyof HookKeyframeScope] !== scope[key as keyof HookKeyframeScope]) ||
    value.sourceFrame !== null && !validFrame(value.sourceFrame) ||
    !Array.isArray(value.imageAssetIds) || value.imageAssetIds.length > HOOK_KEYFRAME_MAX_PERSON_IMAGES ||
    value.imageAssetIds.some(id => !assetId(id)) || new Set(value.imageAssetIds.map(id => (id as string).toLowerCase())).size !== value.imageAssetIds.length ||
    typeof value.instructions !== "string" || value.instructions.length > HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS || CONTROL.test(value.instructions) ||
    value.motionInstructions !== undefined && value.motionInstructions !== null && (typeof value.motionInstructions !== "string" ||
      value.motionInstructions.length > HOOK_KEYFRAME_MAX_MOTION_INSTRUCTIONS || CONTROL.test(value.motionInstructions)) ||
    typeof value.generateAudio !== "boolean") invalid();
  const draft: HookKeyframeDraft = { version: 1, scope: { ...scope },
    sourceFrame: value.sourceFrame === null ? null : { ...value.sourceFrame as HookSourceFrame },
    imageAssetIds: [...value.imageAssetIds as string[]], instructions: value.instructions as string,
    motionInstructions: value.motionInstructions === undefined || value.motionInstructions === null ? null : value.motionInstructions as string,
    generateAudio: value.generateAudio as boolean, generatedImage: null, approval: null };
  if (value.generatedImage !== null) {
    const image = value.generatedImage;
    if (!object(image) || !fields(image, ["assetId", "inputKey", "promptVersion"]) || !assetId(image.assetId) ||
      image.promptVersion !== 1 || image.inputKey !== hookKeyframeInputKey(draft) || !draft.sourceFrame || !draft.imageAssetIds.length ||
      draft.imageAssetIds.some(id => id.toLowerCase() === (image.assetId as string).toLowerCase())) invalid();
    draft.generatedImage = { assetId: image.assetId, inputKey: image.inputKey as string, promptVersion: 1 };
  }
  if (value.approval !== null) {
    const approval = value.approval;
    if (!object(approval) || !fields(approval, ["assetId", "inputKey"]) || !draft.generatedImage ||
      approval.assetId !== draft.generatedImage.assetId || approval.inputKey !== draft.generatedImage.inputKey) invalid();
    draft.approval = { assetId: approval.assetId as string, inputKey: approval.inputKey as string };
  }
  return draft;
}
export function readHookKeyframeDraft(raw: string | null, scope: HookKeyframeScope): HookKeyframeDraft | null {
  if (raw === null) return null;
  if (!raw || raw.length > MAX_DRAFT_LENGTH) invalid();
  try { return parseDraft(JSON.parse(raw), scope); } catch { return invalid(); }
}
export function serializeHookKeyframeDraft(draft: HookKeyframeDraft): string {
  const raw = JSON.stringify(parseDraft(draft, draft.scope));
  if (raw.length > MAX_DRAFT_LENGTH) invalid();
  return raw;
}
export function updateHookKeyframeDraft(draft: HookKeyframeDraft, patch: Partial<Pick<HookKeyframeDraft, "sourceFrame" | "imageAssetIds" | "instructions" | "motionInstructions" | "generateAudio">>): HookKeyframeDraft {
  const previous = parseDraft(draft, draft.scope);
  if (!object(patch) || !fields(patch, ["sourceFrame", "imageAssetIds", "instructions", "motionInstructions", "generateAudio"])) invalid();
  // Validate the new inputs independently of the old generated-image binding.
  const next = parseDraft({ ...previous, ...patch, generatedImage: null, approval: null }, previous.scope);
  if (hookKeyframeInputKey(next) === hookKeyframeInputKey(previous)) {
    next.generatedImage = previous.generatedImage; next.approval = previous.approval;
  }
  return next;
}
export function recordHookKeyframeImage(draft: HookKeyframeDraft, image: GeneratedImage): HookKeyframeDraft {
  return parseDraft({ ...draft, generatedImage: image, approval: null }, draft.scope);
}
export function approveHookKeyframeImage(draft: HookKeyframeDraft): HookKeyframeDraft {
  const current = parseDraft(draft, draft.scope);
  if (!current.generatedImage) invalid();
  return { ...current, approval: { assetId: current.generatedImage.assetId, inputKey: current.generatedImage.inputKey } };
}
/** UI readiness only. Paid admission must obtain motion review from the trusted
 * catalog and must verify the generated asset's owner, purpose and input receipt. */
export function hookKeyframeAnimationReadiness(draft: HookKeyframeDraft, motion: HookMotionCompilation | null, durationSeconds: number): { ready: boolean; message: string | null } {
  const current = parseDraft(draft, draft.scope);
  if (!current.sourceFrame || !current.imageAssetIds.length) return { ready: false, message: "Choose the source frame and a main face photo first." };
  if (!current.generatedImage || !current.approval) return { ready: false, message: "Create and approve your starting image before generating a video." };
  if (current.motionInstructions !== null) return { ready: false, message: "Review the edited animation instructions before generating a video." };
  if (!motion || motion.status !== "ready" || motion.motionVersion !== HOOK_KEYFRAME_MOTION_VERSION ||
    motion.referenceId !== current.scope.referenceId || motion.sourceSha256 !== current.scope.sourceSha256 ||
    motion.startingFrameIndex !== current.sourceFrame.index ||
    !Number.isSafeInteger(durationSeconds) || durationSeconds < 4 || durationSeconds > 15 || motion.durationSeconds !== durationSeconds ||
    motion.generateAudio !== current.generateAudio || typeof motion.prompt !== "string" || !motion.prompt.trim()) {
    return { ready: false, message: "This Hook's animation instructions need review for the selected source, frame, duration and sound choice." };
  }
  return { ready: true, message: null };
}
