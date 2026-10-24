import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

let acquireToken;
const owners = [];
mock.module("../firebase/auth.ts", { namedExports: {
  getCurrentUserIdToken: (owner) => { owners.push(owner); return acquireToken(); },
} });
const { analyticsRequest } = await import("./request-client.ts");
const originalFetch = globalThis.fetch;
beforeEach(() => { acquireToken = async () => "owner-token"; owners.length = 0; });
afterEach(() => { mock.restoreAll(); globalThis.fetch = originalFetch; });

test("owner-scoped analytics reads send the bounded signal and validate the result", async () => {
  let request;
  globalThis.fetch = async (url, init) => { request = { url, init }; return Response.json({ ok: true, data: { accounts: [] } }); };
  const result = await analyticsRequest("/api/analytics/instagram/content?days=30", "owner-a", new AbortController().signal);
  assert.deepEqual(owners, ["owner-a"]);
  assert.deepEqual(result.data, { accounts: [] });
  assert.equal(request.init.headers.Authorization, "Bearer owner-token");
  assert.equal(request.init.method, "GET");
  assert.equal(request.init.signal.aborted, false);
});

test("stalled authentication times out and a late token cannot start analytics work", async () => {
  const deadline = new AbortController();
  mock.method(AbortSignal, "timeout", () => deadline.signal);
  let finishToken, fetches = 0;
  acquireToken = () => new Promise(resolve => { finishToken = resolve; });
  globalThis.fetch = async () => { fetches++; return Response.json({ ok: true }); };
  const pending = analyticsRequest("/api/analytics/instagram/content", "owner-a", new AbortController().signal);
  deadline.abort();
  await assert.rejects(pending, /Loading took too long/);
  finishToken("late-token");
  await Promise.resolve();
  assert.equal(fetches, 0);
});

test("navigation cancels stalled authentication before it can dispatch a refresh", async () => {
  const caller = new AbortController();
  let finishToken, fetches = 0;
  acquireToken = () => new Promise(resolve => { finishToken = resolve; });
  globalThis.fetch = async () => { fetches++; return Response.json({ ok: true }); };
  const pending = analyticsRequest("/api/analytics/instagram/content", "owner-a", caller.signal, { force: true });
  const reason = new Error("Owner changed");
  caller.abort(reason);
  await assert.rejects(pending, error => error === reason);
  finishToken("late-token");
  await Promise.resolve();
  assert.equal(fetches, 0);
});

for (const stage of ["transport", "response body"]) {
  test(`a stalled ${stage} reaches the same deadline without retrying`, async () => {
    const deadline = new AbortController();
    mock.method(AbortSignal, "timeout", () => deadline.signal);
    let fetches = 0, requestSignal;
    globalThis.fetch = async (_url, init) => {
      fetches++; requestSignal = init.signal;
      if (stage === "transport") return new Promise(() => {});
      return { ok: true, json: () => new Promise(() => {}) };
    };
    const pending = analyticsRequest("/api/analytics/youtube/channel", "owner-a", new AbortController().signal);
    await Promise.resolve(); await Promise.resolve();
    deadline.abort();
    await assert.rejects(pending, /Loading took too long/);
    assert.equal(fetches, 1);
    assert.equal(requestSignal.aborted, true);
  });
}

test("unauthenticated and pre-cancelled reads never issue HTTP requests", async () => {
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; return Response.json({ ok: true }); };
  acquireToken = async () => null;
  await assert.rejects(analyticsRequest("/api/analytics/tiktok/videos", "owner-a", new AbortController().signal), /Sign in/);
  const cancelled = new AbortController(); cancelled.abort(new Error("Already left"));
  owners.length = 0;
  await assert.rejects(analyticsRequest("/api/analytics/tiktok/videos", "owner-a", cancelled.signal), /Already left/);
  assert.deepEqual(owners, []);
  assert.equal(fetches, 0);
});
