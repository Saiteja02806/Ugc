import assert from "node:assert/strict";
import test from "node:test";
import { withReadDeadline } from "./read-deadline.ts";

test("a stalled authentication read reaches the deadline even before fetch starts", async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(withReadDeadline(() => new Promise(() => {}), undefined, 15), /Loading took too long/); }
  finally { clearTimeout(keepAlive); }
});
test("navigation cancellation reaches the same GET signal and preserves its reason", async () => {
  const controller = new AbortController(), reason = new Error("navigation cancelled");
  let requestSignal: AbortSignal | undefined;
  const pending = withReadDeadline(signal => { requestSignal = signal; return new Promise(() => {}); }, controller.signal);
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
  assert.equal(requestSignal?.aborted, true);
});
test("completed reads return normally and pre-aborted reads do no work", async () => {
  assert.equal(await withReadDeadline(async () => "ready"), "ready");
  const controller = new AbortController(); controller.abort(new Error("already left"));
  let called = false;
  await assert.rejects(withReadDeadline(async () => { called = true; }, controller.signal), /already left/);
  assert.equal(called, false);
});
