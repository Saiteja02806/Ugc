import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getStorageObject, headStorageObject, uploadBufferToStorage, getMissingStorageEnvVars } from "../lib/storage/storage.ts";

const root = process.cwd(), manifestPath = path.join(root, "worker/src/lib/explore-paired-reference-catalog.json");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2").replace(/\\n/g, "\n");
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.version !== 1 || !["staged", "published"].includes(manifest.mediaStatus) || !Array.isArray(manifest.items)) throw new Error("Invalid paired reference catalog.");
const assets = new Map();
for (const item of manifest.items) for (const type of ["video", "audio", "poster"]) {
  const key = item[`${type}StorageKey`], sha256 = item[`${type}Sha256`];
  const extension = { video: "mp4", audio: "mp3", poster: "webp" }[type];
  if (key !== `explore/paired-references/v1/${sha256}.${extension}` || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Unsafe paired reference storage key.");
  const bytes = readFileSync(path.join(root, ".tmp/explore-paired-references/media", `${sha256}.${extension}`));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`Staged pair hash mismatch: ${item.id}`);
  assets.set(key, { key, sha256, bytes, contentType: { video: "video/mp4", audio: "audio/mpeg", poster: "image/webp" }[type] });
}
console.log(JSON.stringify({ pairs: manifest.items.length, objects: assets.size, bytes: [...assets.values()].reduce((sum, a) => sum + a.bytes.length, 0), mode: process.argv.includes("--execute") ? "upload" : "dry-run" }));
if (!process.argv.includes("--execute")) process.exit(0);
if (!process.argv.includes("--yes")) throw new Error("Inspect the dry-run, then use --execute --yes for the approved registration.");
const missing = getMissingStorageEnvVars();
if (missing.length) throw new Error(`Missing storage configuration: ${missing.join(", ")}`);

async function verify(asset) {
  const head = await headStorageObject({ key: asset.key });
  if (head.ContentLength !== asset.bytes.length || head.ContentType !== asset.contentType) throw new Error(`Stored pair metadata mismatch: ${asset.key}`);
  const response = await getStorageObject({ key: asset.key });
  if (!response.Body) throw new Error("Stored reference is empty.");
  const reader = response.Body.transformToWebStream().getReader(), hash = createHash("sha256");
  let count = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; count += part.value.length; if (count > asset.bytes.length) throw new Error("Stored reference exceeds its expected size."); hash.update(part.value); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (count !== asset.bytes.length || hash.digest("hex") !== asset.sha256) throw new Error(`Stored pair checksum mismatch: ${asset.key}`);
}

let uploaded = 0;
for (const asset of assets.values()) {
  try { await verify(asset); }
  catch (error) {
    if (!(error?.code === "NoSuchKey" || error?.code === 404)) throw error;
    await uploadBufferToStorage({ key: asset.key, buffer: asset.bytes, contentType: asset.contentType, cacheControl: "public, max-age=31536000, immutable" });
    await verify(asset); uploaded++;
  }
  console.log(`Verified ${asset.key}`);
}
writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, mediaStatus: "published" }, null, 2)}\n`);
console.log(JSON.stringify({ registeredPairs: manifest.items.length, verifiedObjects: assets.size, uploadedObjects: uploaded }));
