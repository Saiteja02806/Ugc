import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { audioLibraryQueryOptions, refreshAudioLibrary } from "./library-query.ts";
import type { AudioBootstrap } from "./types.ts";

const snapshot: AudioBootstrap = {
  configured: true, enabled: true, generationAccess: "allowed", canGenerate: true,
  canClone: false, canUpload: true, storageReady: true, message: null, account: null,
  voices: [], models: [], assets: [], requests: [], creditCostPer1000: 0,
};

test("Audio and Explore share one pending request and reuse fresh account data on return", async () => {
  const client = new QueryClient();
  let calls = 0;
  let complete!: (value: AudioBootstrap) => void;
  const options = audioLibraryQueryOptions({ userId: "alice", load: () => {
    calls++; return new Promise(resolve => { complete = resolve; });
  } });
  const audio = new QueryObserver(client, options);
  const explore = new QueryObserver(client, options);
  const stopAudio = audio.subscribe(() => {});
  const stopExplore = explore.subscribe(() => {});
  try {
    assert.equal(audio.getCurrentResult().isPending, true);
    assert.equal(calls, 1);
    complete(snapshot);
    await delay(0);
    assert.deepEqual(audio.getCurrentResult().data, snapshot);
    assert.deepEqual(explore.getCurrentResult().data, snapshot);
    stopAudio(); stopExplore();
    const returning = new QueryObserver(client, options);
    const stopReturning = returning.subscribe(() => {});
    assert.equal(returning.getCurrentResult().isPending, false);
    assert.equal(returning.getCurrentResult().isFetching, false);
    assert.equal(calls, 1);
    stopReturning();
  } finally { stopAudio(); stopExplore(); client.clear(); }
});

test("returning after five minutes renders cached voices while one live refresh is pending", async () => {
  const client = new QueryClient();
  let complete!: (value: AudioBootstrap) => void;
  let calls = 0;
  const options = audioLibraryQueryOptions({ userId: "alice", load: () => {
    calls++; return new Promise(resolve => { complete = resolve; });
  } });
  client.setQueryData(options.queryKey, snapshot, { updatedAt: Date.now() - 5 * 60_000 });
  const observer = new QueryObserver(client, options);
  const stop = observer.subscribe(() => {});
  try {
    assert.equal(calls, 1);
    assert.equal(observer.getCurrentResult().isPending, false);
    assert.equal(observer.getCurrentResult().isFetching, true);
    assert.deepEqual(observer.getCurrentResult().data, snapshot);
    complete({ ...snapshot, generationAccess: "upgrade_required", canGenerate: false });
    await delay(0);
    assert.equal(observer.getCurrentResult().isFetching, false);
    assert.equal(observer.getCurrentResult().data?.generationAccess, "upgrade_required");
    assert.equal(observer.getCurrentResult().data?.canGenerate, false);
  } finally { stop(); client.clear(); }
});

test("failed background refresh retains readable cached data and exposes the failure", async () => {
  const client = new QueryClient();
  const options = audioLibraryQueryOptions({ userId: "alice", load: async () => { throw Error("Audio availability is unavailable."); } });
  client.setQueryData(options.queryKey, snapshot, { updatedAt: Date.now() - 5 * 60_000 });
  const observer = new QueryObserver(client, options);
  const stop = observer.subscribe(() => {});
  try {
    await delay(0);
    assert.equal(observer.getCurrentResult().isPending, false);
    assert.equal(observer.getCurrentResult().isError, true);
    assert.deepEqual(observer.getCurrentResult().data, snapshot);
    assert.match(observer.getCurrentResult().error?.message ?? "", /availability/);
  } finally { stop(); client.clear(); }
});

test("manual and mutation refresh fetch new data even while the previous snapshot is fresh", async () => {
  const client = new QueryClient();
  let calls = 0;
  const next = { ...snapshot, canGenerate: false };
  const options = { userId: "alice", load: async () => { calls++; return next; } };
  client.setQueryData(audioLibraryQueryOptions(options).queryKey, snapshot);
  try {
    assert.deepEqual(await refreshAudioLibrary(client, options), next);
    assert.equal(calls, 1);
    assert.deepEqual(client.getQueryData(audioLibraryQueryOptions(options).queryKey), next);
  } finally { client.clear(); }
});

test("refresh cancels an earlier pending read so obsolete data cannot replace the new snapshot", async () => {
  const client = new QueryClient();
  let signal!: AbortSignal;
  const options = audioLibraryQueryOptions({ userId: "alice", load: requestSignal => {
    signal = requestSignal;
    return new Promise((_resolve, reject) => requestSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
  } });
  const observer = new QueryObserver(client, options);
  const stop = observer.subscribe(() => {});
  try {
    const next = { ...snapshot, generationAccess: "upgrade_required" as const };
    await refreshAudioLibrary(client, { userId: "alice", load: async () => next });
    assert.equal(signal.aborted, true);
    assert.deepEqual(client.getQueryData(options.queryKey), next);
  } finally { stop(); client.clear(); }
});

test("a different or signed-out owner never receives another owner's cached audio", async () => {
  const client = new QueryClient();
  const calls: string[] = [];
  const options = (userId: string | null) => audioLibraryQueryOptions({ userId, load: async () => {
    calls.push(userId ?? "signed-out"); return { ...snapshot, message: userId };
  } });
  try {
    await client.fetchQuery(options("alice"));
    assert.equal(client.getQueryData(options("bob").queryKey), undefined);
    await client.fetchQuery(options("bob"));
    const signedOut = new QueryObserver(client, options(null));
    const stop = signedOut.subscribe(() => {});
    assert.equal(signedOut.getCurrentResult().data, undefined);
    assert.equal(signedOut.getCurrentResult().fetchStatus, "idle");
    stop();
    assert.deepEqual(calls, ["alice", "bob"]);
    await assert.rejects(refreshAudioLibrary(client, { userId: null, load: async () => snapshot }), /session/);
  } finally { client.clear(); }
});
