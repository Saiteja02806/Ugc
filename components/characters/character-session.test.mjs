import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React from "react";
import { CHARACTER_SESSION_IDLE_TIMEOUT_MS, EMPTY_CHARACTER_SESSION, characterSessionStorageKey } from "../../lib/characters/client-session.ts";

let cache, storage, calls, responseFor, rendering, now, timers, listeners, documentListeners, invalidated;
const key = JSON.stringify;
const client = { getQueryData: (k) => cache.get(key(k)),
  setQueryData: (k, value) => cache.set(key(k), typeof value === "function" ? value(cache.get(key(k))) : value),
  invalidateQueries: async ({ queryKey }) => { invalidated.push(queryKey); }, cancelQueries: async () => {} };
function slot(initial) {
  const index = rendering.index++;
  if (!(index in rendering.slots)) rendering.slots[index] = typeof initial === "function" ? initial() : initial;
  return [rendering.slots, index];
}
mock.module("react", { defaultExport: React, namedExports: { ...React,
  useCallback: (callback) => callback,
  useRef: (value) => { const [slots, index] = slot(() => ({ current: value })); return slots[index]; },
  useState: (initial) => { const [slots, index] = slot(initial); return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
  useEffect: (effect, deps) => {
    const [slots, index] = slot(null);
    const previous = slots[index];
    if (!previous || !deps || deps.some((value, i) => value !== previous.deps[i])) {
      previous?.cleanup?.();
      slots[index] = { deps, cleanup: effect() };
    }
  },
} });
mock.module("@tanstack/react-query", { namedExports: {
  useQueryClient: () => client,
  useQuery: (options) => {
    if (options.enabled && options.queryKey[0] === "character-session" && !cache.has(key(options.queryKey))) cache.set(key(options.queryKey), options.queryFn());
    if (!cache.has(key(options.queryKey)) && options.initialData) {
      const initial = options.initialData();
      if (initial !== undefined) cache.set(key(options.queryKey), initial);
    }
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
function mount(id = owner, historyOpen = false, activityPending = false) {
  const instance = { slots: [], index: 0 };
  return { render() { rendering = instance; instance.index = 0;
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Hooks are intentionally invoked in the isolated mocked runtime.
    return useCharacterBuilder(id, historyOpen, activityPending); },
    unmount() { for (const value of instance.slots) value?.cleanup?.(); } };
}
function restore(status = completed, activity = now) {
  storage.set(characterSessionStorageKey(owner), JSON.stringify({ ...EMPTY_CHARACTER_SESSION, jobs: [receipt], lastActivityAt: activity }));
  cache.set(key(jobKey), [status]);
}
function completedVisit(historyOpen = false, activityPending = false) {
  restore({ ...completed, status: "processing", isTerminal: false, output: null });
  const screen = mount(owner, historyOpen, activityPending);
  screen.render();
  cache.set(key(jobKey), [completed]);
  screen.render();
  return screen;
}
function advance(milliseconds) {
  now += milliseconds;
  for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
}
beforeEach(() => {
  cache = new Map(); storage = new Map(); calls = []; invalidated = [];
  now = 1_700_000_000_000; timers = new Map(); listeners = new Map(); documentListeners = new Map();
  mock.method(Date, "now", () => now);
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout(callback, delay) { const id = Symbol(); timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(event, handler) { listeners.set(event, handler); },
    removeEventListener(event, handler) { if (listeners.get(event) === handler) listeners.delete(event); },
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    addEventListener(event, handler) { documentListeners.set(event, handler); },
    removeEventListener(event, handler) { if (documentListeners.get(event) === handler) documentListeners.delete(event); },
  } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } });
  responseFor = async (path) => path.includes("/status") ? Response.json({ ok: true, job: completed })
    : Response.json({ ok: true, jobs: [receipt] });
  mock.method(globalThis, "fetch", async (path, options) => { calls.push({ path, options }); return responseFor(path, options); });
});
afterEach(() => { mock.restoreAll(); delete globalThis.window; delete globalThis.document; });

test("completed results stay in History on reload and cached route re-entry even before idle expiry", async () => {
  restore();
  cache.set(key(["character-history", owner]), { pages: [{ images: [image] }] });
  const first = mount(owner, true);
  assert.deepEqual(first.render().visibleJobs, []);
  await first.render().jobs.refetch();
  assert.deepEqual(first.render().visibleJobs, []);
  assert.equal(first.render().historyImages[0].url, image.url);
  first.unmount();
  assert.deepEqual(mount().render().visibleJobs, []);
  assert.equal(calls.some((call) => call.path.includes("/generate")), false);
  assert.equal(JSON.parse(storage.get(characterSessionStorageKey(owner))).jobs[0].jobId, jobId);
});

for (const status of ["failed", "cancelled"]) test(`a completed+${status} two-image batch stays out of the refreshed workspace without another paid request`, async () => {
  const second = { jobId: "33333333-3333-4333-8333-333333333333", generationId: "generation-2" };
  const receipts = [receipt, second];
  const failed = { id: second.jobId, model: "gpt_image_2_5", status, isTerminal: true, output: null,
    error: "The model provider blocked this generation through content moderation." };
  storage.set(characterSessionStorageKey(owner), JSON.stringify({ ...EMPTY_CHARACTER_SESSION, jobs: receipts }));
  responseFor = async path => Response.json({ ok: true, job: path.includes(second.jobId) ? failed : { ...completed, model: "gpt_image_2_5" } });
  // A hard reload starts with no query cache and must recover both durable jobs.
  const screen = mount();
  await screen.render().jobs.refetch();
  assert.deepEqual(screen.render().visibleJobs, []);
  assert.equal(screen.render().visibleStatuses[1].model, "gpt_image_2_5");
  assert.equal(screen.render().inProgress, false);
  screen.unmount();
  assert.deepEqual(mount().render().visibleJobs, []);
  assert.equal(calls.some(call => call.path.includes("/generate")), false);
  const next = mount();
  next.render().startNewSession();
  assert.deepEqual(next.render().visibleJobs, []);
  assert.deepEqual(next.render().session.jobs, []);
});

test("new generations stay visible during the current visit and move to History on the next visit", async () => {
  const screen = mount();
  await screen.render().generate.mutateAsync(request);
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  await screen.render().jobs.refetch();
  assert.equal(screen.render().visibleStatuses[0].output.url, image.url);
  screen.unmount();
  assert.deepEqual(mount().render().visibleJobs, []);
});

test("consecutive batches append every image and poll only their new jobs", async () => {
  const receipts = Array.from({ length: 6 }, (_, index) => ({
    jobId: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`, generationId: `generation-${index}`,
  }));
  let batch = receipts.slice(0, 3);
  responseFor = async (path) => path.includes("/generate") ? Response.json({ ok: true, jobs: batch })
    : Response.json({ ok: true, job: { ...completed, id: new URL(path, "https://example.test").searchParams.get("jobId") } });
  const screen = mount();
  await screen.render().generate.mutateAsync({ ...request, imageCount: 3 });
  await screen.render().jobs.refetch();
  const afterFirst = invalidated.length;
  await screen.render().jobs.refetch();
  assert.equal(invalidated.length, afterFirst, "already completed images cannot continually refetch gallery/history");
  batch = receipts.slice(3);
  await screen.render().generate.mutateAsync({ ...request, imageCount: 3, idempotencyKey: "second" });
  assert.deepEqual(screen.render().visibleJobs, receipts);
  assert.equal(screen.render().visibleStatuses.filter((job) => job.output).length, 3, "completed outputs remain visible while the next batch starts");
  await screen.render().jobs.refetch();
  assert.equal(screen.render().visibleStatuses.filter((job) => job.output).length, 6);
  assert.equal(calls.filter((call) => call.path.includes("/status")).length, 6, "older terminal jobs are never polled again");
  screen.unmount();
  assert.deepEqual(mount().render().visibleJobs, []);
  assert.equal(JSON.parse(storage.get(characterSessionStorageKey(owner))).jobs.length, 6);
});

test("ten idle minutes clear the canvas and selected identity while durable History stays intact", () => {
  const screen = completedVisit(true);
  cache.set(key(["character-session", owner]), { ...EMPTY_CHARACTER_SESSION, jobs: [receipt], lastActivityAt: now,
    selectedCharacterId: image.mediaAssetId });
  cache.set(key(["character-history", owner]), { pages: [{ images: [image] }] });
  assert.equal(screen.render().sessionResetVersion, 0);
  advance(CHARACTER_SESSION_IDLE_TIMEOUT_MS - 1);
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  advance(1);
  const fresh = screen.render();
  assert.deepEqual(fresh.visibleJobs, []);
  assert.equal(fresh.session.selectedCharacterId, null);
  assert.equal(fresh.sessionResetVersion, 1);
  assert.equal(fresh.historyImages[0].url, image.url);
  assert.equal(calls.length, 0);
});

test("an active reference upload protects the current session until it settles", () => {
  const screen = completedVisit(false, true);
  screen.render();
  advance(CHARACTER_SESSION_IDLE_TIMEOUT_MS + 1);
  listeners.get("focus")();
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  screen.render().startNewSession();
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  screen.render().touchSession();
  screen.unmount();
  const settled = mount();
  settled.render();
  advance(CHARACTER_SESSION_IDLE_TIMEOUT_MS);
  assert.deepEqual(settled.render().visibleJobs, []);
});

test("typing or reference activity extends the window without changing the reset version", () => {
  const screen = completedVisit();
  screen.render();
  advance(CHARACTER_SESSION_IDLE_TIMEOUT_MS - 1_000);
  screen.render().touchSession();
  screen.render();
  advance(1_000);
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  assert.equal(screen.render().sessionResetVersion, 0);
  advance(CHARACTER_SESSION_IDLE_TIMEOUT_MS - 1_000);
  assert.deepEqual(screen.render().visibleJobs, []);
  assert.equal(screen.render().sessionResetVersion, 1);
});

test("expired route re-entry starts a fresh session and browser focus handles suspended timers", () => {
  const first = completedVisit();
  first.render();
  first.unmount();
  now += CHARACTER_SESSION_IDLE_TIMEOUT_MS;
  const next = mount();
  next.render();
  assert.deepEqual(next.render().visibleJobs, []);
  assert.equal(next.render().sessionResetVersion, 1);
  next.render().chooseCharacter(image.mediaAssetId);
  next.render();
  now += CHARACTER_SESSION_IDLE_TIMEOUT_MS;
  listeners.get("focus")();
  assert.equal(next.render().session.selectedCharacterId, null);
  assert.equal(next.render().sessionResetVersion, 2);
});

test("an expired hard reload first verifies unknown jobs before clearing the old session", async () => {
  restore(completed, now - CHARACTER_SESSION_IDLE_TIMEOUT_MS);
  cache.delete(key(jobKey));
  const screen = mount();
  assert.equal(screen.render().inProgress, true);
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  await screen.render().jobs.refetch();
  screen.render();
  assert.deepEqual(screen.render().visibleJobs, []);
  assert.equal(screen.render().sessionResetVersion, 1);
  assert.equal(calls.length, 1, "checking the durable job never re-generates an image");
});

test("idle rollover waits for a running image and gives its completed output a full new window", async () => {
  restore({ ...completed, status: "processing", isTerminal: false, output: null }, now - CHARACTER_SESSION_IDLE_TIMEOUT_MS);
  const screen = mount();
  assert.equal(screen.render().sessionResetVersion, 0);
  advance(CHARACTER_SESSION_IDLE_TIMEOUT_MS);
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  await screen.render().jobs.refetch();
  assert.equal(screen.render().session.lastActivityAt, now);
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  advance(CHARACTER_SESSION_IDLE_TIMEOUT_MS);
  assert.deepEqual(screen.render().visibleJobs, []);
  assert.equal(screen.render().sessionResetVersion, 1);
});

test("uncertain admission survives idle time and retry sends the exact original request", async () => {
  storage.set(characterSessionStorageKey(owner), JSON.stringify({ ...EMPTY_CHARACTER_SESSION,
    lastActivityAt: now - CHARACTER_SESSION_IDLE_TIMEOUT_MS, pendingRequest: request }));
  const screen = mount();
  screen.render();
  advance(CHARACTER_SESSION_IDLE_TIMEOUT_MS);
  assert.deepEqual(screen.render().session.pendingRequest, request);
  await screen.render().generate.mutateAsync({ ...request, prompt: "A changed draft", idempotencyKey: "incorrect-new-key" });
  assert.deepEqual(JSON.parse(calls[0].options.body), request);
  assert.equal(screen.render().sessionResetVersion, 0);
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

test("a reload recovers only unfinished candidates while hiding completed siblings", async () => {
  const pending = { jobId: "33333333-3333-4333-8333-333333333333", generationId: "generation-2" };
  storage.set(characterSessionStorageKey(owner), JSON.stringify({ ...EMPTY_CHARACTER_SESSION,
    jobs: [receipt, pending], lastActivityAt: now }));
  let pendingStatus = { ...completed, id: pending.jobId, status: "processing", isTerminal: false, output: null };
  responseFor = async (path) => Response.json({ ok: true, job: path.includes(pending.jobId) ? pendingStatus : completed });
  const screen = mount();
  await screen.render().jobs.refetch();
  assert.deepEqual(screen.render().visibleJobs, [pending]);
  pendingStatus = { ...completed, id: pending.jobId };
  await screen.render().jobs.refetch();
  assert.deepEqual(screen.render().visibleJobs, [pending], "the recovered candidate stays visible when it finishes during this visit");
  assert.equal(screen.render().inProgress, false);
  screen.unmount();
  assert.deepEqual(mount().render().visibleJobs, []);
});

test("unknown jobs checked as already complete never reopen historical results", async () => {
  restore(); cache.delete(key(jobKey));
  const screen = mount();
  await screen.render().jobs.refetch();
  assert.deepEqual(screen.render().visibleJobs, []);
  assert.equal(screen.render().inProgress, false);
  assert.equal(calls.length, 1);
  assert.ok(invalidated.some((queryKey) => queryKey[0] === "character-history"));
});

test("stale unfinished batch cache cannot reopen an individually completed historical job", async () => {
  restore({ ...completed, status: "processing", isTerminal: false, output: null });
  cache.set(key(["character-job", owner, jobId]), completed);
  const screen = mount();
  screen.render();
  await screen.render().jobs.refetch();
  assert.deepEqual(screen.render().visibleJobs, []);
  assert.equal(calls.length, 0, "the known immutable result requires no status request");
});

test("a failed recovery check does not make an already completed job a current-visit result", async () => {
  const second = { jobId: "33333333-3333-4333-8333-333333333333", generationId: "generation-2" };
  storage.set(characterSessionStorageKey(owner), JSON.stringify({ ...EMPTY_CHARACTER_SESSION, jobs: [receipt, second] }));
  let unavailable = true;
  responseFor = async (path) => path.includes(jobId) && unavailable
    ? Response.json({ ok: false, error: "Temporary outage" }, { status: 503 })
    : Response.json({ ok: true, job: { ...completed, id: path.includes(jobId) ? jobId : second.jobId } });
  const screen = mount();
  await screen.render().jobs.refetch();
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  unavailable = false;
  await screen.render().jobs.refetch();
  assert.deepEqual(screen.render().visibleJobs, []);
});

test("unknown recovery remains visible and blocks a replacement", async () => {
  restore(); cache.delete(key(jobKey));
  responseFor = async () => Response.json({ ok: false, error: "Could not check this image" }, { status: 503 });
  const screen = mount();
  await assert.rejects(screen.render().jobs.refetch(), /Could not check/);
  assert.equal(screen.render().inProgress, true);
  assert.deepEqual(screen.render().visibleJobs, [receipt]);
  screen.render().startNewSession();
  assert.deepEqual(screen.render().session.jobs, [receipt]);
});

test("a generation admitted after leaving is retained for recovery but finished output belongs to History", async () => {
  let finish;
  responseFor = async () => new Promise((resolve) => { finish = resolve; });
  const first = mount();
  const admission = first.render().generate.mutateAsync(request);
  await new Promise((resolve) => setImmediate(resolve));
  first.unmount();
  finish(Response.json({ ok: true, jobs: [receipt] }));
  await admission;
  assert.deepEqual(first.render().visibleJobs, [receipt]);
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
