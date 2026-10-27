import { AI_STUDIO_KLING_PROMPT_MAX_LENGTH, AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH, getAIStudioPromptLengthError, normalizeAIStudioPrompt } from "../ai-studio/prompt-policy";
import { normalizeWorkflowGenerationSettings, type WorkflowGenerationSettings } from "./workflow-generation-settings";
import { getVideoReferencePolicy, getVideoReferenceTypeError, getVideoTimedReferenceError } from "../ai-studio/video-reference-policy";
import type { HookStartingFrameSelection } from "./hook-keyframe-client";
import { isHookStartingFrameVideoModel, hookStartingFrameVideoDurations } from "../../worker/src/lib/hook-starting-frame-video";
import { startingFrameFaceReferenceError } from "./starting-frame-animation-input";
import { ReadDeadlineError, withReadDeadline } from "../http/read-deadline";

export const WORKFLOW_GENERATION_REQUEST_TIMEOUT_MS = 30_000;

export type WorkflowKind = "hook" | "phone";
export type WorkflowImageSource = { name: string; url: string; file?: File; assetId?: string };
export type WorkflowTimedSource = { url: string; name?: string; duration?: number | null; file?: File };
export type WorkflowGenerationDraft = {
  kind: WorkflowKind;
  instructions: string;
  /** Editable reference directions shown beside the user's own instructions. */
  referenceInstructions?: string;
  settings: WorkflowGenerationSettings;
  creator: WorkflowImageSource | null;
  referenceImages?: WorkflowImageSource[];
  appScreen?: (WorkflowImageSource & { kind: "image" | "video"; duration?: number | null }) | null;
  videoReference: WorkflowTimedSource | null;
  audioReference: WorkflowTimedSource | null;
  referencesPending?: boolean;
  referencesError?: string | null;
  startingFrame?: HookStartingFrameSelection | null;
  startingFramePhotos?: WorkflowImageSource[];
};
export type WorkflowGenerationBatch = {
  jobs: { jobId: string; videoId: string }[];
  partial: boolean;
  message: string;
};

const JOB_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

export function workflowGenerationPrompt(draft: Pick<WorkflowGenerationDraft, "instructions" | "referenceInstructions">) {
  const own = normalizeAIStudioPrompt(draft.instructions);
  const reference = normalizeAIStudioPrompt(draft.referenceInstructions ?? "");
  return reference ? `Reference instructions:\n${reference}\n\nYour instructions:\n${own}` : own;
}

function selectedWorkflowImages(draft: WorkflowGenerationDraft) {
  const selected = [...(draft.referenceImages ?? (draft.creator ? [draft.creator] : [])), ...(draft.appScreen?.kind === "image" ? [draft.appScreen] : [])];
  return [...new Map(selected.map(image => [image.url, image])).values()];
}

export function getWorkflowGenerationDraftError(draft: WorkflowGenerationDraft) {
  if (draft.referencesPending) return "Wait for your selected files to finish loading.";
  // A failed replacement may retain the prior preview. Do not submit that
  // stale reference until the user replaces or removes the rejected input.
  if (draft.referencesError) return draft.referencesError;
  if (!normalizeAIStudioPrompt(draft.instructions)) return "Write your instructions before generating a video.";
  const prompt = workflowGenerationPrompt(draft);
  const lengthError = getAIStudioPromptLengthError(prompt, draft.settings.model === "kling_3_0" ? AI_STUDIO_KLING_PROMPT_MAX_LENGTH : AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH);
  if (lengthError) return lengthError;
  if (draft.settings.model === "kling_3_0" && prompt.length < 2) return "Kling 3.0 requires a prompt of at least 2 characters.";
  const validSettings = normalizeWorkflowGenerationSettings(draft.settings);
  if ((Object.keys(validSettings) as (keyof WorkflowGenerationSettings)[]).some((key) => validSettings[key] !== draft.settings[key])) {
    return "These generation settings are unavailable. Choose a supported model, duration and quality.";
  }
  if (draft.startingFrame) {
    if (draft.kind !== "hook") return "Starting-frame Recreate is unavailable in this workflow.";
    if (!isHookStartingFrameVideoModel(draft.settings.model) || !hookStartingFrameVideoDurations(draft.settings.model).includes(draft.settings.duration)) return "Choose a supported starting-frame model and duration.";
    const { width, height } = draft.startingFrame;
    const frameRatio = Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0
      ? width * 16 === height * 9 ? "9:16" : width * 9 === height * 16 ? "16:9" : null : null;
    if (!frameRatio || draft.settings.aspectRatio !== frameRatio) return "Starting-frame animation keeps your approved image's shape. Choose a matching frame.";
    if (draft.audioReference) return "Starting-frame animation cannot use an audio reference. Remove it and use Sound for generated speech, or remove the starting frame to keep audio guidance.";
    if (draft.videoReference || draft.creator || draft.referenceImages?.length || draft.appScreen) return "Remove other generation references before animating your approved starting frame.";
    const photos = draft.startingFramePhotos ?? [];
    if (photos.some(photo => !photo.assetId || !photo.url.startsWith("https://"))) return "Choose owned ready face photos before generating.";
    const faceError = startingFrameFaceReferenceError(draft.settings.model, draft.startingFrame, photos.map(photo => ({ asset: { id: photo.assetId!, url: photo.url } })));
    if (faceError) return faceError;
    return null;
  }
  // Reject before uploading or spending. Never quietly discard an attached input.
  const videos = [draft.videoReference, draft.appScreen?.kind === "video" ? draft.appScreen : null].filter(Boolean) as WorkflowTimedSource[];
  const referenceTypeError = getVideoReferenceTypeError(draft.settings.model, videos.length > 0, Boolean(draft.audioReference));
  if (referenceTypeError) return referenceTypeError;
  if (videos.length > 1) return "Use one reference video: either Choose video or an app recording, not both.";
  for (const source of [...videos, ...(draft.audioReference ? [draft.audioReference] : [])]) {
    const audio = source === draft.audioReference;
    if (!source.file) return "Choose or upload the reference file again.";
    const referenceError = getVideoTimedReferenceError(draft.settings.model, audio ? "audio" : "video", source.duration, source.file.size);
    if (referenceError) return referenceError;
    if (!source.file.type.startsWith(audio ? "audio/" : "video/")) return "Use a playable audio or video reference file.";
  }
  const images = selectedWorkflowImages(draft);
  const policy = getVideoReferencePolicy(draft.settings.model, { hasTimedReferences: videos.length > 0 || Boolean(draft.audioReference) });
  const imageLimit = policy.maxImages;
  if (images.length > imageLimit) return `This model accepts up to ${imageLimit} image references. Remove an image or choose another model.`;
  for (const image of images) {
    if (image?.file && (!["image/png", "image/jpeg", "image/webp"].includes(image.file.type) || !Number.isFinite(image.file.size) || image.file.size <= 0 || image.file.size > policy.maxImageBytes)) {
      return `Use a PNG, JPEG or WebP reference image up to ${policy.maxImageBytes / 1024 ** 2} MB with these references.`;
    }
  }
  if (draft.kind === "phone" && draft.appScreen && draft.settings.model === "kling_3_0") {
    return "Choose Omni Flash 1.1, Seedance 2.5 or WAN 3.0 to use an app screenshot. Kling uses its images as first/last frames.";
  }
  return null;
}

/** All queued outputs are kept, including partial batches. Malformed success is uncertain. */
export function parseWorkflowGenerationBatch(value: unknown, quantity: number): WorkflowGenerationBatch {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.jobs) || value.jobs.length < 1 || value.jobs.length > quantity) {
    throw new Error("The generation response could not be confirmed. Retry the same request to recover its saved status.");
  }
  const jobs = value.jobs.map((job) => {
    if (!isRecord(job) || typeof job.jobId !== "string" || !JOB_ID.test(job.jobId) || typeof job.videoId !== "string" || !JOB_ID.test(job.videoId)) {
      throw new Error("The generation response could not be confirmed. Retry the same request to recover its saved status.");
    }
    return { jobId: job.jobId, videoId: job.videoId };
  });
  if (new Set(jobs.map((job) => job.jobId)).size !== jobs.length || new Set(jobs.map((job) => job.videoId)).size !== jobs.length || value.jobId !== jobs[0].jobId) {
    throw new Error("The generation response could not be confirmed. Retry the same request to recover its saved status.");
  }
  return {
    jobs,
    partial: value.partial === true || jobs.length < quantity,
    message: typeof value.message === "string" ? value.message : `${jobs.length} video generation${jobs.length === 1 ? "" : "s"} started.`,
  };
}

/** Owner-scoped client. No automatic submission, provider retry or embedded credentials. */
export function createWorkflowGenerationClient(dependencies: {
  getOwnerToken: () => Promise<string | null>;
  uploadImage: (image: WorkflowImageSource) => Promise<{ url: string }>;
  uploadReference?: (source: WorkflowTimedSource, kind: "video" | "audio") => Promise<{ url: string; assetId: string; duration: number }>;
  fetch: typeof fetch;
  createIdempotencyKey: () => string;
  assertActive: () => void;
  recovery?: WorkflowGenerationRecovery;
  requestTimeoutMs?: number;
}) {
  const { fetch: sendRequest } = dependencies;
  const uploaded = new Map<string, { url: string }>();
  const uploadedMedia = new Map<string, { url: string; assetId: string; duration: number }>();
  let pending: { fingerprint: string; key: string; body?: string; attempted?: boolean } | null = null;
  let submitting = false;

  async function prepareImage(image: WorkflowImageSource) {
    // A saved record can be removed or replaced between explicit generations.
    const cached = image.assetId ? undefined : uploaded.get(image.url);
    if (cached) return cached;
    dependencies.assertActive();
    const result = await dependencies.uploadImage(image);
    dependencies.assertActive();
    if (!result.url.startsWith("https://")) throw new Error("The reference image was not saved as an uploaded file.");
    uploaded.set(image.url, result);
    return result;
  }

  const client = {
    async generate(draft: WorkflowGenerationDraft): Promise<WorkflowGenerationBatch> {
      if (dependencies.recovery) return dependencies.recovery.withLock(async () => {
        const recovery = dependencies.recovery!;
        if (readWorkflowGenerationRequest(recovery.storage(), recovery.ownerId, recovery.kind)) {
          throw new Error("A previous request is not confirmed. Refresh status to recover it before starting another generation.");
        }
        if (draft.kind !== recovery.kind) throw new Error("Open the correct workflow before generating.");
        return submit(draft);
      });
      return submit(draft);
    },
  };

  async function submit(draft: WorkflowGenerationDraft): Promise<WorkflowGenerationBatch> {
      if (submitting) throw new Error("This generation request is already starting.");
      const error = getWorkflowGenerationDraftError(draft);
      if (error) throw new Error(error);
      dependencies.assertActive();
      // Snapshot the click, so later edits cannot change an in-flight request.
      const settings = { ...draft.settings };
      const prompt = workflowGenerationPrompt(draft);
      const images = (draft.startingFrame ? draft.startingFramePhotos ?? [] : selectedWorkflowImages(draft)).map(image => ({ ...image }));
      const video = draft.videoReference ? { ...draft.videoReference } : draft.appScreen?.kind === "video" ? { ...draft.appScreen } : null;
      const audio = draft.audioReference ? { ...draft.audioReference } : null;
      const startingFrame = draft.startingFrame ? { ...draft.startingFrame } : null;
      const fingerprint = JSON.stringify({ kind: draft.kind, prompt, settings, images: images.map((image) => image.url), video: video?.url, audio: audio?.url, startingFrame: startingFrame ? { assetId: startingFrame.assetId, jobId: startingFrame.jobId, referenceId: startingFrame.referenceId, generateAudio: startingFrame.generateAudio } : null });
      if (pending?.attempted && pending.fingerprint !== fingerprint) {
        throw new Error("The previous request has not been confirmed. Restore its original instructions, references and settings, then retry to recover its saved status before starting a different request.");
      }
      if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, key: dependencies.createIdempotencyKey() };
      const submission = pending;
      submitting = true;
      try {
        if (!await withReadDeadline(() => dependencies.getOwnerToken(), undefined, dependencies.requestTimeoutMs ?? WORKFLOW_GENERATION_REQUEST_TIMEOUT_MS)) throw new Error("Sign in before generating a video.");
        dependencies.assertActive();
        if (!submission.body) {
          const references = await Promise.all(images.map(prepareImage));
          const referenceImageUrls = [...new Set(references.map((image) => image.url))];
          async function prepareMedia(source: WorkflowTimedSource | null, kind: "video" | "audio") {
            if (!source) return null;
            if (!dependencies.uploadReference) throw new Error("Reference uploads are unavailable. No generation was submitted.");
            dependencies.assertActive();
            const cacheKey = `${kind}:${source.url}`;
            const result = uploadedMedia.get(cacheKey) ?? await dependencies.uploadReference(source, kind);
            dependencies.assertActive();
            if (!result.url.startsWith("https://") || !REQUEST_ID.test(result.assetId) || !Number.isFinite(result.duration) || result.duration <= 0 || result.duration > 30) throw new Error("The reference file could not be verified after uploading.");
            const uploadedReferenceError = getVideoTimedReferenceError(settings.model, kind, result.duration);
            if (uploadedReferenceError) throw new Error(uploadedReferenceError);
            uploadedMedia.set(cacheKey, result);
            return result;
          }
          const videoReference = await prepareMedia(video, "video"), audioReference = await prepareMedia(audio, "audio");
          submission.body = JSON.stringify({
            prompt,
            model: settings.model,
            durationSeconds: settings.duration,
            quantity: settings.quantity,
            resolution: settings.resolution,
            aspectRatio: settings.aspectRatio,
            ...(startingFrame ? { startingFrameAssetId: startingFrame.assetId, startingFrameJobId: startingFrame.jobId, referenceId: startingFrame.referenceId, exploreFormat: "hook", generateAudio: startingFrame.generateAudio, ...(referenceImageUrls.length ? { referenceImageUrls, imageReferencePurpose: "person" } : {}) } : { avatarImageUrl: referenceImageUrls[0] ?? null, referenceImageUrls }),
            ...(videoReference ? { referenceVideoUrl: videoReference.url, referenceVideoAssetId: videoReference.assetId, referenceVideoDurationSeconds: videoReference.duration } : {}),
            ...(audioReference ? { referenceAudioUrls: [audioReference.url], referenceAudioAssetIds: [audioReference.assetId] } : {}),
            idempotencyKey: submission.key,
            ...(dependencies.recovery ? { workflowKind: draft.kind } : {}),
          });
        }
        const token = await withReadDeadline(() => dependencies.getOwnerToken(), undefined, dependencies.requestTimeoutMs ?? WORKFLOW_GENERATION_REQUEST_TIMEOUT_MS);
        if (!token) throw new Error("Sign in before generating a video.");
        dependencies.assertActive();
        if (dependencies.recovery) {
          const recovery = dependencies.recovery;
          persistWorkflowGenerationRequest(recovery.storage(), recovery.ownerId, recovery.kind, submission.key, settings.quantity);
          recovery.onChange();
        }
        submission.attempted = true;
        const { response, value } = await withReadDeadline(async signal => {
          const response = await sendRequest(dependencies.recovery ? "/api/ai-studio/videos/workflow-start" : "/api/ai-studio/videos/generate", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": submission.key },
            body: submission.body,
            signal,
          });
          signal.throwIfAborted();
          const value: unknown = await response.json().catch(() => null);
          signal.throwIfAborted();
          return { response, value };
        }, undefined, dependencies.requestTimeoutMs ?? WORKFLOW_GENERATION_REQUEST_TIMEOUT_MS);
        dependencies.assertActive();
        if (!response.ok) throw new Error(isRecord(value) && typeof value.error === "string" ? value.error : "Video generation could not start. Retry the same request to check its saved status.");
        if (dependencies.recovery) assertAtomicReceiptResponse(value, {
          requestKey: submission.key, kind: draft.kind, quantity: settings.quantity,
        }, "accepted");
        const batch = parseWorkflowGenerationBatch(value, settings.quantity);
        if (dependencies.recovery) {
          const recovery = dependencies.recovery;
          acknowledgeWorkflowGenerationRequest(recovery.storage(), recovery.ownerId, recovery.kind, submission.key, batch);
          recovery.onChange();
        }
        pending = null;
        return batch;
      } catch (error) {
        if (error instanceof ReadDeadlineError) throw new Error(submission.attempted
          ? "The generation reply took too long. Refresh status to recover the saved request before generating again."
          : "Preparing generation took too long. No generation was submitted. Try again.");
        throw error;
      } finally {
        // Keep the same key/body after a network error or an uncertain response.
        submitting = false;
      }
  }
  return client;
}

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertAtomicReceiptResponse(value: unknown, request: { requestKey: string; kind: WorkflowKind; quantity: number }, outcome: "accepted" | "not_started") {
  if (!isRecord(value) || value.ok !== true || value.receiptVersion !== 2 || value.requestKey !== request.requestKey ||
      value.kind !== request.kind || value.quantity !== request.quantity || value.outcome !== outcome || value.partial !== false ||
      !Array.isArray(value.jobs) || value.jobs.length !== (outcome === "accepted" ? request.quantity : 0) ||
      value.jobs.some(job => !isRecord(job) || typeof job.jobId !== "string" || !REQUEST_ID.test(job.jobId) ||
        typeof job.videoId !== "string" || !REQUEST_ID.test(job.videoId))) {
    throw new Error("The recovery response could not be verified. Refresh status before generating again.");
  }
}
export type WorkflowGenerationRequest = { version: 1 | 2; ownerId: string; kind: WorkflowKind; requestKey: string; quantity: 1 | 2 | 3 | 4 };
export type WorkflowGenerationRecovery = {
  ownerId: string;
  kind: WorkflowKind;
  storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem">;
  onChange: () => void;
  withLock: (work: () => Promise<WorkflowGenerationBatch>) => Promise<WorkflowGenerationBatch>;
};
export function workflowGenerationRequestStorageKey(ownerId: string, kind: WorkflowKind) {
  return `ugc-explore.request.v1.${encodeURIComponent(ownerId)}.${kind}`;
}

/** Only opaque identity is retained; never prompts, tokens, files or media URLs. */
export function readWorkflowGenerationRequest(storage: Pick<Storage, "getItem">, ownerId: string, kind: WorkflowKind): WorkflowGenerationRequest | null {
  const raw = storage.getItem(workflowGenerationRequestStorageKey(ownerId, kind));
  if (!raw) return null;
  try {
    if (raw.length > 1024) throw new Error("oversized");
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || ![1, 2].includes(Number(value.version)) || typeof value.version !== "number" || value.ownerId !== ownerId || value.kind !== kind ||
      typeof value.requestKey !== "string" || !REQUEST_ID.test(value.requestKey) || ![1, 2, 3, 4].includes(Number(value.quantity)) || typeof value.quantity !== "number") throw new Error("invalid");
    return { version: value.version as 1 | 2, ownerId, kind, requestKey: value.requestKey, quantity: value.quantity as 1 | 2 | 3 | 4 };
  } catch {
    throw new Error("The saved request cannot be verified. Contact support before starting another generation; do not clear browser storage to retry.");
  }
}

export function persistWorkflowGenerationRequest(storage: Pick<Storage, "getItem" | "setItem">, ownerId: string, kind: WorkflowKind, requestKey: string, quantity: number) {
  if (!REQUEST_ID.test(requestKey) || ![1, 2, 3, 4].includes(quantity)) throw new Error("The request identity is invalid.");
  if (readWorkflowGenerationRequest(storage, ownerId, kind)) throw new Error("A previous request is not confirmed. Refresh status first.");
  storage.setItem(workflowGenerationRequestStorageKey(ownerId, kind), JSON.stringify({ version: 2, ownerId, kind, requestKey, quantity }));
  const saved = readWorkflowGenerationRequest(storage, ownerId, kind);
  if (saved?.requestKey !== requestKey || saved.version !== 2 || saved.quantity !== quantity) throw new Error("Could not save request recovery. No generation was submitted.");
}

/** Save all acknowledged jobs BEFORE removing the uncertain-request marker. */
export function acknowledgeWorkflowGenerationRequest(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, ownerId: string, kind: WorkflowKind, requestKey: string, batch: WorkflowGenerationBatch) {
  const request = readWorkflowGenerationRequest(storage, ownerId, kind);
  if (!request || request.requestKey !== requestKey) throw new Error("The saved request identity changed. Refresh status before generating again.");
  if (request.version === 2 && (batch.partial || batch.jobs.length !== request.quantity)) {
    throw new Error("The complete saved request could not be confirmed. Refresh status before generating again.");
  }
  persistWorkflowGenerationJobs(storage, ownerId, kind, batch);
  const saved = readWorkflowGenerationJobs(storage, ownerId, kind);
  if (JSON.stringify(saved) !== JSON.stringify(batch.jobs.map((job) => job.jobId))) throw new Error("Your server jobs are saved, but browser recovery could not be confirmed. Refresh status before generating again.");
  storage.removeItem(workflowGenerationRequestStorageKey(ownerId, kind));
}

/** Automatic recovery is read-only. Explicit v2 resolution fences an unreceived request without generating anything. */
export async function recoverWorkflowGenerationRequest(dependencies: {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  ownerId: string;
  kind: WorkflowKind;
  getOwnerToken: () => Promise<string | null>;
  fetch: typeof fetch;
  assertActive: () => void;
  resolveUnreceived?: boolean;
}): Promise<{ batch: WorkflowGenerationBatch | null; resolved: boolean; message?: string }> {
  const request = readWorkflowGenerationRequest(dependencies.storage, dependencies.ownerId, dependencies.kind);
  if (!request) return { batch: null, resolved: true };
  const assertCurrentRequest = () => {
    const current = readWorkflowGenerationRequest(dependencies.storage, dependencies.ownerId, dependencies.kind);
    if (!current || current.version !== request.version || current.requestKey !== request.requestKey || current.quantity !== request.quantity) {
      throw new Error("The request was already resolved or changed in another tab. Refresh status.");
    }
  };
  dependencies.assertActive();
  const token = await dependencies.getOwnerToken();
  if (!token) throw new Error("Sign in to recover your saved request.");
  dependencies.assertActive();
  const url = `/api/ai-studio/videos/recover?requestKey=${encodeURIComponent(request.requestKey)}&quantity=${request.quantity}${request.version === 2 ? `&receipt=2&kind=${request.kind}` : ""}`;
  const { fetch: sendRequest } = dependencies;
  let response = await sendRequest(url, {
    method: "GET", cache: "no-store", headers: { Authorization: `Bearer ${token}` },
  });
  let value: unknown = await response.json().catch(() => null);
  dependencies.assertActive();
  if (request.version === 2 && dependencies.resolveUnreceived && response.ok && isRecord(value) && value.ok === true &&
      value.requestKey === request.requestKey && value.resolved === false && value.canResolve === true && Array.isArray(value.jobs) && value.jobs.length === 0) {
    assertCurrentRequest();
    const currentToken = await dependencies.getOwnerToken();
    dependencies.assertActive();
    if (!currentToken) throw new Error("Sign in to resolve your saved request.");
    assertCurrentRequest();
    response = await sendRequest(url, { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${currentToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve" }) });
    value = await response.json().catch(() => null);
    dependencies.assertActive();
  }
  if (!response.ok || !isRecord(value) || value.ok !== true || value.requestKey !== request.requestKey || !Array.isArray(value.jobs) || typeof value.resolved !== "boolean") {
    throw new Error("Could not confirm the previous request. Refresh status; no new generation has been submitted.");
  }
  if (!value.jobs.length) {
    if (value.resolved) {
      if (request.version !== 2) throw new Error("The recovery response could not be verified.");
      assertAtomicReceiptResponse(value, request, "not_started");
      assertCurrentRequest();
      dependencies.storage.removeItem(workflowGenerationRequestStorageKey(dependencies.ownerId, dependencies.kind));
      return { batch: null, resolved: true, message: "The previous request did not start. No new generation was submitted." };
    }
    return { batch: null, resolved: false };
  }
  if (request.version === 2) {
    assertAtomicReceiptResponse(value, request, "accepted");
    if (value.resolved !== true) throw new Error("The recovery response could not be verified.");
  }
  const batch = parseWorkflowGenerationBatch({ ...value, jobId: value.jobs[0]?.jobId }, request.quantity);
  if (value.resolved && batch.jobs.length !== request.quantity) throw new Error("The recovery response could not be verified.");
  assertCurrentRequest();
  if (value.resolved) acknowledgeWorkflowGenerationRequest(dependencies.storage, dependencies.ownerId, dependencies.kind, request.requestKey, batch);
  else persistWorkflowGenerationJobs(dependencies.storage, dependencies.ownerId, dependencies.kind, batch);
  return { batch, resolved: value.resolved };
}

const STORAGE_PREFIX = "ugc-explore.generation.v1.";
export function workflowGenerationStorageKey(ownerId: string, kind: WorkflowKind) {
  return `${STORAGE_PREFIX}${encodeURIComponent(ownerId)}.${kind}`;
}

export function readWorkflowGenerationJobs(storage: Pick<Storage, "getItem">, ownerId: string, kind: WorkflowKind) {
  try {
    const raw = storage.getItem(workflowGenerationStorageKey(ownerId, kind));
    if (!raw || raw.length > 4096) return [];
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || value.ownerId !== ownerId || value.kind !== kind || !Array.isArray(value.jobIds)) return [];
    const ids = value.jobIds;
    if (ids.length > 4 || ids.some((id) => typeof id !== "string" || !JOB_ID.test(id)) || new Set(ids).size !== ids.length) return [];
    return ids as string[];
  } catch { return []; }
}

export function persistWorkflowGenerationJobs(storage: Pick<Storage, "setItem">, ownerId: string, kind: WorkflowKind, batch: WorkflowGenerationBatch) {
  try {
    storage.setItem(workflowGenerationStorageKey(ownerId, kind), JSON.stringify({ version: 1, ownerId, kind, jobIds: batch.jobs.map((job) => job.jobId) }));
  } catch { /* Durable server jobs remain authoritative if browser storage is unavailable. */ }
}
