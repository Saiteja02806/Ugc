import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

let owner = "owner", calls = [], archived = false;
const image = (id, patch = {}) => ({ id, collection: "image", status: "ready", sourceType: "upload", projectId: "image-library", mimeType: "image/png", width: 1080, height: 1350, url: `https://owned.test/${id}.png`, metadata: {}, ...patch });
let rows = [image("active"), image("archived", { metadata: { imageLibraryArchived: true } }), image("catalog", { projectId: "explore-catalog-reference" })];
class AuthError extends Error { constructor(message, status) { super(message); this.status = status; } }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async () => { if (!owner) throw new AuthError("Sign in", 401); return { uid: owner }; } } });
mock.module("@/lib/media/media-storage", { namedExports: {
  listImageLibraryAssetsPage: async params => { calls.push(params); return rows; }, serializeMediaAsset: row => row,
  getMediaAssetForOwner: async params => { calls.push(params); return params.assetId === "owned" ? { ...image("owned"), collection: "image", metadata: { retained: "value" } } : null; },
  softDeleteMediaAsset: async () => { throw Error("Archiving must not delete a source"); },
  updateMediaAssetForOwner: async params => { calls.push(params); archived = params.metadata?.imageLibraryArchived; return image("owned", { metadata: { retained: "value", imageLibraryArchived: archived } }); },
} });
mock.module("@/lib/jobs/background-jobs", { namedExports: { getBackgroundJobForUser: async () => null } });
const { GET } = await import("../app/api/media/image-library/route.ts");
const { PATCH, GET: readAsset } = await import("../app/api/media/[assetId]/route.ts");
const request = query => new Request(`https://app.test/api/media/image-library${query}`);

test("library listing is authenticated, owner-bound, noncached and excludes archived/internal images", async () => {
  calls = [];
  const response = await GET(request("?offset=60&q=product"));
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(calls, [{ userId: "owner", offset: 60, query: "product" }]);
  assert.deepEqual((await response.json()).assets.map(asset => asset.id), ["active"]);
  assert.deepEqual((await (await GET(request("?archived=1"))).json()).assets.map(asset => asset.id), ["archived"]);
  owner = ""; assert.equal((await GET(request(""))).status, 401); owner = "owner";
});

test("invalid pagination/search is rejected; raw page boundaries retain a load-more cursor even when filtered", async () => {
  for (const query of ["?offset=-1", "?offset=1.5", "?offset=Infinity", "?q=" + "a".repeat(141)]) assert.equal((await GET(request(query))).status, 400);
  const previous = rows; rows = Array.from({ length: 61 }, (_, i) => image(String(i)));
  const body = await (await GET(request(""))).json(); assert.equal(body.assets.length, 60); assert.equal(body.nextOffset, 60); rows = previous;
});

test("image archive is an owner-checked metadata update; source lookup still works and malformed/foreign actions fail", async () => {
  const patch = (id, body) => PATCH(new Request(`https://app.test/api/media/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ assetId: id }) });
  calls = [];
  const response = await patch("owned", { libraryArchived: true }); assert.equal(response.status, 200); assert.equal(archived, true);
  assert.deepEqual(calls.at(-1), { assetId: "owned", userId: "owner", title: undefined, metadata: { imageLibraryArchived: true } });
  assert.equal((await readAsset(new Request("https://app.test/api/media/owned"), { params: Promise.resolve({ assetId: "owned" }) })).status, 200);
  assert.equal((await patch("foreign", { libraryArchived: true })).status, 404);
  assert.equal((await patch("owned", { libraryArchived: "yes" })).status, 400);
  assert.equal((await patch("owned", { libraryArchived: false })).status, 200); assert.equal(archived, false);
});

test("database image search applies owner, ready/undeleted filters, stable order and bounded ranges", async () => {
  const source = readFileSync(new URL("../lib/media/media-storage.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("storage.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "listImageLibraryAssetsPage");
  const code = ts.transpileModule(fn.getText(ast).replace("export ", ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const operations = [], result = { data: [], error: null };
  const builder = new Proxy({}, { get: (_, key) => key === "then" ? (resolve => resolve(result)) : (...args) => { operations.push([key, ...args]); return builder; } });
  const list = new Function("getSupabaseServerClient", "MEDIA_ASSETS_TABLE", `${code};return listImageLibraryAssetsPage;`)(() => builder, "media_assets");
  await list({ userId: "account-a", offset: 60, query: 'test%,owner"' });
  assert.ok(operations.some(args => args[0] === "eq" && args[1] === "user_id" && args[2] === "account-a"));
  assert.ok(operations.some(args => args[0] === "eq" && args[1] === "status" && args[2] === "ready"));
  assert.ok(operations.some(args => args[0] === "is" && args[1] === "deleted_at" && args[2] === null));
  assert.deepEqual(operations.find(args => args[0] === "range"), ["range", 60, 120]);
  assert.ok(operations.find(args => args[0] === "or")[1].includes('\\%'));
});

test("an archive race reloads newer metadata rather than overwriting a worker's update", async () => {
  const source = readFileSync(new URL("../lib/media/media-storage.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("storage.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "updateMediaAssetForOwner");
  const code = ts.transpileModule(fn.getText(ast).replace("export ", ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const updates = [], versions = []; let reads = 0;
  const client = { from() { return this; }, update(value) { updates.push(value); return this; }, eq(field, value) { if (field === "updated_at") versions.push(value); return this; }, is() { return this; }, select() { return this; }, async maybeSingle() { return { data: updates.length === 1 ? null : { id: "owned", metadata: updates.at(-1).metadata }, error: null }; } };
  const update = new Function("getSupabaseServerClient", "getMediaAssetForOwner", "isJsonObject", "MEDIA_ASSETS_TABLE", `${code};return updateMediaAssetForOwner;`)(() => client,
    async () => { reads++; return { id: "owned", updated_at: `version-${reads}`, metadata: reads === 1 ? { original: true } : { original: true, workerReceipt: "new" } }; }, value => value && typeof value === "object", "media_assets");
  const result = await update({ assetId: "owned", userId: "owner", metadata: { imageLibraryArchived: true } });
  assert.deepEqual(versions, ["version-1", "version-2"]);
  assert.deepEqual(result.metadata, { original: true, workerReceipt: "new", imageLibraryArchived: true });
});
