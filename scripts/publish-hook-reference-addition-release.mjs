import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { validateHookAdditionRelease } from "./hook-reference-addition-release-readiness.mjs";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";

// This only publishes immutable content-addressed media and activates the local
// manifest. It never deploys the app, removes storage objects, or changes data.
const root = process.cwd();
const manifestArg = process.argv.indexOf("--manifest");
if (manifestArg >= 0 && !process.argv[manifestArg + 1]) throw new Error("Supply a manifest path.");
const manifestPath = path.resolve(root, manifestArg >= 0 ? process.argv[manifestArg + 1] : "worker/src/lib/explore-hook-reference-addition-release.json");
const before = readFileSync(manifestPath, "utf8"), release = JSON.parse(before);
const textPath = path.join(root, "lib/explore/reference-text-catalog.json"), textBefore = readFileSync(textPath, "utf8");
const { eligible, assets, excluded } = validateHookAdditionRelease(release, JSON.parse(textBefore));
const local = assets.map(asset => {
  const bytes = readFileSync(path.join(root, ".tmp/explore-paired-references/media", asset.file));
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`Corrupt staged media: ${asset.key}`);
  return { ...asset, bytes };
});
console.log(JSON.stringify({ mode: process.argv.includes("--execute") ? "upload-and-verify" : "dry-run", hooks: eligible.length, excluded, objects: assets.length, bytes: local.reduce((sum, asset) => sum + asset.bytes.length, 0) }));
if (!process.argv.includes("--execute")) process.exit(0);
if (!process.argv.includes("--yes")) throw new Error("Inspect the dry-run before supplying --execute --yes.");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2").replace(/\\n/g, "\n");
}
const { getStorageObject, headStorageObject, uploadBufferToStorage, getMissingStorageEnvVars } = await import("../lib/storage/storage.ts");
const missing = getMissingStorageEnvVars();
if (missing.length) throw new Error(`Missing storage configuration: ${missing.join(", ")}`);
async function verify(asset) {
  const head = await headStorageObject({ key: asset.key });
  if (head.ContentLength !== asset.bytes.length || head.ContentType !== asset.contentType) throw new Error(`Stored media metadata mismatch: ${asset.key}`);
  const response = await getStorageObject({ key: asset.key });
  if (!response.Body) throw new Error("Stored media is empty.");
  const reader = response.Body.transformToWebStream().getReader(), hash = createHash("sha256"); let count = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; count += value.length; if (count > asset.bytes.length) throw new Error("Stored media exceeds expected size."); hash.update(value); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (count !== asset.bytes.length || hash.digest("hex") !== asset.sha256) throw new Error(`Stored media checksum mismatch: ${asset.key}`);
}
async function transientRetry(operation) {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      const code = error?.code ?? error?.cause?.code;
      if (attempt >= 3 || !["ECONNRESET", "ETIMEDOUT", "EPIPE", "EAI_AGAIN", "ECONNABORTED", 429, 500, 502, 503, 504].includes(code)) throw error;
      console.log(JSON.stringify({ retryingTransientStorageError: code, attempt: attempt + 1 }));
      await delay(1000 * 2 ** attempt);
    }
  }
}
let uploaded = 0, next = 0, verified = 0;
async function publishAsset(asset) {
  try { await transientRetry(() => verify(asset)); }
  catch (error) {
    if (!(error?.code === "NoSuchKey" || error?.code === 404)) throw error;
    await transientRetry(() => uploadBufferToStorage({ key: asset.key, buffer: asset.bytes, contentType: asset.contentType, cacheControl: "public, max-age=31536000, immutable" }));
    await transientRetry(() => verify(asset)); uploaded++;
  }
  console.log(JSON.stringify({ verified: asset.key, completed: ++verified, total: local.length }));
}
// Independent immutable objects may upload concurrently. Wait for every worker,
// including failures, before considering activation of the manifest.
const workers = await Promise.allSettled(Array.from({ length: 3 }, async () => {
  while (next < local.length) await publishAsset(local[next++]);
}));
const failed = workers.find(result => result.status === "rejected");
if (failed) throw failed.reason;
await (await import("./prepare-published-hook-frames.mjs")).preparePublishedHookFrames(eligible);
if (readFileSync(manifestPath, "utf8") !== before || readFileSync(textPath, "utf8") !== textBefore) throw new Error("Release changed during upload; activation was not applied. Run readiness again.");
atomicJsonSync(manifestPath, { ...release, mediaStatus: "published", activation: "active" });
console.log(JSON.stringify({ readyForDeployment: true, hooks: eligible.length, excluded, verifiedObjects: assets.length, uploadedObjects: uploaded }));
