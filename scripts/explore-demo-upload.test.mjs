import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../app/api/media/complete-upload/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(project = "explore-demo", { foreign = false, storedType = "audio/mpeg", bytes = 100, privateStorage = false } = {}) {
  let finalized = 0;
  class AuthError extends Error {}
  const asset = { id: "saved-id", collection: "audio", project_id: project, storage_key: "owner/key", mime_type: "audio/mpeg",
    metadata: privateStorage ? { storageLocation: "private_user_media" } : {} };
  const imports = {
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => ({ uid: "owner" }) },
    "@/lib/media/media-storage": { getMediaAssetForOwner: async params => { assert.equal(params.userId, "owner"); return foreign ? null : asset; }, markMediaAssetReady: async params => { finalized++; return { ...asset, status: "ready", durationSeconds: params.durationSeconds }; }, serializeMediaAsset: a => a },
    "@/lib/media/media-upload": { getAllowedContentTypes: () => ["audio/mpeg", "audio/wav"], getMaxUploadBytes: () => 25 * 1024 ** 2 },
    "@/lib/media/types": { isMediaRatio: () => true },
    "@/lib/storage/storage": { headStorageObject: async () => { assert.equal(privateStorage, false); return { ContentType: storedType, ContentLength: bytes }; } },
    "@/lib/media/media-delivery": { isPrivateUserMedia: row => row.metadata?.storageLocation === "private_user_media" },
    "@/lib/media/private-media-storage": { privateMediaHead: async () => { assert.equal(privateStorage, true); return { ContentType: storedType, ContentLength: bytes }; } },
  };
  const exported = {};
  vm.runInNewContext(code, { exports: exported, require(name) { assert.ok(name in imports, name); return imports[name]; }, Response, console });
  return { complete: duration => exported.POST(new Request("https://offline.invalid/api/media/complete-upload", { method: "POST", body: JSON.stringify({ assetId: "saved-id", key: "owner/key", durationSeconds: duration, projectId: "explore-demo" }) })), finalized: () => finalized };
}
test("Demo background audio accepts long tracks for fitting without expanding the original Create-reference cap", async () => {
  for (const seconds of [31, 180, 600]) { const h = harness(); assert.equal((await h.complete(seconds)).status, 200); assert.equal(h.finalized(), 1); }
  for (const project of ["ai-studio", null]) { const h = harness(project); assert.equal((await h.complete(31)).status, 400); assert.equal(h.finalized(), 0); }
});

test("completion uses the saved reservation location and keeps audio rules in either bucket", async () => {
  for (const privateStorage of [false, true]) {
    const demo = harness("explore-demo", { privateStorage });
    assert.equal((await demo.complete(180)).status, 200); assert.equal(demo.finalized(), 1);
    const reference = harness("ai-studio", { privateStorage });
    assert.equal((await reference.complete(31)).status, 400); assert.equal(reference.finalized(), 0);
  }
});
test("only the saved owner-checked upload identity determines the duration policy, never a completion-body override", async () => {
  const h = harness("ai-studio"); assert.equal((await h.complete(600)).status, 400); assert.equal(h.finalized(), 0);
  const foreign = harness("explore-demo", { foreign: true }); assert.equal((await foreign.complete(10)).status, 404); assert.equal(foreign.finalized(), 0);
});
test("Demo uploads still reject invalid duration, changed MIME, oversize and empty objects before ready", async () => {
  for (const seconds of [0, -1, 601, null]) { const h = harness(); assert.equal((await h.complete(seconds)).status, 400); assert.equal(h.finalized(), 0); }
  for (const options of [{ storedType: "audio/wav" }, { bytes: 0 }, { bytes: 26 * 1024 ** 2 }]) { const h = harness("explore-demo", options); assert.ok([413,422].includes((await h.complete(10)).status)); assert.equal(h.finalized(), 0); }
});
