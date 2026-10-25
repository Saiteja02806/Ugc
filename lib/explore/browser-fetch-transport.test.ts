import assert from "node:assert/strict";
import test from "node:test";
import { loadClipDraft, saveClipDraft } from "./clip-draft-client.ts";
import { requestFinish, type SavedFinish } from "./workflow-finishing-client.ts";
import { loadWorkflowDefaultMusic } from "./workflow-default-music-client.ts";

const sourceAssetId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const content = { version: 1 as const, sourceAssetId, editing: { version: 1 as const, format: "hook" as const,
  trimStartMs: 0, trimEndMs: 5000, originalVolume: 1, musicVolume: .2, text: null },
  backgroundAssetId: null, backgroundPlayback: "once" as const };

// Chromium's native fetch accepts an unbound call or Window, but rejects a
// transport object as its receiver. Arrow mocks hide this production failure.
function browserFetch(reply: (url: string, init?: RequestInit) => Response): typeof fetch {
  return function (this: unknown, url: RequestInfo | URL, init?: RequestInit) {
    if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
    return Promise.resolve(reply(String(url), init));
  } as typeof fetch;
}
const token = async () => "local-test-token";

test("default music token, download and body stalls are bounded before scheduling", async () => {
  const timer = setInterval(() => {}, 1000);
  const stalled = () => new Promise<never>(() => {});
  try {
    for (const stage of ["token", "download", "body"]) {
      let calls = 0;
      await assert.rejects(loadWorkflowDefaultMusic({ timeoutMs: 10, assertActive() {}, token: stage === "token" ? stalled : token,
        fetch: (async () => {
          calls++;
          if (stage === "download") return stalled();
          return { ok: true, headers: new Headers({ "Content-Type": "audio/mpeg" }), blob: stalled } as unknown as Response;
        }) as typeof fetch }), /too long/);
      assert.equal(calls, stage === "token" ? 0 : 1);
    }
    let resolve!: (token: string) => void, calls = 0;
    await assert.rejects(loadWorkflowDefaultMusic({ timeoutMs: 10, assertActive() {}, token: () => new Promise(done => { resolve = done; }),
      fetch: async () => { calls++; return new Response(); } }), /too long/);
    resolve("late-token"); await new Promise(setImmediate); assert.equal(calls, 0);
  } finally { clearInterval(timer); }
});

test("clip draft reads and saves preserve browser fetch invocation and request identity", async () => {
  const draft = { id: "33333333-3333-4333-8333-333333333333", scope: "hook", revision: 1, content, updatedAt: "2026-10-13T00:00:00Z" };
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const deps = { token, fetch: browserFetch((url, init) => {
    calls.push({ url, init });
    return Response.json({ ok: true, draft, requestId, replayed: false });
  }) };
  assert.deepEqual(await loadClipDraft(deps, sourceAssetId, "hook"), draft);
  assert.deepEqual(await saveClipDraft(deps, { scope: "hook", requestId, expectedRevision: 0, content }), draft);
  assert.deepEqual(calls.map(call => call.init?.method), ["GET", "POST"]);
  assert.equal(new Headers(calls[1].init?.headers).get("Idempotency-Key"), requestId);
  assert.equal(new Headers(calls[1].init?.headers).get("Authorization"), "Bearer local-test-token");
  assert.deepEqual(JSON.parse(calls[1].init?.body as string).content, content);
});

test("finishing submission and recovery work with browser native fetch semantics", async () => {
  const saved: SavedFinish = { version: 1, ownerId: "owner", kind: "hook", requestKey: requestId,
    draft: { version: 1, kind: "hook", sourceAssetId, demoAssetId: null, demoAudioAssetId: null,
      demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: null } };
  const calls: RequestInit[] = [];
  const deps = { token, assertActive() {}, fetch: browserFetch((_url, init) => {
    calls.push(init!);
    return Response.json({ ok: true, receiptVersion: 1, requestKey: requestId, jobId: null,
      outcome: "pending", mediaAssetId: null, message: "Preparing" });
  }) };
  assert.equal((await requestFinish(deps, saved, true)).outcome, "pending");
  assert.equal((await requestFinish(deps, saved)).requestKey, requestId);
  assert.deepEqual(calls.map(call => call.method), ["POST", "GET"]);
  assert.equal(new Headers(calls[0].headers).get("Idempotency-Key"), requestId);
});

test("approved background music loads with browser native fetch semantics", async () => {
  const music = await loadWorkflowDefaultMusic({ token, assertActive() {}, fetch: browserFetch((_url, init) => {
    assert.equal(init?.method, "GET");
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg", "X-Explore-Music-Loopable": "true" } });
  }) });
  assert.equal(music.file.type, "audio/mpeg");
  assert.equal(music.file.size, 3);
  assert.equal(music.playback, "repeat");
});
