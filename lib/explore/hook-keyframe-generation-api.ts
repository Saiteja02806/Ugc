import "server-only";
import { createHash } from "node:crypto";
import { requireAIStudioProUser } from "../ai-studio/server-access";
import { FirebaseAuthRequestError } from "../firebase/server-auth";
import { BillingAccessError, getGenerationCreditCost, reserveBillingCredits } from "../billing/subscription-db";
import { getBackgroundJobByIdempotencyKey, getBackgroundJobForUser, getMissingBackgroundJobStorageEnvVars, type BackgroundJobRecord } from "../jobs/background-jobs";
import { createAndDispatchBackgroundJob } from "../jobs/background-job-service";
import { getMissingJobQueueEnvVars } from "../queues/job-queue";
import { canonicalMediaReference, isTrustedMediaReferenceUrl } from "../media/media-reference";
import { getMediaAssetForOwner } from "../media/media-storage";
import { isPrivateUserMedia } from "../media/media-delivery";
import { privateMediaHead } from "../media/private-media-storage";
import { getMissingStorageEnvVars, headStorageObject, uploadBufferToStorage } from "../storage/storage";
import { getHookSourceFrame, HookSourceFrameError } from "./hook-source-frame.ts";
import { buildHookKeyframeImagePrompt } from "./hook-keyframe-image-prompt.ts";
import { HOOK_KEYFRAME_MAX_CONTEXT_BYTES, HOOK_KEYFRAME_MAX_PERSON_IMAGE_BYTES, hookKeyframeGenerationInputKey, hookKeyframePromptSha256, hookKeyframeSnapshotKey, hookKeyframeSourceRatio, isHookKeyframeImageInput, type HookKeyframeGenerationReceipt } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import { HookKeyframeGenerationError, hookKeyframeReceiptFromJob, resolveOwnedHookKeyframeResult } from "./hook-keyframe-result.ts";

export { resolveApprovedHookStartingFrame } from "./hook-keyframe-result.ts";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const errorResponse = (message: string, status: number) => Response.json({ ok: false, message }, { status, headers });
const requestStorageKey = (ownerId: string, key: string) => `hook-keyframe:${createHash("sha256").update(JSON.stringify([ownerId, key])).digest("hex")}`;
// Coalesce simultaneous deliveries in one instance. Durable job and billing
// idempotency remain the cross-instance safeguards; this is not a transaction.
const inFlight = new Map<string, { preparation: string; job: Promise<BackgroundJobRecord> }>();
function errorResult(error: unknown) {
  if (error instanceof HookKeyframeGenerationError || error instanceof HookSourceFrameError || error instanceof FirebaseAuthRequestError || error instanceof BillingAccessError) return errorResponse(error.message, error.status);
  console.error("Hook starting-image request could not be completed:", error instanceof Error ? error.name : "unknown");
  return errorResponse("The starting-image request could not be confirmed. Check its saved status before trying again.", 503);
}
async function readRequest(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim() !== "application/json" || !request.body) throw new HookKeyframeGenerationError("Send a valid starting-image preparation.", 400);
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength;
    if (size > 16_384) throw new HookKeyframeGenerationError("This preparation is too large.", 413); chunks.push(next.value); }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  let input: unknown; try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HookKeyframeGenerationError("Send a valid starting-image preparation.", 400); }
  if (!record(input) || Object.keys(input).some(key => !["referenceId", "sourceSha256", "draftId", "personImageAssetIds", "instructions", "idempotencyKey"].includes(key)) ||
    typeof input.referenceId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(input.referenceId) ||
    typeof input.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.sourceSha256) ||
    typeof input.draftId !== "string" || !uuid.test(input.draftId) || typeof input.idempotencyKey !== "string" || !uuid.test(input.idempotencyKey) ||
    !Array.isArray(input.personImageAssetIds) || input.personImageAssetIds.length < 1 || input.personImageAssetIds.length > 5 ||
    input.personImageAssetIds.some(id => typeof id !== "string" || !uuid.test(id)) || new Set(input.personImageAssetIds.map(id => String(id).toLowerCase())).size !== input.personImageAssetIds.length ||
    typeof input.instructions !== "string" || input.instructions.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(input.instructions)) throw new HookKeyframeGenerationError("Choose a Hook, one main face photo and up to four supporting views with valid instructions.", 400);
  return input as { referenceId: string; sourceSha256: string; draftId: string; personImageAssetIds: string[]; instructions: string; idempotencyKey: string };
}
function samePreparation(receipt: HookKeyframeGenerationReceipt, input: Awaited<ReturnType<typeof readRequest>>) {
  return receipt.referenceId === input.referenceId && receipt.sourceSha256 === input.sourceSha256 && receipt.draftId === input.draftId &&
    receipt.instructions === input.instructions && JSON.stringify(receipt.personImageAssetIds) === JSON.stringify(input.personImageAssetIds);
}
function queuedResponse(job: BackgroundJobRecord, ownerId: string) {
  const { receipt, generationId } = hookKeyframeReceiptFromJob(job, ownerId);
  const input = record(job.input) ? job.input : {};
  return Response.json({ ok: true, jobId: job.id, generationId, receipt, creditCost: input.creditCost ?? getGenerationCreditCost("image") }, { status: 202, headers });
}
export async function handleHookKeyframeGeneration(request: Request) {
  if (process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION !== "true") return errorResponse("Starting-image generation is not enabled.", 404);
  try {
    const user = await requireAIStudioProUser(request), input = await readRequest(request);
    const key = requestStorageKey(user.uid, input.idempotencyKey);
    const preparation = JSON.stringify([input.referenceId, input.sourceSha256, input.draftId, input.personImageAssetIds, input.instructions]);
    const pending = inFlight.get(key);
    if (pending) {
      if (pending.preparation !== preparation) throw new HookKeyframeGenerationError("This request ID already belongs to different image instructions. Recover its saved result.", 409);
      return queuedResponse(await pending.job, user.uid);
    }
    const submission = submitPreparation(user.uid, input, key);
    inFlight.set(key, { preparation, job: submission });
    try { return queuedResponse(await submission, user.uid); }
    finally { if (inFlight.get(key)?.job === submission) inFlight.delete(key); }
  } catch (error) { return errorResult(error); }
}
async function submitPreparation(ownerId: string, input: Awaited<ReturnType<typeof readRequest>>, key: string) {
    const previous = await getBackgroundJobByIdempotencyKey(key, { userId: ownerId, jobType: "generate_image" });
    if (previous) {
      const { receipt } = hookKeyframeReceiptFromJob(previous, ownerId);
      if (!samePreparation(receipt, input)) throw new HookKeyframeGenerationError("This request ID already belongs to different image instructions. Recover its saved result.", 409);
      return previous;
    }
    if ([...getMissingBackgroundJobStorageEnvVars(), ...getMissingJobQueueEnvVars(["generate_image"]), ...getMissingStorageEnvVars()].length) throw new HookKeyframeGenerationError("Starting-image generation is not configured.", 501);
    const photos = await Promise.all(input.personImageAssetIds.map(async id => {
      const asset = await getMediaAssetForOwner({ assetId: id, userId: ownerId });
      if (!asset || asset.user_id !== ownerId || asset.deleted_at !== null || asset.status !== "ready" || !["image", "influencer"].includes(asset.collection) ||
        !["image/png", "image/jpeg", "image/webp"].includes(asset.mime_type)) throw new HookKeyframeGenerationError("A selected face photo is unavailable. Choose it again.", 400);
      const url = await canonicalMediaReference(asset.url, ownerId);
      if (typeof url !== "string" || !isTrustedMediaReferenceUrl(url)) throw new HookKeyframeGenerationError("A selected face photo is unavailable.", 400);
      // Generated portraits may have no saved file-size metadata. Read the
      // actual owned object; client-declared upload sizes are not admission proof.
      const object = isPrivateUserMedia(asset) ? await privateMediaHead(asset.storage_key) : await headStorageObject({ key: asset.storage_key });
      const bytes = object.ContentLength, mime = object.ContentType?.split(";", 1)[0].trim().toLowerCase();
      if (!Number.isSafeInteger(bytes) || !bytes || bytes < 0 || bytes > HOOK_KEYFRAME_MAX_PERSON_IMAGE_BYTES || mime !== asset.mime_type) throw new HookKeyframeGenerationError("A selected face photo is empty, exceeds 25 MiB or no longer matches its saved type.", 400);
      return { url, bytes };
    }));
    if (new Set(photos.map(photo => photo.url)).size !== photos.length) throw new HookKeyframeGenerationError("Choose distinct face photos rather than duplicate copies.", 400);
    const frame = await getHookSourceFrame(input.referenceId);
    if (frame.sourceSha256 !== input.sourceSha256) throw new HookKeyframeGenerationError("The Hook source changed. Refresh its opening frame before generating.", 409);
    if (photos.reduce((total, photo) => total + photo.bytes, frame.png.byteLength) > HOOK_KEYFRAME_MAX_CONTEXT_BYTES) throw new HookKeyframeGenerationError("The scene and face photos exceed 50 MiB combined. Choose fewer or smaller face photos.", 400);
    const aspectRatio = hookKeyframeSourceRatio(frame.width, frame.height);
    if (!aspectRatio) throw new HookKeyframeGenerationError("This Hook's frame shape is not supported without changing its composition.", 400);
    const prompt = buildHookKeyframeImagePrompt({ personImageCount: photos.length, instructions: input.instructions }).prompt;
    const partial = { ownerId, draftId: input.draftId, referenceId: input.referenceId, sourceSha256: frame.sourceSha256,
      sourceFrame: { index: 0 as const, timeSeconds: 0 as const, width: frame.width, height: frame.height, sha256: frame.frameSha256 },
      personImageAssetIds: input.personImageAssetIds, instructions: input.instructions };
    const receipt: HookKeyframeGenerationReceipt = { ...partial, version: 1, purpose: "hook_starting_frame", promptVersion: 1,
      inputKey: hookKeyframeGenerationInputKey(partial), promptSha256: hookKeyframePromptSha256(prompt) };
    // Only already-public canonical source pixels are stored here. No portraits,
    // account ID or draft ID enter this content-addressed snapshot path.
    const snapshot = await uploadBufferToStorage({ key: hookKeyframeSnapshotKey(receipt),
      buffer: frame.png, contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" });
    const referenceImageUrls = [snapshot.url, ...photos.map(photo => photo.url)];
    if (!isTrustedMediaReferenceUrl(snapshot.url) || !isHookKeyframeImageInput({ receipt, ownerId, model: "nano_banana_2", aspectRatio, prompt,
      referenceImageUrl: snapshot.url, referenceImageUrls })) throw new HookKeyframeGenerationError("The Hook scene snapshot could not be verified. No generation was submitted.", 503);
    const creditCost = getGenerationCreditCost("image");
    await reserveBillingCredits({ amount: creditCost, idempotencyKey: key, jobType: "generate_image", userId: ownerId });
    // Use the existing image reservation/job primitives. An uncertain dispatch is
    // retained for recovery, never refunded or retried as a new paid generation.
    const job = await createAndDispatchBackgroundJob({ jobType: "generate_image", userId: ownerId, projectId: "hook-starting-frame", idempotencyKey: key, maxAttempts: 1,
      input: { generationId: crypto.randomUUID(), model: "nano_banana_2", aspectRatio, prompt, referenceImageUrl: snapshot.url,
        referenceImageUrls, hookKeyframe: receipt, exploreFormat: "hook", creditCost, batchSize: 1, batchIndex: 1 },
    }, { beforeDispatch: async stored => {
      const existing = hookKeyframeReceiptFromJob(stored, ownerId);
      if (!samePreparation(existing.receipt, input) || existing.receipt.inputKey !== receipt.inputKey) throw new HookKeyframeGenerationError("This request ID belongs to different work. Recover its original result.", 409);
    } });
    return job;
}
export async function handleHookKeyframeStatus(request: Request) {
  if (process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION !== "true") return errorResponse("Starting-image generation is not enabled.", 404);
  try {
    const user = await requireAIStudioProUser(request), query = new URL(request.url).searchParams;
    if (query.size !== 1) throw new HookKeyframeGenerationError("Choose a valid starting-image request.", 400);
    if (query.get("cost") === "1") return Response.json({ ok: true, creditCost: getGenerationCreditCost("image"), model: "nano_banana_2" }, { headers });
    const jobId = query.get("jobId"), requestKey = query.get("requestKey");
    if (!uuid.test(jobId ?? requestKey ?? "")) throw new HookKeyframeGenerationError("Choose a valid starting-image request.", 400);
    const job = jobId ? await getBackgroundJobForUser({ jobId, userId: user.uid })
      : await getBackgroundJobByIdempotencyKey(requestStorageKey(user.uid, requestKey!), { userId: user.uid, jobType: "generate_image" });
    if (!job) throw new HookKeyframeGenerationError("The request has not been confirmed. Keep its saved request ID and check again; do not create a replacement request.", 404);
    const { receipt, generationId } = hookKeyframeReceiptFromJob(job, user.uid);
    const input = record(job.input) ? job.input : {};
    let output = null;
    if (job.status === "completed") {
      const raw = record(job.output) ? job.output : null;
      if (!raw || typeof raw.mediaAssetId !== "string") throw new HookKeyframeGenerationError("The completed image is still being collected. Check this saved request again.", 409);
      output = (await resolveOwnedHookKeyframeResult({ assetId: raw.mediaAssetId, imageJobId: job.id, ownerId: user.uid })).output;
    }
    return Response.json({ ok: true, creditCost: input.creditCost ?? getGenerationCreditCost("image"), job: { id: job.id, status: job.status,
      isTerminal: ["completed", "failed", "cancelled"].includes(job.status), error: job.errorMessage, generationId, receipt, output } }, { headers });
  } catch (error) { return errorResult(error); }
}
