import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import fingerprints from "./studio-image-fingerprints.json" with { type: "json" };
import { findTraitById } from "./influencer-registry.ts";
import { studioCatalogUrl } from "./studio-catalog.ts";
import { getMediaAssetForOwner, upsertReadyMediaAsset, type MediaAssetRow } from "../media/media-storage.ts";
import { buildPublicStorageUrl, getStorageObject, uploadBufferToStorage } from "../storage/storage.ts";

const VERSION = "character-catalog-jpeg-v1";
const MAX_BYTES = 25 * 1024 * 1024;
export type PreparedStudioReference = { traitId: string; assetId: string };
export class StudioPreparationError extends Error {
  constructor(public traitId: string, public stage: string, public retryable = true) {
    const label = findTraitById(traitId)?.label ?? "selected reference";
    super(`Could not prepare ${label} (${stage}). Try Generate again; completed references are kept.`);
  }
}

/** Deadlines also cover response bodies and database/storage acknowledgements. Late writes are immutable and recoverable. */
export async function studioDeadline<T>(work: () => Promise<T>, ms = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Reference preparation timed out")), ms);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export function studioReferenceIdentity(userId: string, traitId: string) {
  const trait = findTraitById(traitId);
  const path = trait?.imagePath;
  const digest = path && (fingerprints as Record<string, string>)[path];
  if (!trait || trait.isCustomUpload || !path?.startsWith("/explore/influencer-studio/") || !digest) {
    throw new StudioPreparationError(traitId, "selection", false);
  }
  const hex = createHash("sha256").update(JSON.stringify([VERSION, userId, path, digest])).digest("hex");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return { id, path, digest, label: trait.label, key: `media/image/character-catalog/${id}.jpg` };
}

async function boundedBody(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing image body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) throw new Error("Reference image is too large");
      chunks.push(part.value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function fetchStudioImage(path: string, fetchImpl: typeof fetch = fetch, timeoutMs = 12_000) {
  const url = studioCatalogUrl(path);
  // Only manifest-approved immutable backend objects; never accept a client URL or follow a redirect.
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    try {
      return await studioDeadline(async () => {
        const response = await fetchImpl(url, { signal: controller.signal, redirect: "error" });
        if (!response.ok) {
          if (response.status < 500 && response.status !== 429) throw new StudioPreparationError("", "catalog image", false);
          throw new Error("Catalog temporarily unavailable");
        }
        if (!response.headers.get("content-type")?.startsWith("image/")) throw new StudioPreparationError("", "catalog image", false);
        return boundedBody(response);
      }, timeoutMs);
    } catch (error) {
      if (attempt || error instanceof StudioPreparationError && !error.retryable) throw error;
    } finally { controller.abort(); }
  }
  throw new Error("Catalog unavailable");
}

type PreparedImage = { buffer: Buffer; width: number; height: number };
export async function encodeStudioImage(buffer: Buffer): Promise<PreparedImage> {
  const result = await sharp(buffer, { limitInputPixels: 25_000_000 }).rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86 }).timeout({ seconds: 8 }).toBuffer({ resolveWithObject: true });
  return { buffer: result.data, width: result.info.width, height: result.info.height };
}

export type StudioPreparationDependencies = {
  get: typeof getMediaAssetForOwner;
  save: typeof upsertReadyMediaAsset;
  fetchImage: typeof fetchStudioImage;
  encode: typeof encodeStudioImage;
  upload: typeof uploadBufferToStorage;
  readObject: (key: string) => Promise<Buffer>;
  url: typeof buildPublicStorageUrl;
};
const defaults: StudioPreparationDependencies = {
  get: getMediaAssetForOwner, save: upsertReadyMediaAsset, fetchImage: fetchStudioImage, encode: encodeStudioImage,
  upload: uploadBufferToStorage, url: buildPublicStorageUrl,
  async readObject(key) {
    const object = await getStorageObject({ key });
    if (!object.Body || object.ContentType !== "image/jpeg" || (object.ContentLength ?? MAX_BYTES + 1) > MAX_BYTES) throw new Error("Invalid stored reference");
    return boundedBody(new Response(object.Body.transformToWebStream()));
  },
};

function validReady(row: MediaAssetRow | null, userId: string, identity: ReturnType<typeof studioReferenceIdentity>, url: string) {
  return row?.id === identity.id && row.user_id === userId && row.status === "ready" && !row.deleted_at
    && row.collection === "image" && row.project_id === "explore-catalog-reference" && row.storage_key === identity.key
    && row.source_record_id === identity.id && row.source_type === "upload" && row.url === url
    && row.mime_type === "image/jpeg" && row.width && row.height;
}

export function createStudioPreparer(dependencies: StudioPreparationDependencies = defaults) {
  // Coalesce same-instance work; deterministic IDs and create-only objects also protect across instances/reloads.
  const flights = new Map<string, Promise<string>>();
  async function prepareOne(userId: string, traitId: string) {
    const identity = studioReferenceIdentity(userId, traitId);
    const active = flights.get(identity.id);
    if (active) return active;
    const work = (async () => {
      let stage = "checking saved reference";
      const url = dependencies.url(identity.key);
      try {
        const existing = await studioDeadline(() => dependencies.get({ userId, assetId: identity.id }));
        if (existing) {
          if (!validReady(existing, userId, identity, url)) throw new StudioPreparationError(traitId, stage, false);
          return identity.id;
        }
        stage = "loading catalog image";
        const original = await dependencies.fetchImage(identity.path);
        if (createHash("sha256").update(original).digest("hex") !== identity.digest) throw new StudioPreparationError(traitId, "catalog version", false);
        stage = "preparing image";
        const image = await studioDeadline(() => dependencies.encode(original));
        stage = "saving reference image";
        try {
          await studioDeadline(() => dependencies.upload({ key: identity.key, buffer: image.buffer, contentType: "image/jpeg", createOnly: true }));
        } catch {
          // A lost upload acknowledgement or racing instance may already have committed the exact immutable object.
          const stored = await studioDeadline(() => dependencies.readObject(identity.key));
          if (!stored.equals(image.buffer)) throw new StudioPreparationError(traitId, stage);
        }
        stage = "confirming saved reference";
        try {
          const saved = await studioDeadline(() => dependencies.save({
            assetId: identity.id, sourceRecordId: identity.id, userId, collection: "image", sourceType: "upload",
            projectId: "explore-catalog-reference", fileName: `${traitId}.jpg`, title: identity.label,
            mimeType: "image/jpeg", storageKey: identity.key, url,
            fileSizeBytes: image.buffer.length, width: image.width, height: image.height, ratio: "other",
            metadata: { characterCatalogVersion: VERSION, sourceSha256: identity.digest },
          }));
          if (!validReady(saved, userId, identity, url)) throw new Error("Invalid saved receipt");
        } catch (error) {
          const recovered = await studioDeadline(() => dependencies.get({ userId, assetId: identity.id }));
          if (!validReady(recovered, userId, identity, url)) throw error;
        }
        return identity.id;
      } catch (error) {
        throw error instanceof StudioPreparationError && error.traitId === traitId
          ? error : new StudioPreparationError(traitId, stage, !(error instanceof StudioPreparationError) || error.retryable);
      }
    })();
    flights.set(identity.id, work);
    try { return await work; } finally { if (flights.get(identity.id) === work) flights.delete(identity.id); }
  }
  return async (userId: string, traitIds: string[]): Promise<PreparedStudioReference[]> => {
    // Validate the complete batch before doing work; result positions always follow the user's original role order.
    traitIds.forEach(id => studioReferenceIdentity(userId, id));
    const results: PreparedStudioReference[] = new Array(traitIds.length);
    let cursor = 0;
    let failure: unknown;
    const workers = Array.from({ length: Math.min(3, traitIds.length) }, async () => {
      while (!failure && cursor < traitIds.length) {
        const index = cursor++;
        try { results[index] = { traitId: traitIds[index], assetId: await prepareOne(userId, traitIds[index]) }; }
        catch (error) { failure ??= error; }
      }
    });
    await Promise.all(workers);
    if (failure) throw failure;
    return results;
  };
}
export const prepareStudioReferences = createStudioPreparer();
