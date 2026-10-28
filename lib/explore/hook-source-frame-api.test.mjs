import assert from "node:assert/strict";
import { mock, test } from "node:test";

const local = file => new URL(file, import.meta.url);
class FirebaseAuthRequestError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
class HookSourceFrameError extends Error { constructor(message, status = 503) { super(message); this.status = status; } }
let authStatus = null, authReads = 0, frameReads = 0, frameError = null;
mock.module(local("../ai-studio/server-access.ts"), { namedExports: { requireAIStudioProUser: async () => {
  authReads++; if (authStatus) throw new FirebaseAuthRequestError("Access denied", authStatus); return { uid: "owner" };
} } });
mock.module(local("../firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError } });
mock.module(local("./hook-source-frame.ts"), { namedExports: { HookSourceFrameError, getHookSourceFrame: async referenceId => {
  frameReads++; if (frameError) throw frameError;
  return { referenceId, sourceSha256: "a".repeat(64), frameSha256: "b".repeat(64), frameIndex: 0, frameTimeSeconds: 0, width: 720, height: 1280, png: Buffer.from("fixture PNG") };
}, getHookOpeningSourceFrame: async referenceId => {
  frameReads++; if (frameError) throw frameError;
  return { referenceId, sourceSha256: "a".repeat(64), frameSha256: "b".repeat(64), frameIndex: 0, frameTimeSeconds: 0, width: 720, height: 1280, png: Buffer.from("fixture PNG") };
} } });
mock.method(globalThis, "fetch", async () => assert.fail("No network during route tests"));
const { handleHookStartingFrame } = await import("./hook-source-frame-api.ts");
function post(body = { referenceId: "hook-01" }, overrides = {}) {
  return new Request("https://www.getugcpilot.com/api/explore/hook-starting-frame", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), ...overrides,
  });
}

test("feature is closed by default, including direct route calls", async () => {
  delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  assert.equal((await handleHookStartingFrame(post())).status, 404); assert.equal(authReads, 0); assert.equal(frameReads, 0);
});

test("authentication and generation entitlement are checked before every extraction", async () => {
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  for (const status of [401, 403]) { authStatus = status; assert.equal((await handleHookStartingFrame(post())).status, status); }
  authStatus = null; assert.equal(frameReads, 0);
});

test("URL injection, unexpected fields, malformed JSON and oversized bodies cannot reach extraction", async () => {
  for (const body of [null, [], "hook-01", {}, { referenceId: "hook-01", url: "http://127.0.0.1/secret" }, { referenceId: 3 }]) {
    assert.equal((await handleHookStartingFrame(post(body))).status, 400);
  }
  assert.equal((await handleHookStartingFrame(post({}, { body: "{" }))).status, 400);
  assert.equal((await handleHookStartingFrame(post({}, { body: "x".repeat(1025) }))).status, 413);
  assert.equal((await handleHookStartingFrame(post({}, { headers: { "Content-Type": "text/plain" } }))).status, 400);
  assert.equal(frameReads, 0);
});

test("PNG response includes canonical provenance, dimensions and private cache policy", async () => {
  const result = await handleHookStartingFrame(post());
  assert.equal(result.status, 200); assert.equal(result.headers.get("content-type"), "image/png");
  assert.equal(result.headers.get("x-hook-reference-id"), "hook-01");
  assert.equal(result.headers.get("x-hook-source-sha256"), "a".repeat(64));
  assert.equal(result.headers.get("x-hook-frame-sha256"), "b".repeat(64));
  assert.equal(result.headers.get("x-hook-frame-index"), "0"); assert.equal(result.headers.get("x-hook-frame-time"), "0");
  assert.equal(result.headers.get("x-hook-frame-width"), "720"); assert.equal(result.headers.get("x-hook-frame-height"), "1280");
  assert.match(result.headers.get("cache-control"), /private.*no-store/); assert.equal(result.headers.get("vary"), "Authorization");
  assert.equal(await result.text(), "fixture PNG");
});

test("source review failures and decoder capacity return actionable failure without a paid retry", async () => {
  for (const status of [404, 409, 429, 503]) {
    frameError = new HookSourceFrameError("Preparation could not complete", status);
    assert.equal((await handleHookStartingFrame(post())).status, status);
  }
  frameError = Error("sensitive local path details");
  const result = await handleHookStartingFrame(post()); assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /sensitive/); frameError = null;
});
