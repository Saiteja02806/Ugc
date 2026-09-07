import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import {
  exploreVideoLibraryQueryOptions,
  type ExploreVideoLibrary,
} from "./video-library-query.ts";

const library: ExploreVideoLibrary = {
  items: [{ id: "hook-1", posterUrl: "https://example.com/poster.webp", videoUrl: "https://example.com/video.mp4" }],
  preview: null,
};

test("a pending catalog survives loading-state observer updates", async () => {
  const client = new QueryClient();
  let signal: AbortSignal | undefined;
  let complete!: (value: ExploreVideoLibrary) => void;
  const options = exploreVideoLibraryQueryOptions({
    userId: "user-a",
    section: "hook",
    load: (requestSignal) => {
      signal = requestSignal;
      return new Promise((resolve) => { complete = resolve; });
    },
  });
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    assert.equal(observer.getCurrentResult().isPending, true);
    observer.setOptions({ ...options });
    assert.equal(signal?.aborted, false);
    complete(library);
    await delay(0);
    assert.equal(observer.getCurrentResult().isSuccess, true);
    assert.deepEqual(observer.getCurrentResult().data, library);
  } finally {
    unsubscribe();
    client.clear();
  }
});

test("abandoning a pending tab cancels it, and reopening it starts a fresh request", async () => {
  const client = new QueryClient();
  const signals: AbortSignal[] = [];
  const completions: Array<(value: ExploreVideoLibrary) => void> = [];
  const options = exploreVideoLibraryQueryOptions({
    userId: "user-a",
    section: "wall_text",
    load: (signal) => new Promise((resolve, reject) => {
      signals.push(signal);
      completions.push(resolve);
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }),
  });
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  unsubscribe();
  assert.equal(signals[0].aborted, true);
  const remount = new QueryObserver(client, options);
  const unsubscribeRemount = remount.subscribe(() => {});
  try {
    assert.equal(signals.length, 2);
    assert.equal(signals[1].aborted, false);
    completions[1](library);
    await delay(0);
    assert.equal(remount.getCurrentResult().isSuccess, true);
  } finally {
    unsubscribeRemount();
    client.clear();
  }
});

test("fresh catalogs are reused on return, with separate caches for each tab and account", async () => {
  const client = new QueryClient();
  const calls: string[] = [];
  const options = (userId: string, section: "hook" | "wall_text") => exploreVideoLibraryQueryOptions({
    userId, section,
    load: async () => { calls.push(`${userId}:${section}`); return library; },
  });
  try {
    await client.fetchQuery(options("user-a", "hook"));
    await client.fetchQuery(options("user-a", "wall_text"));
    await client.fetchQuery(options("user-a", "hook"));
    await client.fetchQuery(options("user-b", "hook"));
    assert.deepEqual(calls, ["user-a:hook", "user-a:wall_text", "user-b:hook"]);
  } finally {
    client.clear();
  }
});

test("signed-out observers do not start authenticated catalog requests", async () => {
  const client = new QueryClient();
  let calls = 0;
  const observer = new QueryObserver(client, exploreVideoLibraryQueryOptions({
    userId: null, section: "hook",
    load: async () => { calls++; return library; },
  }));
  const unsubscribe = observer.subscribe(() => {});
  try {
    await delay(0);
    assert.equal(calls, 0);
    assert.equal(observer.getCurrentResult().fetchStatus, "idle");
  } finally {
    unsubscribe();
    client.clear();
  }
});
