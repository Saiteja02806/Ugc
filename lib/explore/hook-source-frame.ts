import "server-only";
import talkingFrames from "./talking-head-frames.json" with { type: "json" };
import { getCuratedHookFrame, hasCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";

import { buildPublicStorageUrl } from "../storage/storage.ts";
import { getHookReferenceGalleryItems, type HookReferenceReleaseItem } from "../../worker/src/lib/explore-hook-reference-release.ts";

const MAX_VIDEO_BYTES = 64 * 1024 ** 2;
const MAX_FRAME_BYTES = 16 * 1024 ** 2;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export class HookSourceFrameError extends Error {
  constructor(message: string, public status = 503) {
    super(message);
    this.name = "HookSourceFrameError";
  }
}

export type HookSourceFrame = {
  workflow?: "hook" | "wall_text" | "talking_head";
  referenceId: string;
  sourceSha256: string;
  frameSha256: string;
  frameIndex: number;
  frameTimeSeconds: number;
  width: number;
  height: number;
  png: Buffer;
};

type Source = Pick<HookReferenceReleaseItem, "id" | "videoStorageKey" | "videoSha256" | "width" | "height"> & {
  workflow?: "hook" | "wall_text" | "talking_head"; localFile?: string;
};
type Frame = Omit<HookSourceFrame, "referenceId">;

export async function resolveStartingFrameSource(referenceId: string): Promise<Source> {
  const hook = getHookReferenceGalleryItems().find(item => item.id === referenceId);
  if (hook) return checkedSource(referenceId, [hook]);
  const { getAdditionalStartingFrameSources } = await import("./starting-frame-reference-source.ts");
  return checkedSource(referenceId, getAdditionalStartingFrameSources());
}

function checkedSource(referenceId: string, items: Source[]) {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(referenceId)) {
    throw new HookSourceFrameError("Choose a video from the reference library.", 400);
  }
  const source = items.find(item => item.id === referenceId);
  if (!source) throw new HookSourceFrameError("This video is no longer available. Choose another reference.", 404);
  const local = source.workflow === "talking_head" && source.localFile === `/explore/talking-head-references/v1/${source.id}.mp4`;
  const unknownDimensions = source.workflow === "wall_text" && source.width === 0 && source.height === 0;
  if (!/^[a-f0-9]{64}$/.test(source.videoSha256)
    || !local && (!source.videoStorageKey.startsWith("explore/")
    || source.videoStorageKey.includes("..")
    || !source.videoStorageKey.endsWith(`/${source.videoSha256}.mp4`))
    || !unknownDimensions && ![source.width, source.height].every(value => Number.isInteger(value) && value > 0 && value <= 4096)
    || source.width * source.height > 16_777_216) {
    throw new HookSourceFrameError("This Hook needs a source review before a starting frame can be prepared.", 409);
  }
  return source;
}

/** One bounded, non-redirecting read of a server-resolved canonical source. */
async function downloadSource(url: string) {
  const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) });
  const declared = response.headers.get("content-length");
  if (!response.ok || !response.body
    || response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "video/mp4"
    || declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_VIDEO_BYTES)) {
    await response.body?.cancel();
    throw new HookSourceFrameError("The original Hook could not be loaded. Try again.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_VIDEO_BYTES) throw new HookSourceFrameError("This Hook is too large to prepare a starting frame.");
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (size < 32) throw new HookSourceFrameError("The original Hook is incomplete. Choose another reference.");
  return Buffer.concat(chunks);
}

/** Decode frame zero. No seek, resize, poster substitution or paid service. */
export async function decodeHookFirstFrame(video: Uint8Array, ffmpegPath?: string): Promise<Buffer> {
  if (video.byteLength < 32 || video.byteLength > MAX_VIDEO_BYTES) {
    throw new HookSourceFrameError("The original Hook is incomplete or too large.");
  }
  const directory = await mkdtemp(join(tmpdir(), "ugc-hook-frame-"));
  try {
    const sourcePath = join(directory, "source.mp4");
    await writeFile(sourcePath, video);
    const binary = ffmpegPath ?? ffmpegStatic;
    if (!binary) throw new HookSourceFrameError("Starting-frame preparation is not configured.");
    return await new Promise<Buffer>((resolve, reject) => {
      const process = spawn(binary, [
        "-nostdin", "-hide_banner", "-loglevel", "error", "-threads", "1",
        "-format_whitelist", "mov", "-protocol_whitelist", "file,pipe", "-i", sourcePath,
        "-map", "0:v:0", "-frames:v", "1", "-an", "-sn", "-dn", "-threads", "1",
        "-f", "image2pipe", "-vcodec", "png", "pipe:1",
      ], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let size = 0;
      let exceeded = false;
      let timedOut = false;
      const chunks: Uint8Array[] = [];
      const timer = setTimeout(() => { timedOut = true; process.kill(); }, 30_000);
      process.stdout.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_FRAME_BYTES) { exceeded = true; process.kill(); }
        else chunks.push(chunk);
      });
      // Drain diagnostics without returning paths, binary details or source data.
      process.stderr.on("data", () => undefined);
      process.once("error", () => {
        clearTimeout(timer);
        reject(new HookSourceFrameError("Starting-frame preparation is unavailable. Try again later."));
      });
      process.once("close", code => {
        clearTimeout(timer);
        if (code !== 0 || exceeded || timedOut || !size) {
          reject(new HookSourceFrameError(timedOut
            ? "Starting-frame preparation timed out. Try again."
            : "The first frame could not be decoded. Choose another Hook."));
        } else resolve(Buffer.concat(chunks));
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function checkedFrame(png: Buffer, source: Source): Frame {
  if (png.length < 33 || png.length > MAX_FRAME_BYTES || !png.subarray(0, 8).equals(PNG_SIGNATURE)
    || png.toString("ascii", 12, 16) !== "IHDR") {
    throw new HookSourceFrameError("A complete starting image could not be prepared.");
  }
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 4096)
    || width * height > 16_777_216 || source.width !== 0 && (width !== source.width || height !== source.height)) {
    throw new HookSourceFrameError("This Hook's dimensions changed. Its starting frame needs review.", 409);
  }
  return { sourceSha256: source.videoSha256, frameSha256: createHash("sha256").update(png).digest("hex"),
    frameIndex: 0, frameTimeSeconds: 0, width, height, png };
}

/**
 * Process-local, bounded cache of public reference stills. Auth is checked for
 * every HTTP request, including cache hits. Nothing is uploaded or saved to DB.
 */
export function createHookSourceFrameService(options: {
  items?: () => Source[];
  sourceUrl?: (key: string) => string;
  download?: (url: string) => Promise<Buffer>;
  decode?: (video: Uint8Array) => Promise<Buffer>;
  now?: () => number;
  maxCacheBytes?: number;
  maxCacheEntries?: number;
  cacheTtlMs?: number;
  maxConcurrent?: number;
  /** A stored-only read never falls through to MP4 decoding on a cache miss. */
  readStoredFrame?: (sourceSha256: string) => Promise<Frame | null>;
  storedOnly?: boolean;
  /** Internal full-recreation preparation can require canonical frame zero even
   * when the ordinary UI preview uses a reviewed later clarity frame. */
  useCuratedFrame?: boolean;
} = {}) {
  const now = options.now ?? Date.now;
  const cache = new Map<string, { frame: Frame; expires: number }>();
  const pending = new Map<string, Promise<Frame>>();
  const byteLimit = options.maxCacheBytes ?? 24 * 1024 ** 2;
  const entryLimit = options.maxCacheEntries ?? 8;
  let cachedBytes = 0;
  const drop = (key: string) => {
    const entry = cache.get(key);
    if (entry) { cachedBytes -= entry.frame.png.length; cache.delete(key); }
  };
  const remember = (key: string, frame: Frame) => {
    if (frame.png.length <= byteLimit && entryLimit > 0) {
      drop(key);
      while (cache.size >= entryLimit || cachedBytes + frame.png.length > byteLimit) {
        const oldest = cache.keys().next().value;
        if (!oldest) break;
        drop(oldest);
      }
      cache.set(key, { frame, expires: now() + (options.cacheTtlMs ?? 5 * 60_000) });
      cachedBytes += frame.png.length;
    }
    return frame;
  };
  return async function getHookSourceFrame(referenceId: string, retainedSha256?: string): Promise<HookSourceFrame> {
    if (!options.items && referenceId.startsWith("creator-account-")) {
      // The HTTP boundary verifies the allowlisted identity on every request.
      // This local read never publishes a source frame or calls a provider.
      const { readCreatorStartingFrame, getCreatorAccountSource } = await import("./creator-accounts.ts");
      const requested = options.useCuratedFrame === false ? getCreatorAccountSource(referenceId)?.posterSha256 : retainedSha256;
      const object = await readCreatorStartingFrame(referenceId,requested);
      if (!object) throw new HookSourceFrameError("This reference is unavailable.", 404);
      const source = { id: referenceId, videoSha256: object.source.sourceSha256, videoStorageKey: "", width: object.source.width, height: object.source.height };
      return { ...checkedFrame(object.bytes, source), referenceId, workflow: "hook", frameIndex: object.frame.index, frameTimeSeconds: object.frame.timeSeconds };
    }
    const source = options.items ? checkedSource(referenceId, options.items()) : await resolveStartingFrameSource(referenceId);
    if (!options.items && source.workflow === "talking_head") {
      const prepared = talkingFrames.items.find(item => item.id === referenceId && item.sourceSha256 === source.videoSha256);
      if (!prepared || prepared.frameIndex !== 0 || prepared.frameTimeSeconds !== 0 || prepared.path !== `/explore/talking-head-frames/v1/${referenceId}.png`) throw new HookSourceFrameError("This reference's starting frame needs preparation.", 503);
      const frame = checkedFrame(await readFile(join(process.cwd(), "public", prepared.path)), source);
      if (frame.frameSha256 !== prepared.frameSha256 || frame.width !== prepared.width || frame.height !== prepared.height) throw new HookSourceFrameError("The prepared starting frame changed. It needs review.", 409);
      return { ...frame, referenceId, workflow: "talking_head" };
    }
    const selected = options.useCuratedFrame === false ? undefined : getCuratedHookFrame(referenceId, source.videoSha256);
    if (options.useCuratedFrame !== false && !selected && hasCuratedHookFrame(referenceId)) throw new HookSourceFrameError("This video changed. Its selected frame needs review.", 409);
    if (selected) {
      const png = await readFile(join(process.cwd(), "public", selected.publicPath));
      const frame = checkedFrame(png, source);
      if (frame.frameSha256 !== selected.sha256 || frame.width !== selected.width || frame.height !== selected.height) {
        throw new HookSourceFrameError("The selected frame changed. Refresh the reference before continuing.", 409);
      }
      return { ...frame, referenceId, workflow: source.workflow ?? "hook", frameIndex: selected.index, frameTimeSeconds: selected.timeSeconds };
    }
    const key = `${source.videoSha256}:${source.width}:${source.height}:frame0-png-v1`;
    for (const [id, entry] of cache) if (entry.expires <= now()) drop(id);
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key); cache.set(key, hit);
      return { ...hit.frame, workflow: source.workflow ?? "hook", png: Buffer.from(hit.frame.png), referenceId };
    }
    let work = pending.get(key);
    if (!work) {
      if (pending.size >= (options.maxConcurrent ?? 2)) {
        throw new HookSourceFrameError("Starting frames are being prepared. Try again shortly.", 429);
      }
      work = (async () => {
        if (options.readStoredFrame || options.storedOnly || !options.items && (!source.workflow || source.workflow === "hook") && process.env.EXPLORE_STORED_SOURCE_FRAMES_ENABLED === "true") {
          const read = options.readStoredFrame ?? (await import("./hook-source-frame-store.ts")).createStoredHookFrames().read;
          const stored = await read(source.videoSha256);
          if (!stored) throw new HookSourceFrameError("This reference's starting frame is not prepared yet. Try another reference or retry after preparation.", 503);
          const checked = checkedFrame(stored.png, source);
          if (stored.frameIndex !== 0 || stored.frameTimeSeconds !== 0 || stored.sourceSha256 !== checked.sourceSha256 || stored.frameSha256 !== checked.frameSha256 || stored.width !== checked.width || stored.height !== checked.height) throw new HookSourceFrameError("The stored starting frame changed. It needs review.", 409);
          return remember(key, checked);
        }
        let bytes: Buffer;
        if (source.localFile) {
          const path = join(process.cwd(), "public", source.localFile);
          const metadata = await stat(path);
          if (!metadata.isFile() || metadata.size < 32 || metadata.size > MAX_VIDEO_BYTES) throw new HookSourceFrameError("The original video is incomplete or too large.");
          bytes = await readFile(path);
        } else bytes = await (options.download ?? downloadSource)((options.sourceUrl ?? buildPublicStorageUrl)(source.videoStorageKey));
        if (bytes.length > MAX_VIDEO_BYTES || createHash("sha256").update(bytes).digest("hex") !== source.videoSha256) {
          throw new HookSourceFrameError("The Hook source changed. Refresh the library before continuing.", 409);
        }
        const frame = checkedFrame(await (options.decode ?? decodeHookFirstFrame)(bytes), source);
        return remember(key, frame);
      })();
      pending.set(key, work);
      // Cleanup belongs to this work promise, even when the request is canceled.
      void work.finally(() => pending.delete(key)).catch(() => undefined);
    }
    const frame = await work;
    return { ...frame, workflow: source.workflow ?? "hook", png: Buffer.from(frame.png), referenceId };
  };
}

export const getHookSourceFrame = createHookSourceFrameService();
/** Server-only t=0 resolver. It never changes the existing curated preview path. */
export const getHookOpeningSourceFrame = createHookSourceFrameService({ useCuratedFrame: false });
