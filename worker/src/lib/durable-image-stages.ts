import sharp from "sharp";
import { createHash } from "node:crypto";
import { createGenerationRequestFingerprint, persistProviderSubmissionFailure, ProviderSubmissionUncertainError } from "./generation-provider.js";
import { RetryableJobError } from "../retryable-job-error.js";
import { downloadStoredObjectBuffer, getStoredObject, uploadBufferToStorage } from "./storage.js";
import type { SupabaseJobStore } from "./supabase.js";
import type { ImageStageRunner } from "./openrouter-gemini-image.js";

/** Each stage is bound to exact inputs. An ambiguous paid call is never replayed. */
export function createDurableImageStageRunner(params: {
  jobId: string;
  store: SupabaseJobStore;
  checkpoint: (stage: string) => Promise<void>;
  storage?: {
    get: typeof getStoredObject;
    read: typeof downloadStoredObjectBuffer;
    write: typeof uploadBufferToStorage;
  };
}): ImageStageRunner {
  const storage = params.storage ?? { get: getStoredObject, read: downloadStoredObjectBuffer, write: uploadBufferToStorage };
  return async (stage, input, action) => {
    const operationKey = `openrouter-image-${stage}-v1`;
    const fingerprint = createGenerationRequestFingerprint({ version: 1, stage, input });
    const key = `generation-staging/${params.jobId}/${operationKey}/${fingerprint}.png`;
    const base = { jobId: params.jobId, operationKey };
    await params.checkpoint(`image_${stage}`);
    const reservation = await params.store.reserveGenerationProviderOperation({
      ...base, provider: "openrouter", requestFingerprint: fingerprint,
      metadata: { pipelineVersion: 1, stage, local: stage === "harmonize" },
    });
    const existing = await storage.get(key);
    if (existing) {
      const buffer = await storage.read(key);
      await sharp(buffer, { failOn: "warning" }).raw().toBuffer();
      const previous = reservation.operation.metadata;
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      if (previous !== null && typeof previous === "object" && !Array.isArray(previous) &&
        typeof previous.sha256 === "string" && previous.sha256 !== sha256) {
        throw new Error("The saved image stage failed its checksum. No generation was resubmitted.");
      }
      const model = previous !== null && typeof previous === "object" && !Array.isArray(previous) && typeof previous.model === "string"
        ? previous.model : "google/gemini-3-pro-image";
      await params.store.markGenerationOutputPersisted({ ...base, outputReference: key, outputUrl: existing.url,
        metadata: { pipelineVersion: 1, stage, stagingKey: key, model, sha256 } });
      return { buffer, model, ...(reservation.operation.provider_operation_id ? { requestId: reservation.operation.provider_operation_id } : {}) };
    }
    // CPU work can safely rerun; paid calls require the atomic submit grant.
    if (stage !== "harmonize" && !reservation.shouldSubmit) throw new ProviderSubmissionUncertainError();
    let result;
    try {
      result = await action();
    } catch (error) {
      if (stage !== "harmonize") return persistProviderSubmissionFailure({ ...base, store: params.store, error });
      await params.store.markGenerationProviderFailed({ ...base, errorCode: "image_harmonization_failed",
        errorMessage: "Image harmonization failed; the saved identity image is retained.", retryAllowed: true });
      throw new RetryableJobError("Image harmonization failed; retry will reuse the saved identity image.",
        { code: "image_harmonization_failed", retryAfterSeconds: 30 });
    }
    // Decode and normalize before recording a usable stage. Invalid output or a
    // lost storage acknowledgement must never permit another paid submission.
    const buffer = await sharp(result.buffer, { failOn: "warning" }).png().toBuffer();
    const metadata = { pipelineVersion: 1, stage, stagingKey: key, model: result.model,
      sha256: createHash("sha256").update(buffer).digest("hex") };
    try {
      const saved = await storage.write({ buffer, key, contentType: "image/png", cacheControl: "private, max-age=86400" });
      await params.store.markGenerationProviderSucceeded({ ...base, metadata,
        // Harmonization is local, not a second provider operation with the same ID.
        ...(stage !== "harmonize" && result.requestId ? { providerOperationId: result.requestId } : {}) });
      await params.store.markGenerationOutputPersisted({ ...base, metadata, outputReference: saved.key, outputUrl: saved.url });
    } catch {
      // Retry reads the deterministic object first. A missing object cannot grant
      // another paid submission: the existing operation remains reserved/uncertain.
      throw new RetryableJobError("The image stage save is unconfirmed; recovery will check the saved output before continuing.",
        { code: "image_stage_persistence_pending", retryAfterSeconds: 30 });
    }
    return { ...result, buffer };
  };
}
