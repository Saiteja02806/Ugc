import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";

/** Import/publication only. Never called by Recreate or by a build. */
export async function preparePublishedSourceFrames(items, options = {}) {
  const sources = new Map();
  for (const item of items) {
    if (!item.id || item.id.startsWith("creator-account-") || !/^[a-f0-9]{64}$/.test(item.videoSha256)) throw new Error("Only verified public video sources can be prepared.");
    const previous = sources.get(item.id);
    if (previous && previous.videoSha256 !== item.videoSha256) throw new Error("Conflicting source versions in one publication.");
    sources.set(item.id, item);
  }
  if (!sources.size) return [];
  const store = options.store ?? (await import("../lib/explore/hook-source-frame-store.ts")).createStoredHookFrames();
  const { createHookSourceFrameService, decodeHookFirstFrame } = await import("../lib/explore/hook-source-frame.ts");
  const decode = options.decode ?? decodeHookFirstFrame;
  const extractRemote = createHookSourceFrameService({ items: () => [...sources.values()], useCuratedFrame: false });
  const results = [];
  for (const item of sources.values()) {
    const frame = await store.prepare(item.videoSha256, async () => {
      if (!item.filePath) return extractRemote(item.id);
      const metadata = await stat(item.filePath);
      if (!metadata.isFile() || metadata.size < 32 || metadata.size > 64 * 1024 ** 2) throw new Error("Source video is empty or exceeds its preparation limit.");
      const video = await readFile(item.filePath);
      if (video.length > 64 * 1024 ** 2 || createHash("sha256").update(video).digest("hex") !== item.videoSha256) throw new Error("Source video changed before frame preparation.");
      const png = await decode(video);
      return { png, referenceId: item.id, sourceSha256: item.videoSha256,
        frameSha256: createHash("sha256").update(png).digest("hex"), frameIndex: 0, frameTimeSeconds: 0,
        width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    });
    if (frame.sourceSha256 !== item.videoSha256 || frame.frameIndex !== 0 || frame.frameTimeSeconds !== 0 ||
      item.width > 0 && item.width !== frame.width || item.height > 0 && item.height !== frame.height) throw new Error("Prepared opening does not match the published source.");
    results.push({ referenceId: item.id, sourceSha256: frame.sourceSha256, frameSha256: frame.frameSha256,
      width: frame.width, height: frame.height, frameIndex: 0, frameTimeSeconds: 0 });
  }
  return results;
}
