import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";
import { validateHookAdditionRelease } from "./hook-reference-addition-release-readiness.mjs";
import { getHookKeyframeMotionReviewDraft, buildHookAnimationPrompt, hookMotionPlanDirections } from "../lib/explore/hook-keyframe-motion.ts";

const root = process.cwd(), stage = path.join(root, ".tmp/hook-folder-refresh-20261023");
const manifest = JSON.parse(fs.readFileSync(path.join(stage, "upload-manifest.json"), "utf8"));
const batchPath = "lib/explore/reference-upload-batches.json";
const paths = [manifest.releasePath, batchPath, "lib/explore/reference-text-catalog.json", "lib/explore/hook-reference-oct23-refresh-prompts.json", "lib/explore/hook-keyframe-motion-catalog.json", "lib/explore/hook-keyframe-motion-plans-c.json"];
const frozen = new Map(paths.map(file => [file, fs.readFileSync(file, "utf8")]));
const release = JSON.parse(frozen.get(manifest.releasePath)), batches = JSON.parse(frozen.get(batchPath));
const batch = batches.batches.find(value => value.id === manifest.batchId);
const { eligible, assets } = validateHookAdditionRelease(release, JSON.parse(frozen.get("lib/explore/reference-text-catalog.json")));
if (!batch || batch.format !== "hook" || eligible.length !== 8 || JSON.stringify(batch.referenceIds) !== JSON.stringify(eligible.map(item => item.id))) throw Error("Incomplete refresh batch.");
for (const item of eligible) {
  const draft = getHookKeyframeMotionReviewDraft(item.id, item.videoSha256);
  if (!draft?.candidatePlan || draft.canSubmitPaidAnimation !== false) throw Error("Missing source-bound preparation review.");
  buildHookAnimationPrompt({ directions: hookMotionPlanDirections(draft.candidatePlan), durationSeconds: 4, generateAudio: false });
}
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
if (new Set(manifest.objects.map(object => object.key)).size !== assets.length || assets.length !== 32) throw Error("Unexpected media count.");
const objects = assets.map(asset => {
  const object = manifest.objects.find(object => object.key === asset.key);
  if (!object || asset.sha256 !== object.sha256 || asset.contentType !== object.contentType || !/^explore\/paired-references\/v1\/[a-f0-9]{64}\.(mp4|mp3|webp)$/.test(asset.key) || path.basename(asset.file) !== asset.file) throw Error("Invalid storage mapping.");
  const bytes = fs.readFileSync(path.join(stage, "media", asset.file));
  if (sha(bytes) !== object.sha256 || bytes.length !== object.bytes) throw Error("Staged bytes changed.");
  return { ...object, bytes };
});
console.log(JSON.stringify({ mode: process.argv.includes("--execute") ? "upload" : "dry-run", hooks: eligible.length, objects: objects.length, totalBytes: objects.reduce((n, object) => n + object.bytes.length, 0), skipped: manifest.skipped, defaultMusic: manifest.checks.find(check => check.folder === "New folder (2)").audioOrigin }));
if (!process.argv.includes("--execute")) process.exit(0);
nextEnv.loadEnvConfig(root);
const { uploadBufferToStorage, getStorageObject, headStorageObject, buildPublicStorageUrl } = await import("../lib/storage/storage.ts");
async function verify(object) {
  const head = await headStorageObject({ key: object.key });
  if (head.ContentLength !== object.bytes.length || head.ContentType !== object.contentType) throw Error("Remote metadata mismatch.");
  const remote = await getStorageObject({ key: object.key });
  if (!remote.Body) throw Error("Remote media body missing.");
  const bytes = Buffer.from(await new Response(remote.Body.transformToWebStream()).arrayBuffer());
  if (sha(bytes) !== object.sha256 || bytes.length !== object.bytes.length) throw Error("Remote hash mismatch.");
  const publicResponse = await fetch(buildPublicStorageUrl(object.key), { method: "HEAD", signal: AbortSignal.timeout(20000) });
  if (!publicResponse.ok || Number(publicResponse.headers.get("content-length")) !== object.bytes.length) throw Error("Public media URL unavailable.");
}
let index = 0, uploaded = 0, verified = 0;
const results = await Promise.allSettled(Array.from({ length: 3 }, async () => {
  while (index < objects.length) {
    const object = objects[index++];
    try { await verify(object); }
    catch (error) {
      if (![404, "NoSuchKey", "NotFound"].includes(error.code) && error.$metadata?.httpStatusCode !== 404) throw error;
      await uploadBufferToStorage({ key: object.key, buffer: object.bytes, contentType: object.contentType, cacheControl: "public, max-age=31536000, immutable" });
      uploaded++; await verify(object);
    }
    console.log(JSON.stringify({ verified: ++verified, total: objects.length, key: object.key }));
  }
}));
const failure = results.find(result => result.status === "rejected");
if (failure) throw failure.reason;
for (const [file, content] of frozen) if (fs.readFileSync(file, "utf8") !== content) throw Error("Sources changed during upload; activation blocked.");
atomicJsonSync(manifest.releasePath, { ...release, mediaStatus: "published", activation: "active" });
atomicJsonSync(batchPath, { ...batches, batches: batches.batches.map(value => value.id === manifest.batchId ? { ...value, status: "published" } : value) });
atomicJsonSync(path.join(stage, "publication-receipt.json"), { verifiedAt: new Date().toISOString(), uploaded, verified, objects: objects.map(({ bytes, ...object }) => ({ ...object, bytes: bytes.length })), skipped: manifest.skipped, websiteDeployed: false, workerDeployed: false });
console.log(JSON.stringify({ uploaded, verified, localManifestActivated: true, websiteDeployed: false, workerDeployed: false }));
