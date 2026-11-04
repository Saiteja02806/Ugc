import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preparePublishedSourceFrames } from "./prepare-published-source-frames.mjs";

/** Called by the local video importer before any new catalogue entry is exposed. */
export async function prepareTalkingHeadPublishedFrames(sources, options = {}) {
  const root = options.root ?? process.cwd();
  for (const source of sources) {
    if (!/^talking-[a-z0-9-]+$/.test(source.id) || source.file !== `/explore/talking-head-references/v1/${source.id}.mp4`) throw new Error("Unexpected public Talking Head source path.");
  }
  const receipts = await preparePublishedSourceFrames(sources.map(source => ({
    id: source.id, videoSha256: source.sourceSha256, filePath: path.join(root, "public", source.file), width: source.width, height: source.height,
  })), options);
  const store = options.store ?? (await import("../lib/explore/hook-source-frame-store.ts")).createStoredHookFrames();
  const frames = [];
  for (const receipt of receipts) {
    const frame = await store.read(receipt.sourceSha256);
    if (!frame || frame.frameSha256 !== receipt.frameSha256) throw new Error("Talking Head opening readback failed.");
    const publicPath = `/explore/talking-head-frames/v1/${receipt.referenceId}.png`;
    await mkdir(path.join(root, "public/explore/talking-head-frames/v1"), { recursive: true });
    await writeFile(path.join(root, "public", publicPath), frame.png);
    frames.push({ id: receipt.referenceId, sourceSha256: receipt.sourceSha256, frameSha256: receipt.frameSha256,
      path: publicPath, width: receipt.width, height: receipt.height, frameIndex: 0, frameTimeSeconds: 0 });
  }
  return frames;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (await import("@next/env")).default.loadEnvConfig(process.cwd());
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk.toString();
    if (Buffer.byteLength(input) > 1024 ** 2) throw new Error("Source preparation manifest is too large.");
  }
  const sources = JSON.parse(input);
  console.log(JSON.stringify(await prepareTalkingHeadPublishedFrames(sources)));
}
