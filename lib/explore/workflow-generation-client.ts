import { AI_STUDIO_KLING_PROMPT_MAX_LENGTH, AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH, getAIStudioPromptLengthError, normalizeAIStudioPrompt } from "../ai-studio/prompt-policy";
import { normalizeWorkflowGenerationSettings, type WorkflowGenerationSettings } from "./workflow-generation-settings";

export type WorkflowKind = "hook" | "phone";
export type WorkflowImageSource = { name: string; url: string; file?: File };
export type WorkflowTimedSource = { url: string; name?: string; duration?: number | null; file?: File };
export type WorkflowGenerationDraft = {
  kind: WorkflowKind;
  instructions: string;
  settings: WorkflowGenerationSettings;
  creator: WorkflowImageSource | null;
  appScreen?: (WorkflowImageSource & { kind: "image" | "video"; duration?: number | null }) | null;
  videoReference: WorkflowTimedSource | null;
  audioReference: WorkflowTimedSource | null;
  referencesPending?: boolean;
};
export type WorkflowGenerationBatch = {
  jobs: { jobId: string; videoId: string }[];
  partial: boolean;
  message: string;
};

const JOB_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

export function getWorkflowGenerationDraftError(draft: WorkflowGenerationDraft) {
  if (draft.referencesPending) return "Wait for your selected files to finish loading.";
  const prompt = normalizeAIStudioPrompt(draft.instructions);
  if (!prompt) return "Write your instructions before generating a video.";
  const lengthError = getAIStudioPromptLengthError(prompt, draft.settings.model === "kling_3_0" ? AI_STUDIO_KLING_PROMPT_MAX_LENGTH : AI_STUDIO_VIDEO_PROMPT_MAX_LENGTH);
  if (lengthError) return lengthError;
  if (draft.settings.model === "kling_3_0" && prompt.length < 2) return "Kling 3.0 requires a prompt of at least 2 characters.";
  const validSettings = normalizeWorkflowGenerationSettings(draft.settings);
  if ((Object.keys(validSettings) as (keyof WorkflowGenerationSettings)[]).some((key) => validSettings[key] !== draft.settings[key])) {
    return "These generation settings are unavailable. Choose a supported model, duration and quality.";
  }
  // Reject before uploading or spending. Never quietly discard an attached input.
  const videos = [draft.videoReference, draft.appScreen?.kind === "video" ? draft.appScreen : null].filter(Boolean) as WorkflowTimedSource[];
  if ((videos.length || draft.audioReference) && draft.settings.model !== "seedance_2_5") return "Choose Seedance 2.5 to use reference audio or video through OpenRouter. These inputs guide generation; they are not background music or a demo.";
  if (videos.length > 1) return "Use one reference video: either Choose video or an app recording, not both.";
  for (const source of [...videos, ...(draft.audioReference ? [draft.audioReference] : [])]) {
    if (!source.file || !Number.isFinite(source.duration) || !source.duration || source.duration <= 0 || source.duration > 30) return "Choose a reference audio or video file up to 30 seconds. Files are not shortened automatically.";
    const audio = source === draft.audioReference;
    if (!source.file.type.startsWith(audio ? "audio/" : "video/") || !Number.isFinite(source.file.size) || source.file.size <= 0 || source.file.size > (audio ? 25 : 250) * 1024 ** 2) return "Use a playable reference audio file up to 25 MB or video up to 250 MB.";
  }
  for (const image of [draft.creator, draft.appScreen?.kind === "image" ? draft.appScreen : null]) {
    if (image?.file && (!["image/png", "image/jpeg", "image/webp"].includes(image.file.type) || !Number.isFinite(image.file.size) || image.file.size <= 0 || image.file.size > 20 * 1024 ** 2)) {
      return "Use a PNG, JPEG or WebP reference image up to 20 MB.";
    }
  }
  if (draft.kind === "phone" && draft.appScreen && draft.settings.model === "kling_3_0") {
    return "Choose Omni Flash 1.1 or an enabled Seedance 2.5 to use an app screenshot. Kling uses its images as first/last frames, not as an app-screen reference.";
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
}) {
  const uploaded = new Map<string, { url: string }>();
  const uploadedMedia = new Map<string, { url: string; assetId: string; duration: number }>();
  let pending: { fingerprint: string; key: string; body?: string; attempted?: boolean } | null = null;
  let submitting = false;

  async function prepareImage(image: WorkflowImageSource) {
    const cached = uploaded.get(image.url);
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
      const prompt = normalizeAIStudioPrompt(draft.instructions);
      const selectedImages = [draft.creator, draft.appScreen?.kind === "image" ? draft.appScreen : null].filter((image): image is WorkflowImageSource => Boolean(image));
      const images = [...new Map(selectedImages.map((image) => [image.url, image])).values()];
      const video = draft.videoReference ? { ...draft.videoReference } : draft.appScreen?.kind === "video" ? { ...draft.appScreen } : null;
      const audio = draft.audioReference ? { ...draft.audioReference } : null;
      const fingerprint = JSON.stringify({ kind: draft.kind, prompt, settings, images: images.map((image) => image.url), video: video?.url, audio: audio?.url });
      if (pending?.attempted && pending.fingerprint !== fingerprint) {
        throw new Error("The previous request has not been confirmed. Restore its original instructions, references and settings, then retry to recover its saved status before starting a different request.");
      }
      if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, key: dependencies.createIdempotencyKey() };
      const submission = pending;
      submitting = true;
      try {
        if (!await dependencies.getOwnerToken()) throw new Error("Sign in before generating a video.");
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
            avatarImageUrl: referenceImageUrls[0] ?? null,
            referenceImageUrls,
            ...(videoReference ? { referenceVideoUrl: videoReference.url, referenceVideoAssetId: videoReference.assetId, referenceVideoDurationSeconds: videoReference.duration } : {}),
            ...(audioReference ? { referenceAudioUrls: [audioReference.url], referenceAudioAssetIds: [audioReference.assetId] } : {}),
            idempotencyKey: submission.key,
            ...(dependencies.recovery ? { workflowKind: draft.kind } : {}),
          });
        }
        const token = await dependencies.getOwnerToken();
        if (!token) throw new Error("Sign in before generating a video.");
        dependencies.assertActive();
        if (dependencies.recovery) {
          const recovery = dependencies.recovery;
          persistWorkflowGenerationRequest(recovery.storage(), recovery.ownerId, recovery.kind, submission.key, settings.quantity);
          recovery.onChange();
        }
        submission.attempted = true;
        const response = await dependencies.fetch(dependencies.recovery ? "/api/ai-studio/videos/workflow-start" : "/api/ai-studio/videos/generate", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": submission.key },
          body: submission.body,
        });
        const value: unknown = await response.json().catch(() => null);
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
export type WorkflowGenerationRequest = { version: 1 | 2; ownerId: string; kind: WorkflowKind; requestKey: string; quantity: 1 | 2 | 4 };
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
      typeof value.requestKey !== "string" || !REQUEST_ID.test(value.requestKey) || ![1, 2, 4].includes(Number(value.quantity)) || typeof value.quantity !== "number") throw new Error("invalid");
    return { version: value.version as 1 | 2, ownerId, kind, requestKey: value.requestKey, quantity: value.quantity as 1 | 2 | 4 };
  } catch {
    throw new Error("The saved request cannot be verified. Contact support before starting another generation; do not clear browser storage to retry.");
  }
}

export function persistWorkflowGenerationRequest(storage: Pick<Storage, "getItem" | "setItem">, ownerId: string, kind: WorkflowKind, requestKey: string, quantity: number) {
  if (!REQUEST_ID.test(requestKey) || ![1, 2, 4].includes(quantity)) throw new Error("The request identity is invalid.");
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
  let response = await dependencies.fetch(url, {
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
    response = await dependencies.fetch(url, { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${currentToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve" }) });
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
