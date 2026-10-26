import assert from "node:assert/strict";
import test from "node:test";
import { requestWorkflowSchedule } from "./workflow-schedule-transport.ts";
import { ScheduleRequestError } from "./workflow-schedule-client.ts";

const stalled = () => new Promise<never>(() => {});
const keepAlive = () => setInterval(() => {}, 1000);

test("a transient read timeout retries once, while a mutation never retries automatically", async () => {
  for (const method of ["GET", "POST"]) {
    let calls = 0;
    const action = requestWorkflowSchedule({ token: async () => "owner-token", fetch: async () => {
      if (++calls === 1) throw new DOMException("signal timed out", "TimeoutError");
      return Response.json({ ok: true });
    } }, "/api/schedules", { method });
    if (method === "GET") { assert.equal((await action).ok, true); assert.equal(calls, 2); }
    else { await assert.rejects(action, error => error instanceof ScheduleRequestError && error.code === "schedule_request_timeout"); assert.equal(calls, 1); }
  }
});

test("read retries are bounded and caller cancellation never retries", async () => {
  let calls = 0;
  const deps = { token: async () => "owner-token", fetch: async () => { calls++; throw new DOMException("signal timed out", "TimeoutError"); } };
  await assert.rejects(requestWorkflowSchedule(deps, "/api/schedules"), /choices are kept/);
  assert.equal(calls, 2);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(requestWorkflowSchedule(deps, "/api/schedules", { signal: controller.signal }));
  assert.equal(calls, 2);
});

test("native browser fetch is invoked without a foreign receiver", async () => {
  const result = await requestWorkflowSchedule({ token: async () => "owner-token",
    fetch: async function (this: unknown) { assert.equal(this, undefined); return Response.json({ ok: true }); },
  }, "/api/schedules");
  assert.equal(result.ok, true);
});
test("authentication, request and response-body stalls end without automatic mutation retry", async () => {
  const timer = keepAlive();
  try {
    for (const stage of ["token", "fetch", "body"]) {
      let sent = 0; let signal: AbortSignal | null = null;
      await assert.rejects(requestWorkflowSchedule({ timeoutMs: 15,
        token: stage === "token" ? stalled : async () => "owner-token",
        fetch: (async (_url, init) => {
          sent++; signal = init?.signal as AbortSignal;
          if (stage === "fetch") return stalled();
          return { ok: true, status: 200, json: stalled } as unknown as Response;
        }) as typeof fetch,
      }, "/api/schedules", { method: "POST", body: "exact-saved-request" }), /too long/);
      assert.equal(sent, stage === "token" ? 0 : 1);
      if (signal) assert.equal((signal as AbortSignal).aborted, true);
    }
  } finally { clearInterval(timer); }
});
test("late authentication cannot submit after timeout or owner change", async () => {
  let resolveToken!: (value: string) => void; let calls = 0;
  const token = new Promise<string>(resolve => { resolveToken = resolve; });
  const timer = keepAlive();
  try {
    await assert.rejects(requestWorkflowSchedule({ token: () => token, fetch: (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch,
      timeoutMs: 10 }, "/api/schedules", { method: "POST" }), /too long/);
    resolveToken("late-token"); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 0);
    await assert.rejects(requestWorkflowSchedule({ token: async () => "old-owner-token", assertActive() { throw new Error("owner changed"); },
      fetch: (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch }, "/api/schedules", { method: "POST" }), /owner changed/);
    assert.equal(calls, 0);
  } finally { clearInterval(timer); }
});
test("typed time rejections stay distinguishable from uncertain saves and the exact body is retained", async () => {
  const body = JSON.stringify({ idempotencyKey: "same-request", source: "saved-output" });
  let sent = 0;
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    sent++; assert.equal(init?.body, body); assert.ok(init?.signal instanceof AbortSignal);
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer owner-token");
    return Response.json({ ok: false, code: "schedule_time_too_soon", message: "Choose a later time" }, { status: 409 });
  }) as typeof fetch;
  await assert.rejects(requestWorkflowSchedule({ token: async () => "owner-token", fetch: fetcher }, "/api/schedules", { method: "POST", body }),
    (error: unknown) => error instanceof ScheduleRequestError && error.status === 409 && error.code === "schedule_time_too_soon");
  assert.equal(sent, 1);
});
