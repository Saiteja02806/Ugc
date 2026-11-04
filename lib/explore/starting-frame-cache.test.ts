import assert from "node:assert/strict";
import test from "node:test";
import { createStartingFrameCache, type StartingFrameRequest } from "./starting-frame-cache.ts";

const input = { ownerId: "a", referenceId: "one", sourceSha256: "source" };
const value = () => ({ referenceId: "one", sourceSha256: "source", frame: { index: 0, timeSeconds: 0, width: 10, height: 20, sha256: "frame" }, blob: new Blob(["1234"]) });

test("preload and modal share bytes; owner, source and full historical bindings stay isolated", async () => {
  const cache = createStartingFrameCache(); let reads = 0;
  const load = async () => { reads++; return value(); };
  await Promise.all([cache.read(input, load), cache.read(input, load)]); assert.equal(reads, 1);
  const first = await cache.read(input, load); first.frame.index = 9;
  assert.equal((await cache.read(input, load)).frame.index, 0);
  for (const patch of [{ ownerId: "b" }, { sourceSha256: "new" }, { referenceId: "two" },
    { retainedFrame: { ...value().frame, timeSeconds: 1 } }, { retainedFrame: { ...value().frame, timeSeconds: 2 } }]) await cache.read({ ...input, ...patch }, load);
  assert.equal(reads, 6);
});

test("one consumer cancelling does not cancel another; all consumers cancelling aborts transport and permits retry", async () => {
  const cache = createStartingFrameCache(); let complete!: (result: ReturnType<typeof value>) => void;
  const a = new AbortController(), b = new AbortController(); let signal!: AbortSignal;
  const load = async (s: AbortSignal) => { signal = s; return new Promise<ReturnType<typeof value>>(resolve => { complete = resolve; }); };
  const first = cache.read({ ...input, signal: a.signal }, load), second = cache.read({ ...input, signal: b.signal }, load);
  await Promise.resolve(); a.abort(); await assert.rejects(first); assert.equal(signal.aborted, false);
  complete(value()); await second;
  const c = new AbortController(); const pending = cache.read({ ...input, referenceId: "other", signal: c.signal }, load);
  await Promise.resolve(); c.abort(); await assert.rejects(pending); assert.equal(signal.aborted, true);
  complete(value()); await Promise.resolve();
  let retried = false; await cache.read({ ...input, referenceId: "other" }, async () => { retried = true; return value(); }); assert(retried);
});

test("errors are retryable; LRU, byte and expiry limits bound memory; speculative concurrency is capped", async () => {
  let time = 0, reads = 0;
  const cache = createStartingFrameCache({ now: () => time, ttlMs: 10, maxEntries: 2, maxBytes: 8 });
  const load = async () => { reads++; return value(); };
  await assert.rejects(cache.read(input, async () => { throw Error("failed"); }));
  await cache.read(input, load); await cache.read({ ...input, referenceId: "2" }, load); await cache.read({ ...input, referenceId: "3" }, load);
  await cache.read(input, load); assert.equal(reads, 4);
  time = 11; await cache.read(input, load); assert.equal(reads, 5);
  const tiny = createStartingFrameCache({ maxBytes: 3 }); await tiny.read(input, load); await tiny.read(input, load); assert.equal(reads, 7);
  const ends: ((v: ReturnType<typeof value>) => void)[] = [];
  const blocked = (i: StartingFrameRequest) => cache.read(i, () => new Promise(resolve => ends.push(resolve)));
  const pending = [blocked({ ...input, referenceId: "x" }), blocked({ ...input, referenceId: "y" })];
  assert.equal(cache.canPrefetch({ ...input, referenceId: "z" }), false);
  await Promise.resolve(); ends.forEach(resolve => resolve(value())); await Promise.all(pending);
});
