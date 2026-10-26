import "server-only";
import { createHash } from "node:crypto";
import { getStorageObject, uploadBufferToStorage } from "../storage/storage.ts";
import { withReadDeadline } from "../http/read-deadline.ts";
import { hookKeyframeSnapshotKey } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import type { HookSourceFrame } from "./hook-source-frame.ts";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const MAX_FRAME_BYTES = 16 * 1024 ** 2;
type FrameIndex = { version: 1; extractor: "frame0-png-v1"; sourceSha256: string; frameSha256: string; width: number; height: number };
export type HookFrameObjectStore = {
  read: (key: string, limit: number) => Promise<Buffer | null>;
  create: (key: string, bytes: Buffer, contentType: string) => Promise<void>;
};
export function hookSourceFrameIndexKey(sourceSha256: string) {
  if (!validHash(sourceSha256)) throw new Error("Invalid source frame identity.");
  return `explore/hook-starting-frames/index-v1/${sourceSha256}/frame0-png-v1.json`;
}
function validateIndex(value: unknown, sourceSha256: string): FrameIndex {
  const v = value as FrameIndex;
  if (!v || v.version !== 1 || v.extractor !== "frame0-png-v1" || v.sourceSha256 !== sourceSha256 || !validHash(v.frameSha256) ||
    ![v.width, v.height].every(n => Number.isInteger(n) && n > 0 && n <= 4096) || v.width * v.height > 16_777_216) throw new Error("The stored starting frame needs review.");
  return v;
}
function validateBytes(png: Buffer, index: FrameIndex) {
  if (png.length < 33 || png.length > MAX_FRAME_BYTES || !png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
    png.toString("ascii", 12, 16) !== "IHDR" || png.readUInt32BE(16) !== index.width || png.readUInt32BE(20) !== index.height || hash(png) !== index.frameSha256) {
    throw new Error("The stored starting frame could not be verified.");
  }
}
function missing(error: unknown) {
  const e = error as { code?: unknown; name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.code === 404 || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}
export const hookFrameObjectStore: HookFrameObjectStore = {
  read: (key, limit) => withReadDeadline(async signal => {
    let object;
    try { object = await getStorageObject({ key }); } catch (error) { if (missing(error)) return null; throw error; }
    const reader = object.Body?.transformToWebStream().getReader();
    if (!reader) throw new Error("Stored starting frame has no body.");
    const abort = () => { void reader.cancel().catch(() => undefined); };
    signal.addEventListener("abort", abort, { once: true });
    try {
      signal.throwIfAborted();
      if (object.ContentLength !== undefined && object.ContentLength > limit) throw new Error("Stored starting frame exceeds its size limit.");
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) {
        const next = await reader.read(); signal.throwIfAborted(); if (next.done) break;
        length += next.value.length; if (length > limit) throw new Error("Stored starting frame exceeds its size limit."); chunks.push(next.value);
      }
      return Buffer.concat(chunks);
    } finally { signal.removeEventListener("abort", abort); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }, undefined, 30_000),
  create: async (key, bytes, contentType) => {
    try { await uploadBufferToStorage({ key, buffer: bytes, contentType, createOnly: true, cacheControl: "public, max-age=31536000, immutable" }); }
    catch (error) { if ((error as { code?: number })?.code !== 412) throw error; }
  },
};

export function createStoredHookFrames(objects: HookFrameObjectStore = hookFrameObjectStore) {
  async function read(sourceSha256: string): Promise<Omit<HookSourceFrame, "referenceId"> | null> {
    const raw = await objects.read(hookSourceFrameIndexKey(sourceSha256), 2048);
    if (!raw) return null;
    const index = validateIndex(JSON.parse(raw.toString("utf8")), sourceSha256);
    const key = hookKeyframeSnapshotKey({ sourceSha256, sourceFrame: { sha256: index.frameSha256, index: 0, timeSeconds: 0, width: index.width, height: index.height } });
    const png = await objects.read(key, MAX_FRAME_BYTES);
    if (!png) throw new Error("The prepared starting frame is missing. It needs to be restored.");
    validateBytes(png, index);
    return { sourceSha256, frameSha256: index.frameSha256, frameIndex: 0, frameTimeSeconds: 0, width: index.width, height: index.height, png };
  }
  async function prepare(sourceSha256: string, extract: () => Promise<HookSourceFrame>) {
    const existing = await read(sourceSha256); if (existing) return existing;
    const frame = await extract();
    if (frame.referenceId.startsWith("creator-account-") || frame.sourceSha256 !== sourceSha256 || frame.frameIndex !== 0 || frame.frameTimeSeconds !== 0) throw new Error("Only ordinary public frame zero can be stored here.");
    const index = validateIndex({ version: 1, extractor: "frame0-png-v1", sourceSha256, frameSha256: frame.frameSha256, width: frame.width, height: frame.height }, sourceSha256);
    validateBytes(frame.png, index);
    const imageKey = hookKeyframeSnapshotKey({ sourceSha256, sourceFrame: { index: 0, timeSeconds: 0, sha256: frame.frameSha256, width: frame.width, height: frame.height } });
    await objects.create(imageKey, frame.png, "image/png");
    const verified = await objects.read(imageKey, MAX_FRAME_BYTES);
    if (!verified) throw new Error("Starting frame upload could not be confirmed.");
    validateBytes(verified, index);
    // Publish the pointer last. Concurrent preparers cannot overwrite the winner.
    await objects.create(hookSourceFrameIndexKey(sourceSha256), Buffer.from(JSON.stringify(index)), "application/json");
    const accepted = await read(sourceSha256);
    if (!accepted) throw new Error("Starting frame preparation could not be confirmed.");
    return accepted;
  }
  return { read, prepare };
}
