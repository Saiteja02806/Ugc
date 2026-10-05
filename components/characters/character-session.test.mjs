import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React from "react";
import { EMPTY_CHARACTER_SESSION, characterSessionStorageKey } from "../../lib/characters/client-session.ts";

let cache, storage, calls, responseFor, rendering;
const key = JSON.stringify;
const client = { getQueryData: (k) => cache.get(key(k)),
  setQueryData: (k, value) => cache.set(key(k), typeof value === "function" ? value(cache.get(key(k))) : value),
  invalidateQueries: async () => {}, cancelQueries: async () => {} };
function slot(initial) {
  const index = rendering.index++;
  if (!(index in rendering.slots)) rendering.slots[index] = typeof initial === "function" ? initial() : initial;
  return [rendering.slots, index];
}
mock.module("react", { defaultExport: React, namedExports: { ...React,
  useRef: (value) => { const [slots, index] = slot(() => ({ current: value })); return slots[index]; },
  useState: (initial) => { const [slots, index] = slot(initial); return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
  useEffect: (effect) => { const [slots, index] = slot(null); if (!slots[index]) slots[index] = effect(); },
} });
mock.module("@tanstack/react-query", { namedExports: {
  useQueryClient: () => client,
  useQuery: (options) => {
    if (options.enabled && options.queryKey[0] === "character-session" && !cache.has(key(options.queryKey))) cache.set(key(options.queryKey), options.queryFn());
    const data = cache.get(key(options.queryKey));
    return { data, isPending: data === undefined, isError: false, error: null,
      refetch: async () => { const result = await options.queryFn({ signal: new AbortController().signal }); cache.set(key(options.queryKey), result); return result; } };
  },
  useInfiniteQuery: (options) => ({ data: cache.get(key(options.queryKey)), __options: options }),
  useMutation: (options) => ({ reset() {}, isPending: false,
    mutateAsync: async (input) => { try { const result = await options.mutationFn(input); await options.onSuccess?.(result); return result; }
      catch (error) { await options.onError?.(error); throw error; } } }),
} });
mock.module("../../lib/firebase/auth.ts", { namedExports: { getCurrentUserIdToken: async (id) => `token-${id}` } });
const { useCharacterBuilder } = await import("./use-character-builder.ts");
const owner = "owner-a";
const jobId = "11111111-1111-4111-8111-111111111111";
const receipt = { jobId, generationId: "generation-1" };
const image = { ...receipt, mediaAssetId: "22222222-2222-4222-8222-222222222222", url: "https://media.example/character.png",
  createdAt: "2026-10-05T12:00:00Z", model: "gpt_image", prompt: "A presenter", saved: false };
const completed = { id: jobId, status: "completed", isTerminal: true, output: { ...image, ratio: "9:16" }, error: null };
const request = { mode: "custom", prompt: image.prompt, model: image.model, imageCount: 1, idempotencyKey: "request-key" };
const jobKey = ["character-jobs", owner, [jobId]];
function mount(id = owner, historyOpen = false) {
  const instance = { slots: [], index: 0 };
  return { render: function CharacterTestRender() { rendering = instance; instance.index = 0; return useCharacterBuilder(id, historyOpen); },
    unmount() { for (const value of instance.slots) if (typeof value === "function") value(); } };
}
function restore(status = completed) {
  storage.set(characterSessionStorageKey(owner), JSON.stringify({ ...EMPTY_CHARACTER_SESSION, jobs: [receipt] }));
  cache.set(key(jobKey), [status]);
}
beforeEach(() => {
  cache = new Map(); storage = new Map(); calls = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } });
  responseFor = async (path) => path.includes("/status") ? Response.json({ ok: true, job: completed })
    : Response.json({ ok: true, jobs: [receipt] });
  mock.method(globalThis, "fetch", async (path, options) => { calls.push({ path, options }); return responseFor(path, options); });
});
afterEach(() => mock.restoreAll());

test("completed results are hidden on reload and cached route re-entry", async () => {
  restore();
  const first = mount();
  assert.deepEqual(first.render().visibleJobs, []);
  await first.render().jobs.refetch();
  assert.deepEqual(first.render().visibleJobs, []);
  first.unmount();
  assert.deepEqual(mount().render().visibleJobs, []);
  assert.equal(calls.some((call) => call.path.includes("/generate")), false);
  assert.equal(JSON.parse(storage.get(characterSessionStorageKey(owner))).jobs[0].jobId, jobId);
});

test("new generations stay visible for this visit, then move to history on the next visit", async () => {
  const screen = mount();
  await screen.render().generate.mutateAsync(request);
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  await screen.render().jobs.refetch();
  assert.equal(screen.render().visibleStatuses[0].output.url, image.url);
  screen.unmount();
  assert.deepEqual(mount().render().visibleJobs, []);
});

test("unfinished recovery remains visible after completion in the same session", async () => {
  restore({ ...completed, status: "processing", isTerminal: false, output: null });
  const screen = mount();
  assert.equal(screen.render().inProgress, true);
  responseFor = async () => Response.json({ ok: true, job: { ...completed, status: "processing", isTerminal: false, output: null } });
  await screen.render().jobs.refetch();
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  responseFor = async () => Response.json({ ok: true, job: completed });
  await screen.render().jobs.refetch();
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  assert.equal(screen.render().inProgress, false);
  screen.unmount();
  assert.deepEqual(mount().render().visibleJobs, []);
});

test("unknown recovery blocks a replacement without presenting an old result", async () => {
  restore(); cache.delete(key(jobKey));
  responseFor = async () => Response.json({ ok: false, error: "Could not check this image" }, { status: 503 });
  const screen = mount();
  await assert.rejects(screen.render().jobs.refetch(), /Could not check/);
  assert.equal(screen.render().inProgress, true);
  assert.deepEqual(screen.render().visibleJobs, []);
  screen.render().startNewSession();
  assert.deepEqual(screen.render().session.jobs, [receipt]);
});

test("a generation admitted after leaving is recovered without reviving completed foreground results", async () => {
  let finish;
  responseFor = async () => new Promise((resolve) => { finish = resolve; });
  const first = mount();
  const admission = first.render().generate.mutateAsync(request);
  await new Promise((resolve) => setImmediate(resolve));
  first.unmount();
  finish(Response.json({ ok: true, jobs: [receipt] }));
  await admission;
  assert.deepEqual(first.render().visibleJobs, []);
  cache.set(key(jobKey), [completed]);
  const next = mount();
  assert.deepEqual(next.render().visibleJobs, []);
  assert.deepEqual(next.render().session.jobs, [receipt]);
  assert.equal(calls.length, 1);
});

test("history opens only by explicit selection and new session preserves durable images", async () => {
  restore();
  cache.set(key(["character-history", owner]), { pages: [{ images: [image] }, { images: [image] }] });
  const screen = mount(owner, true);
  assert.equal(screen.render().historyImages.length, 1);
  assert.deepEqual(screen.render().visibleJobs, []);
  screen.render().openHistoryImage(image);
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  assert.equal(screen.render().visibleStatuses[0].output.url, image.url);
  screen.render().returnToSession();
  assert.deepEqual(screen.render().visibleJobs, []);
  screen.render().openHistoryImage(image);
  screen.render().startNewSession();
  assert.deepEqual(screen.render().visibleJobs, []);
  assert.equal(screen.render().historyImages.length, 1);
  assert.equal(calls.length, 0);
});

test("new session cannot discard an uncertain request or active batch", () => {
  restore({ ...completed, status: "processing", isTerminal: false, output: null });
  const screen = mount();
  screen.render().startNewSession();
  assert.deepEqual(screen.render().session.jobs, [receipt]);
  screen.render().openHistoryImage(image);
  assert.equal(screen.render().historyImage, null);
  cache.set(key(jobKey), [completed]);
  cache.set(key(["character-session", owner]), { ...EMPTY_CHARACTER_SESSION, jobs: [receipt], pendingRequest: request });
  screen.render().startNewSession();
  assert.deepEqual(screen.render().session.pendingRequest, request);
});

test("history and foreground state never cross accounts", () => {
  restore();
  cache.set(key(["character-history", owner]), { pages: [{ images: [image] }] });
  const other = mount("owner-b", true).render();
  assert.deepEqual(other.historyImages, []);
  assert.deepEqual(other.visibleJobs, []);
  assert.deepEqual(other.history.__options.queryKey, ["character-history", "owner-b"]);
});
