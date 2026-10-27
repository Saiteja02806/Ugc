import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decodeHookFirstFrame } from "../lib/explore/hook-source-frame.ts";

// Offline, exact frame-zero preparation. No provider, storage or database writes.
const sources = JSON.parse(await readFile("lib/explore/talking-head-source-manifest.json", "utf8"));
const write = process.argv.includes("--write");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const items = [];
if (write) await mkdir("public/explore/talking-head-frames/v1", { recursive: true });
for (const source of sources.items) {
  const video = await readFile(`public${source.file}`);
  if (hash(video) !== source.sourceSha256) throw Error(`Source changed: ${source.id}`);
  const png = await decodeHookFirstFrame(video);
  const path = `/explore/talking-head-frames/v1/${source.id}.png`;
  const item = { id: source.id, sourceSha256: source.sourceSha256, frameSha256: hash(png), path, width: png.readUInt32BE(16), height: png.readUInt32BE(20), frameIndex: 0, frameTimeSeconds: 0 };
  if (item.width !== source.width || item.height !== source.height) throw Error(`Dimensions changed: ${source.id}`);
  if (write) await writeFile(`public${path}`, png);
  else if (hash(await readFile(`public${path}`)) !== item.frameSha256) throw Error(`Prepared frame changed: ${source.id}`);
  items.push(item);
}
const manifest = { version: 1, extractor: "frame0-png-v1", items };
if (write) await writeFile("lib/explore/talking-head-frames.json", JSON.stringify(manifest, null, 2) + "\n");
else if (JSON.stringify(JSON.parse(await readFile("lib/explore/talking-head-frames.json", "utf8"))) !== JSON.stringify(manifest)) throw Error("Prepared manifest changed");
console.log(`Verified ${items.length} source hashes and exact frame-zero PNGs${write ? "; prepared locally" : ""}.`);
