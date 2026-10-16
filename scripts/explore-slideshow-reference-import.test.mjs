import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

function load(file, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Response, URL, console, ...globals, require: name => {
    if (name === "server-only") return {};
    if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`);
    return imports[name];
  } });
  return exports;
}
const hash = n => n.toString(16).padStart(64, "0");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const key = n => `explore/recreate/v1/${hash(n)}.jpg`;
const url = n => `https://storage.test/${key(n)}`;
const reference = () => ({ id: "master", format: "slideshow", title: "Marketing", slides: Array.from({ length: 12 }, (_, i) => ({ id: `slide-${i + 1}`, url: url(i + 1), width: 1080, height: 1440 })) });

function harness({ allowed = true, referenceValue = reference(), head = () => ({ ContentType: "image/jpeg", ContentLength: 1234 }), upsertFailure = false, race = false } = {}) {
  const rows = new Map(), calls = { lookups: [], heads: [], writes: [] };
  class AuthError extends Error { status = 403; }
  const serialize = row => ({ id: row.id, collection: row.collection, sourceType: row.source_type, sourceRecordId: row.source_record_id,
    url: row.url, mimeType: row.mime_type, projectId: row.project_id, metadata: row.metadata, width: row.width, height: row.height, status: row.status });
  const imports = {
    "node:crypto": { createHash }, zod: { z },
    "@/lib/ai-studio/server-access": { requireAIStudioProUser: async () => { if (!allowed) throw new AuthError("Access required"); return { uid: "owner" }; } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError },
    "@/lib/explore/recreate-catalog": { getRecreateReferences: () => [referenceValue] },
    "@/lib/media/media-upload": { MAX_IMAGE_UPLOAD_BYTES: 25 * 1024 ** 2 },
    "./slideshow-draft": { MAX_SLIDESHOW_SLIDES: 10 },
    "@/lib/storage/storage": {
      isTrustedStorageUrl: value => value.startsWith("https://storage.test/"),
      buildPublicStorageUrl: value => `https://storage.test/${value}`,
      headStorageObject: async ({ key }) => { calls.heads.push(key); return head(key); },
    },
    "@/lib/media/media-storage": {
      getMediaAssetForOwnerByStorageKey: async params => { calls.lookups.push(params); return rows.get(`${params.userId}:${params.storageKey}`) ?? null; },
      serializeMediaAsset: serialize,
      upsertReadyMediaAsset: async input => {
        calls.writes.push(input);
        const row = { id: id(calls.writes.length), user_id: input.userId, collection: input.collection, status: "ready", deleted_at: null,
          source_type: input.sourceType, source_record_id: input.sourceRecordId, project_id: input.projectId, storage_key: input.storageKey,
          url: input.url, mime_type: input.mimeType, file_size_bytes: input.fileSizeBytes, metadata: input.metadata, width: input.width, height: input.height };
        if (race) { row.id = id(99); rows.set(`${input.userId}:${input.storageKey}`, row); throw Error("unique constraint"); }
        if (upsertFailure) throw Error("database private connection failure");
        rows.set(`${input.userId}:${input.storageKey}`, row);
        return row;
      },
    },
  };
  const importModule = load("lib/explore/slideshow-reference-import.ts", imports);
  const route = load("app/api/explore/slideshows/reference-images/route.ts", { "@/lib/explore/slideshow-reference-import": importModule });
  const post = (body, raw) => route.POST(new Request("https://app.test/api/explore/slideshows/reference-images", {
    method: "POST", body: raw ?? JSON.stringify(body),
  }));
  return { post, rows, calls, module: importModule };
}

test("catalogue originals become ready owned assets in original order with exact URLs/provenance and no generation", async () => {
  const h = harness();
  const response = await h.post({ referenceId: "master", slideIds: ["slide-5", "slide-3", "slide-10"] });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Authorization");
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.assets.map(item => item.url), [url(3), url(5), url(10)]);
  assert.deepEqual(body.assets.map(item => item.metadata.exploreOriginalReference.slideNumber), [3, 5, 10]);
  assert.ok(h.calls.writes.every(item => item.userId === "owner" && item.collection === "image" && item.sourceType === "upload" && item.projectId === "explore-catalog-reference"));
  assert.deepEqual(body.assets[0].metadata.remixTextSource, { format: "slideshow", referenceId: "master", sourceUrl: url(3) });
});

test("repeat requests reuse owned assets without extra writes or storage reads", async () => {
  const h = harness();
  const first = await (await h.post({ referenceId: "master", slideIds: ["slide-2", "slide-1"] })).json();
  const second = await (await h.post({ referenceId: "master", slideIds: ["slide-1", "slide-2"] })).json();
  assert.deepEqual(second.assets, first.assets);
  assert.equal(h.calls.writes.length, 2); assert.equal(h.calls.heads.length, 2);
  assert.ok(h.calls.lookups.every(item => item.userId === "owner"));
});

test("different owners receive independent entries, preserving owner scope", async () => {
  const h = harness();
  await h.module.importSlideshowReferenceForOwner("owner", { referenceId: "master", slideIds: ["slide-1"] });
  await h.module.importSlideshowReferenceForOwner("another", { referenceId: "master", slideIds: ["slide-1"] });
  assert.equal(h.rows.size, 2); assert.equal(h.calls.writes.length, 2);
  assert.notEqual(h.rows.get(`owner:${key(1)}`).id, h.rows.get(`another:${key(1)}`).id);
});

test("source/storage unique race returns the winning ready asset without surfacing an ambiguous failure", async () => {
  const h = harness({ race: true });
  const response = await h.post({ referenceId: "master", slideIds: ["slide-1"] });
  assert.equal(response.status, 200); assert.equal((await response.json()).assets[0].id, id(99));
});

test("malformed, unbounded, duplicate, cross-reference, arbitrary URL and uploaded-ID payloads do not write or access storage", async () => {
  for (const body of [null, {}, { referenceId: "master", slideIds: [] }, { referenceId: "master", slideIds: ["slide-1", "slide-1"] },
    { referenceId: "master", slideIds: Array.from({ length: 11 }, (_, i) => `slide-${i + 1}`) },
    { referenceId: "master", slideIds: ["slide-1", "foreign-slide"] }, { referenceId: "other", slideIds: ["slide-1"] },
    { referenceId: `uploaded:${id(1)}`, slideIds: [id(2)] },
    { referenceId: "master", slideIds: ["slide-1"], url: "https://evil.test/image.jpg" }]) {
    const h = harness();
    assert.equal((await h.post(body)).status, 400);
    assert.equal(h.calls.writes.length, 0); assert.equal(h.calls.heads.length, 0); assert.equal(h.calls.lookups.length, 0);
  }
  const h = harness();
  assert.equal((await h.post(null, "{")).status, 400);
  assert.equal((await h.post(null, " ".repeat(8193))).status, 413);
});

test("authentication and published slideshow format are enforced before import", async () => {
  const denied = harness({ allowed: false });
  assert.equal((await denied.post({ referenceId: "master", slideIds: ["slide-1"] })).status, 403);
  assert.equal(denied.calls.lookups.length, 0);
  for (const patch of [{ format: "hook" }, { archived: true }]) {
    const h = harness({ referenceValue: { ...reference(), ...patch } });
    assert.equal((await h.post({ referenceId: "master", slideIds: ["slide-1"] })).status, 400);
    assert.equal(h.calls.writes.length, 0);
  }
});

test("only immutable trusted catalogue images and valid dimensions can be registered", async () => {
  for (const patch of [{ url: "https://evil.test/test.jpg" }, { url: `${url(1)}?override=1` }, { url: "https://storage.test/explore/recreate/v1/arbitrary.jpg" },
    { url: `https://storage.test/explore/recreate/v1/${hash(1)}.svg` }, { width: 0 }, { height: 3.5 }]) {
    const ref = reference(); ref.slides[0] = { ...ref.slides[0], ...patch };
    const h = harness({ referenceValue: ref });
    assert.equal((await h.post({ referenceId: "master", slideIds: ["slide-1"] })).status, 409);
    assert.equal(h.calls.writes.length, 0); assert.equal(h.calls.heads.length, 0);
  }
});

test("missing, oversized or unexpected storage types reject the complete selection before any writes", async () => {
  for (const metadata of [{ ContentType: "image/svg+xml", ContentLength: 123 }, { ContentType: "image/png", ContentLength: 123 },
    { ContentType: "image/jpeg", ContentLength: 0 }, { ContentType: "image/jpeg", ContentLength: 26 * 1024 ** 2 },
    { ContentType: "image/jpeg" }]) {
    const h = harness({ head: source => source === key(2) ? metadata : { ContentType: "image/jpeg", ContentLength: 123 } });
    assert.equal((await h.post({ referenceId: "master", slideIds: ["slide-1", "slide-2"] })).status, 409);
    assert.equal(h.calls.writes.length, 0);
  }
});

test("unusable or conflicting owned entries cannot be adopted; internal failures return safe retry advice", async () => {
  for (const patch of [{ user_id: "foreign" }, { status: "processing" }, { deleted_at: "2026-10-16" }, { source_type: "generated_image" }, { project_id: "other" }, { url: "https://evil.test/a.jpg" }]) {
    const h = harness();
    await h.post({ referenceId: "master", slideIds: ["slide-1"] });
    Object.assign(h.rows.get(`owner:${key(1)}`), patch);
    const response = await h.post({ referenceId: "master", slideIds: ["slide-1"] });
    assert.equal(response.status, 409); assert.equal(h.calls.writes.length, 1);
  }
  const h = harness({ upsertFailure: true });
  const response = await h.post({ referenceId: "master", slideIds: ["slide-1"] });
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(await response.json()), /private connection/);
});

test("owned import source lookup filters both owner and active storage key", async () => {
  const operations = [];
  const query = { select: (...args) => { operations.push(["select", ...args]); return query; }, eq: (...args) => { operations.push(["eq", ...args]); return query; },
    is: (...args) => { operations.push(["is", ...args]); return query; }, maybeSingle: async () => ({ data: { id: id(1) }, error: null }) };
  const storage = load("lib/media/media-storage.ts", {
    "@supabase/supabase-js": { createClient: () => ({ from: table => { operations.push(["from", table]); return query; } }) },
    "@/lib/media/types": { mediaCollections: ["image"] },
    "@/lib/media/media-delivery": {}, "@/lib/storage/storage": {}, "@/worker/src/lib/explore-reference-soundtrack": {},
  }, { process: { env: { SUPABASE_URL: "https://database.test", SUPABASE_SERVICE_ROLE_KEY: "offline-fixture" } } });
  await storage.getMediaAssetForOwnerByStorageKey({ userId: "owner", storageKey: key(1) });
  assert.ok(operations.some(call => call[0] === "eq" && call[1] === "user_id" && call[2] === "owner"));
  assert.ok(operations.some(call => call[0] === "eq" && call[1] === "storage_key" && call[2] === key(1)));
  assert.ok(operations.some(call => call[0] === "is" && call[1] === "deleted_at" && call[2] === null));
});

test("imported original provenance survives owner detail resolution while ordinary uploads cannot borrow reference copy", async () => {
  const source = { format: "slideshow", referenceId: "master", sourceUrl: url(1) };
  for (const projectId of ["explore-catalog-reference", "other"]) {
    const route = load("app/api/media/[assetId]/route.ts", {
      "@/lib/firebase/server-auth": { requireFirebaseUser: async () => ({ uid: "owner" }), FirebaseAuthRequestError: Error },
      "@/lib/jobs/background-jobs": { getBackgroundJobForUser: () => { throw Error("No generation lookup for original imports"); } },
      "@/lib/explore/remix-source": {}, "@/worker/src/lib/slideshow-generation-batch": {},
      "@/lib/media/media-storage": { getMediaAssetForOwner: async () => ({ source_type: "upload", project_id: projectId }),
        serializeMediaAsset: () => ({ metadata: { remixTextSource: source } }) },
    });
    const response = await route.GET(new Request("https://app.test/api/media/test?remixSource=1"), { params: Promise.resolve({ assetId: id(1) }) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).asset.metadata.remixTextSource, projectId === "explore-catalog-reference" ? source : null);
  }
});
