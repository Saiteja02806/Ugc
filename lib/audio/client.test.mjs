import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
let tokens, requests, response, tokenReader;
mock.module("../firebase/auth.ts", { namedExports: {
  getCurrentUserIdToken: async (uid, force) => { tokens.push({ uid, force }); return tokenReader(uid, force); },
} });
const { createAudioApi } = await import("./client.ts");
beforeEach(() => {
  tokens = []; requests = []; tokenReader = async () => "valid-session";
  response = () => Response.json({ voiceIds: [] });
  globalThis.fetch = async (path, init) => { requests.push({ path, init }); return response(); };
});
test("a bookmark read begun before auth restoration waits and sends the restored owner's token", async () => {
  let restore; tokenReader = () => new Promise(resolve => { restore = resolve; });
  const pending = createAudioApi("alice")("/api/audio/bookmarks");
  await Promise.resolve(); assert.equal(requests.length, 0);
  // Mount effects can run during this wait; they do not invalidate identity.
  restore("restored-session");
  assert.deepEqual(await pending, { voiceIds: [] });
  assert.equal(requests[0].init.headers.get("Authorization"), "Bearer restored-session");
  assert.equal(requests[0].init.cache, "no-store");
});
test("no request is sent without identity or a token, or after an owner mismatch", async () => {
  await assert.rejects(createAudioApi(undefined)("/api/audio/bookmarks"), /session is still loading/);
  tokenReader = async () => null;
  await assert.rejects(createAudioApi("alice")("/api/audio/bookmarks"), /session could not be restored/);
  tokenReader = async () => { throw Error("Your signed-in account changed."); };
  await assert.rejects(createAudioApi("alice")("/api/audio/bookmarks"), /account changed/);
  assert.equal(requests.length, 0);
});
test("an expired token refreshes once, preserves request headers and never sends a null bearer", async () => {
  response = () => requests.length === 1 ? Response.json({ error: "Expired session" }, { status: 401 }) : Response.json({ saved: true });
  tokenReader = async (_uid, force) => force ? "fresh-session" : "expired-session";
  const api = createAudioApi("alice");
  assert.deepEqual(await api("/api/audio/bookmarks", { method: "PUT", headers: new Headers({ "Content-Type": "application/json" }), body: "{}" }), { saved: true });
  assert.deepEqual(tokens, [{ uid: "alice", force: false }, { uid: "alice", force: true }]);
  assert.equal(requests[1].init.headers.get("Authorization"), "Bearer fresh-session");
  assert.equal(requests[1].init.headers.get("Content-Type"), "application/json");
  response = () => Response.json({ error: "Sign in" }, { status: 401 });
  await assert.rejects(api("/api/audio/bookmarks"), /session could not be restored/);
  assert.equal(requests.length, 4);
});
test("billing and database failures are not retried as authentication, and aborted reads do not fetch", async () => {
  for (const status of [403, 503]) {
    response = () => Response.json({ error: "Unavailable" }, { status });
    await assert.rejects(createAudioApi("alice")("/api/audio/bookmarks"), error => error.status === status);
  }
  assert.equal(requests.length, 2);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createAudioApi("alice")("/api/audio/bookmarks", { signal: controller.signal }), { name: "AbortError" });
  assert.equal(requests.length, 2);
});
