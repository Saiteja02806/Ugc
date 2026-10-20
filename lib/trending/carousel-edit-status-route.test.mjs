import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
class AuthError extends AccessError {}
let signedIn = true, denied = false;
const calls = [];
const assignmentId = "10000000-0000-4000-8000-000000000001";
const creativeId = "20000000-0000-4000-8000-000000000002";
const scope = { assignmentId, creativeId, userId: "owner" };
mock.module("next/server", { namedExports: { NextResponse: { json: (body, options) => Response.json(body, options) } } });
mock.module("@/lib/firebase/server-auth", { namedExports: {
  FirebaseAuthRequestError: AuthError,
  requireFirebaseUser: async () => { if (!signedIn) throw new AuthError("Sign in", 401); return { uid: "owner" }; },
} });
mock.module("@/lib/jobs/background-job-service", { namedExports: { createAndDispatchBackgroundJob: () => assert.fail("Read-only status must not dispatch jobs") } });
mock.module("./creative-edit-service.ts", { namedExports: {
  loadTrendingCarouselEditStatus: async params => { calls.push(["status", params]); if (denied) throw new AccessError("Not owned", 404); return { ...params, format: "carousel", revision: 3, renderState: "rendering" }; },
  loadTrendingCreativeEditor: async params => { calls.push(["editor", params]); return { content: "editor" }; },
  loadTrendingCreativeReadView: async params => { calls.push(["history", params]); return { content: "history" }; },
  saveTrendingCreativeEditor: () => assert.fail("Status must not save edits"),
} });
mock.module("./creative-edits.ts", { namedExports: {
  TrendingCreativeEditAccessError: AccessError,
  getMissingTrendingCreativeEditEnvVars: () => [],
  attachTrendingCreativeEditRenderJob: () => assert.fail(), markTrendingCreativeEditRenderFailed: () => assert.fail(),
} });
const { GET } = await import("../../app/api/trending/creatives/[format]/[creativeId]/edit/route.ts");
const request = (view = "status", format = "carousel", assignment = assignmentId) => GET(
  new Request(`http://fixture/edit?assignmentId=${assignment}&view=${view}`), { params: Promise.resolve({ creativeId, format }) });

test("status route authenticates, scopes by assignment and returns no editor data or cache", async () => {
  calls.length = 0;
  const response = await request();
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json();
  assert.equal(result.status.renderState, "rendering"); assert.equal(result.edit, undefined);
  assert.deepEqual(calls, [["status", scope]]);
  calls.length = 0; signedIn = false;
  assert.equal((await request()).status, 401); assert.deepEqual(calls, []);
  signedIn = true; denied = true;
  assert.equal((await request()).status, 404); denied = false;
});

test("invalid scopes/formats cannot use slideshow status; existing history/editor responses stay intact", async () => {
  calls.length = 0;
  assert.equal((await request("status", "wall_text")).status, 400);
  assert.equal((await request("status", "carousel", "invalid")).status, 400);
  assert.deepEqual(calls, []);
  assert.equal((await (await request("history")).json()).edit.content, "history");
  assert.equal((await (await request("editor")).json()).edit.content, "editor");
  assert.deepEqual(calls.map(call => call[0]), ["history", "editor"]);
});

test("status service verifies readable assignment access before the small owner-scoped lookup", async () => {
  const source = readFileSync(new URL("./creative-edit-service.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("service.ts", source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "loadTrendingCarouselEditStatus");
  const code = ts.transpileModule(node.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const sequence = []; let reject = false;
  const load = new Function("assertReadableTrendingCreative", "getTrendingCarouselEditStatus", `${code};return loadTrendingCarouselEditStatus;`)(
    async params => { sequence.push(["access", params]); if (reject) throw new AccessError("Not owned", 404); },
    async params => { sequence.push(["status", params]); return { id: "edit", revision: 3, render_status: "rendering", updated_at: "timestamp" }; });
  const result = await load(scope);
  assert.equal(result.renderState, "rendering"); assert.equal(result.content, undefined);
  assert.deepEqual(sequence, [["access", { ...scope, format: "carousel" }], ["status", scope]]);
  sequence.length = 0; reject = true;
  await assert.rejects(load(scope), { status: 404 }); assert.equal(sequence.length, 1);
});
