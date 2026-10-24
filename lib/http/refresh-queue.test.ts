import assert from "node:assert/strict";
import test from "node:test";
import { createRefreshQueue } from "./refresh-queue.ts";
import { withReadDeadline } from "./read-deadline.ts";

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test("a slow resume read is shared by focus, visibility and poll triggers; adjacent completed events stay quiet", async () => {
  let now = 10_000, calls = 0;
  const queue = createRefreshQueue(() => now); queue.activate();
  const pending = deferred();
  const read = async () => { calls++; await pending.promise; };
  const first = queue.run(read, { background: true });
  const second = queue.run(read, { background: true });
  const third = queue.run(read, { background: true });
  await tick(); assert.equal(calls, 1);
  pending.resolve(); await Promise.all([first, second, third]);
  now += 100; await queue.run(read, { background: true }); assert.equal(calls, 1);
  now += 1_000; await queue.run(read, { background: true }); assert.equal(calls, 2);
});

test("a completed mutation supersedes the older read instead of returning a pre-mutation snapshot", async () => {
  const queue = createRefreshQueue(); queue.activate();
  const old = deferred(); const received: string[] = []; let oldSignal!: AbortSignal;
  const prior = queue.run(async signal => { oldSignal = signal; await old.promise; if (!signal.aborted) received.push("old"); }, { background: true });
  await tick();
  await queue.run(async signal => { assert.equal(signal.aborted, false); received.push("fresh"); });
  assert.equal(oldSignal.aborted, true);
  old.resolve(); await prior;
  assert.deepEqual(received, ["fresh"]);
});

test("transient failures back off automatic reads but an explicit retry is immediately available", async () => {
  let now = 100_000, calls = 0;
  const queue = createRefreshQueue(() => now); queue.activate();
  const read = async () => { calls++; throw Error("offline"); };
  await assert.rejects(queue.run(read, { background: true }), /offline/);
  now += 4_000; await queue.run(read, { background: true }); assert.equal(calls, 1);
  now += 1_000; await assert.rejects(queue.run(read, { background: true }), /offline/); assert.equal(calls, 2);
  now += 5_000; await queue.run(read, { background: true }); assert.equal(calls, 2);
  await assert.rejects(queue.run(read), /offline/); assert.equal(calls, 3);
});

test("unmount/account change aborts old reads, ignores late UI writes and permits Strict Mode reactivation", async () => {
  const queue = createRefreshQueue(); queue.activate();
  const pending = deferred(); let signal!: AbortSignal; let writes = 0;
  const old = queue.run(async current => { signal = current; await pending.promise; if (!current.aborted) writes++; });
  await tick(); queue.dispose(); assert.equal(signal.aborted, true);
  await queue.run(async () => { writes++; }); assert.equal(writes, 0);
  pending.resolve(); await old;
  queue.activate(); await queue.run(async () => { writes++; }); assert.equal(writes, 1);
});

test("a token/body read that never settles times out, releases the queue and allows retry", async () => {
  const queue = createRefreshQueue(); queue.activate();
  // AbortSignal.timeout intentionally doesn't keep Node alive on its own.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    await assert.rejects(queue.run(signal => withReadDeadline(() => new Promise<void>(() => {}), signal, 10)), /too long/);
    let retried = false; await queue.run(async () => { retried = true; }); assert.equal(retried, true);
  } finally { clearInterval(keepAlive); queue.dispose(); }
});
