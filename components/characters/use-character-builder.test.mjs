import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React from "react";
import { characterSessionStorageKey, EMPTY_CHARACTER_SESSION } from "../../lib/characters/client-session.ts";
import { characterPreferenceStorageKey } from "../../lib/characters/client-preference.ts";

// Exercise the actual hook request/caching callbacks without installing a DOM renderer.
// React Query's scheduling and UI interactions are verified in the browser separately.
let cache;
let storage;
let requests;
let invalidated;
let queries;
let currentAccount;
let responseFor;
let cacheEvents;
let cancelWait;
const serializeKey = JSON.stringify;
const clone = (value) => value === undefined ? undefined : structuredClone(value);
const queryClient = {
  getQueryData: (key) => cache.get(serializeKey(key)),
  setQueryData(key, value) {
    cacheEvents.push({ event: "set", key });
    const previous = cache.get(serializeKey(key));
    cache.set(serializeKey(key), typeof value === "function" ? value(previous) : value);
  },
  invalidateQueries: async ({ queryKey }) => {
    cacheEvents.push({ event: "invalidate", key: queryKey });
    invalidated.push(queryKey);
  },
  cancelQueries: async ({ queryKey }) => {
    cacheEvents.push({ event: "cancel-start", key: queryKey });
    if (cancelWait) await cancelWait;
    cacheEvents.push({ event: "cancel-complete", key: queryKey });
  },
};

mock.module("react", { defaultExport: React, namedExports: {
  ...React, useRef: (value) => ({ current: value }), useEffect: () => {},
  useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
} });
mock.module("@tanstack/react-query", { namedExports: {
  useQueryClient: () => queryClient,
  useInfiniteQuery: (options) => ({ data: undefined, isPending: true, error: null, __options: options }),
  useQuery: (options) => {
    const key = serializeKey(options.queryKey);
    queries.set(key, options);
    if (options.enabled && ["character-session", "character-local-preference"].includes(options.queryKey[0]) && !cache.has(key)) {
      cache.set(key, options.queryFn());
    }
    const data = cache.get(key);
    return {
      data, isPending: data === undefined, isError: false, error: null,
      __options: options,
      refetch: async () => {
        const next = await options.queryFn({ signal: new AbortController().signal });
        cache.set(key, next);
        return next;
      },
    };
  },
  useMutation: (options) => ({
    isPending: false, error: null, reset() {}, __options: options,
    mutate(input) { void this.mutateAsync(input).catch(() => {}); },
    mutateAsync: async (input) => {
      try {
        const result = await options.mutationFn(input);
        await options.onSuccess?.(result, input);
        return result;
      } catch (error) {
        await options.onError?.(error, input);
        throw error;
      }
    },
  }),
} });
mock.module("../../lib/firebase/auth.ts", { namedExports: {
  getCurrentUserIdToken: async (expectedUserId) => {
    if (expectedUserId !== currentAccount) throw new Error("Your signed-in account changed.");
    return `test-token-for-${expectedUserId}`;
  },
} });
const { useCharacterBuilder } = await import("./use-character-builder.ts");
const { useCharacterPreference } = await import("./use-character-preference.ts");

const JOB_ONE = "11111111-1111-4111-8111-111111111111";
const JOB_TWO = "22222222-2222-4222-8222-222222222222";
const GENERATION_ID = "33333333-3333-4333-8333-333333333333";
const CHARACTER_ID = "44444444-4444-4444-8444-444444444444";
const receipt = { jobId: JOB_ONE, generationId: GENERATION_ID };
const generation = { ok: true, requestedCount: 1, partial: false, jobs: [receipt], message: "Creating your influencer." };
const publicCharacter = { id: CHARACTER_ID, name: "Maya", url: "https://media.example.com/portrait.png", gender: "female", model: "gpt_image", createdAt: "2026-10-02T12:00:00.000Z" };
const request = { mode: "custom", prompt: "An adult creator in a studio", model: "gpt_image", idempotencyKey: "same-request-key" };
const getSession = (userId) => cache.get(serializeKey(["character-session", userId]));
const setSession = (userId, changes) => cache.set(serializeKey(["character-session", userId]), { ...clone(EMPTY_CHARACTER_SESSION), ...changes });

beforeEach(() => {
  cache = new Map(); storage = new Map(); requests = []; invalidated = []; queries = new Map(); cacheEvents = []; cancelWait = null;
  currentAccount = "account-a";
  responseFor = async () => Response.json(generation, { status: 202 });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } });
  mock.method(globalThis, "fetch", async (path, init) => {
    requests.push({ path, init, body: init.body ? JSON.parse(init.body) : null });
    return responseFor(path, init);
  });
});
afterEach(() => { mock.restoreAll(); });

test("a fresh account waits for its saved preference, then remembers the first gender choice across reloads", async () => {
  responseFor = async (_path, init) => Response.json({ ok: true, preference: { seen: init.method === "POST", gender: init.body ? JSON.parse(init.body).gender ?? null : null } });
  const first = useCharacterPreference("account-a", true);
  assert.equal(first.ready, false);
  await queries.get(serializeKey(["character-preference", "account-a"])).queryFn({ signal: new AbortController().signal }).then((data) => cache.set(serializeKey(["character-preference", "account-a"]), data));
  const ready = useCharacterPreference("account-a", true);
  assert.equal(ready.ready, true);
  assert.equal(ready.preference.seen, false);
  ready.remember("female");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(useCharacterPreference("account-a", true).preference, { seen: true, gender: "female" });
  assert.deepEqual(requests.find((call) => call.init.method === "POST").body, { gender: "female" });
  cache.clear();
  const restored = useCharacterPreference("account-a", true);
  assert.equal(restored.ready, true);
  assert.deepEqual(restored.preference, { seen: true, gender: "female" });
});

test("saved account preferences suppress onboarding on a new browser", async () => {
  responseFor = async () => Response.json({ ok: true, preference: { seen: true, gender: "male" } });
  const first = useCharacterPreference("account-a", true);
  assert.equal(first.ready, false);
  await queries.get(serializeKey(["character-preference", "account-a"])).queryFn({ signal: new AbortController().signal }).then((data) => cache.set(serializeKey(["character-preference", "account-a"]), data));
  const restored = useCharacterPreference("account-a", true);
  assert.equal(restored.ready, true);
  assert.deepEqual(restored.preference, { seen: true, gender: "male" });
  assert.deepEqual(JSON.parse(storage.get(characterPreferenceStorageKey("account-a"))), restored.preference);
});

test("dismissing onboarding without choosing gender is remembered and guest preferences remain account isolated", () => {
  const guest = useCharacterPreference(null, true);
  assert.equal(guest.ready, true);
  guest.remember(null);
  cache.clear();
  assert.deepEqual(useCharacterPreference(null, true).preference, { seen: true, gender: null });
  assert.deepEqual(useCharacterPreference("account-a", true).preference, { seen: false, gender: null });
  assert.equal(requests.length, 0);
  assert.notEqual(characterPreferenceStorageKey(null), characterPreferenceStorageKey("guest"));
});

test("a slow preference read cannot overwrite a newly selected gender", async () => {
  let finishRead;
  responseFor = async (_path, init) => init.method === "POST"
    ? Response.json({ ok: true, preference: { seen: true, gender: JSON.parse(init.body).gender } })
    : new Promise((resolve) => { finishRead = resolve; });
  const preference = useCharacterPreference("account-a", true);
  const read = queries.get(serializeKey(["character-preference", "account-a"])).queryFn({ signal: new AbortController().signal });
  await new Promise((resolve) => setImmediate(resolve));
  preference.remember("male");
  await new Promise((resolve) => setImmediate(resolve));
  finishRead(Response.json({ ok: true, preference: { seen: true, gender: "female" } }));
  cache.set(serializeKey(["character-preference", "account-a"]), await read);
  assert.deepEqual(useCharacterPreference("account-a", true).preference, { seen: true, gender: "male" });
});

test("a temporary preference save outage retains the choice locally and cannot send it under a different account", async () => {
  responseFor = async () => Response.json({ ok: false, error: "Unavailable" }, { status: 503 });
  useCharacterPreference("account-a", true).remember("female");
  await new Promise((resolve) => setImmediate(resolve));
  cache.clear();
  assert.deepEqual(useCharacterPreference("account-a", true).preference, { seen: true, gender: "female" });
  currentAccount = "account-b";
  const before = requests.length;
  await assert.rejects(useCharacterPreference("account-a", true).save.mutateAsync("male"), /account changed/);
  assert.equal(requests.length, before);
  assert.deepEqual(useCharacterPreference("account-b", true).preference, { seen: false, gender: null });
});

test("an uncertain request survives refresh with its original key and retries the same generation", async () => {
  responseFor = async () => { throw new Error("network interrupted after admission"); };
  const builder = useCharacterBuilder("account-a");
  await assert.rejects(builder.generate.mutateAsync(request), /network interrupted/);
  const saved = JSON.parse(storage.get(characterSessionStorageKey("account-a")));
  assert.deepEqual(saved.pendingRequest, request);
  cache.clear();
  const restored = useCharacterBuilder("account-a");
  assert.deepEqual(restored.session.pendingRequest, request);
  responseFor = async () => Response.json(generation, { status: 202 });
  await restored.generate.mutateAsync(restored.session.pendingRequest);
  assert.deepEqual(requests.map((call) => call.body.idempotencyKey), ["same-request-key", "same-request-key"]);
  assert.deepEqual(getSession("account-a").jobs, [receipt]);
  assert.equal(getSession("account-a").pendingRequest, null);
  assert.ok(invalidated.some((key) => serializeKey(key) === serializeKey(["character-access", "account-a"])));
});

test("synchronous duplicate submissions share one provider-admission request", async () => {
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  responseFor = async () => response;
  const builder = useCharacterBuilder("account-a");
  const first = builder.generate.mutateAsync(request);
  const second = builder.generate.mutateAsync({ ...request, idempotencyKey: "accidental-second-key" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  finish(Response.json(generation, { status: 202 }));
  assert.deepEqual(await first, await second);
  assert.equal(requests[0].body.idempotencyKey, request.idempotencyKey);
  assert.equal(getSession("account-a").pendingRequest, null);
});

test("confirmed access/input failures unlock a fresh request; uncertain server failures preserve the key", async () => {
  const builder = useCharacterBuilder("account-a");
  for (const status of [400, 401, 403, 402]) {
    responseFor = async () => Response.json({ ok: false, message: "confirmed rejection" }, { status });
    await assert.rejects(builder.generate.mutateAsync(request), /confirmed rejection/);
    assert.equal(getSession("account-a").pendingRequest, null);
  }
  responseFor = async () => Response.json({ ok: false, message: "admission outcome unknown" }, { status: 503 });
  await assert.rejects(useCharacterBuilder("account-a").generate.mutateAsync(request), /outcome unknown/);
  assert.deepEqual(getSession("account-a").pendingRequest, request);
});

test("account changes do not reuse tokens, jobs, selected identities or pending requests", async () => {
  setSession("account-a", { selectedCharacterId: CHARACTER_ID, jobs: [receipt], pendingRequest: request });
  cache.set(serializeKey(["characters", "account-a"]), { ok: true, characters: [publicCharacter] });
  const old = useCharacterBuilder("account-a");
  assert.equal(old.selected.id, CHARACTER_ID);
  currentAccount = "account-b";
  const next = useCharacterBuilder("account-b");
  assert.equal(next.selected, null);
  assert.deepEqual(next.session.jobs, []);
  assert.equal(next.session.pendingRequest, null);
  await assert.rejects(old.select.mutateAsync(JOB_ONE), /account changed/);
  assert.equal(requests.length, 0);
  await next.generate.mutateAsync(request);
  assert.equal(requests[0].init.headers.Authorization, "Bearer test-token-for-account-b");
  assert.deepEqual(getSession("account-a").jobs, [receipt]);
  assert.deepEqual(getSession("account-a").pendingRequest, request);
});

test("selection uses only job ID, refreshes the account cache and restores the chosen identity", async () => {
  responseFor = async () => Response.json({ ok: true, character: publicCharacter });
  const builder = useCharacterBuilder("account-a");
  await builder.select.mutateAsync(JOB_ONE);
  await builder.select.mutateAsync(JOB_ONE);
  assert.deepEqual(requests[0].body, { jobId: JOB_ONE });
  assert.equal(cache.get(serializeKey(["characters", "account-a"])).characters.length, 1);
  assert.equal(getSession("account-a").selectedCharacterId, CHARACTER_ID);
  const restored = useCharacterBuilder("account-a");
  assert.deepEqual(restored.selected, publicCharacter);
  restored.chooseCharacter(null);
  assert.equal(getSession("account-a").selectedCharacterId, null);
  assert.equal(JSON.parse(storage.get(characterSessionStorageKey("account-a"))).selectedCharacterId, null);
});

test("selection awaits older list cancellation before caching identity and requests fresh durable state", async () => {
  let finishCancellation;
  cancelWait = new Promise((resolve) => { finishCancellation = resolve; });
  responseFor = async () => Response.json({ ok: true, character: publicCharacter });
  const builder = useCharacterBuilder("account-a");
  const selecting = builder.select.mutateAsync(JOB_ONE);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cache.get(serializeKey(["characters", "account-a"])), undefined);
  assert.equal(getSession("account-a").selectedCharacterId, null);
  finishCancellation();
  await selecting;
  assert.deepEqual(cacheEvents.filter((event) => serializeKey(event.key) === serializeKey(["characters", "account-a"])).map((event) => event.event), [
    "cancel-start", "cancel-complete", "set", "invalidate",
  ]);
  assert.equal(cache.get(serializeKey(["characters", "account-a"])).characters[0].id, CHARACTER_ID);
});

test("a late admitted generation response updates only the account that submitted it", async () => {
  let finishResponse;
  const response = new Promise((resolve) => { finishResponse = resolve; });
  responseFor = async () => response;
  const accountA = useCharacterBuilder("account-a");
  const submitting = accountA.generate.mutateAsync(request);
  await new Promise((resolve) => setImmediate(resolve));
  currentAccount = "account-b";
  const accountB = useCharacterBuilder("account-b");
  finishResponse(Response.json(generation, { status: 202 }));
  await submitting;
  assert.deepEqual(getSession("account-a").jobs, [receipt]);
  assert.deepEqual(getSession("account-b"), EMPTY_CHARACTER_SESSION);
  assert.deepEqual(accountB.session, EMPTY_CHARACTER_SESSION);
  assert.equal(storage.has(characterSessionStorageKey("account-b")), false);
  assert.ok(invalidated.every((key) => key[1] === "account-a"));
});

test("one failing candidate check preserves the successful result and continues polling", async () => {
  setSession("account-a", { jobs: [receipt, { jobId: JOB_TWO, generationId: "another-generation" }] });
  const completed = { id: JOB_ONE, status: "completed", isTerminal: true, error: null, output: { url: publicCharacter.url, mediaAssetId: CHARACTER_ID, generationId: GENERATION_ID } };
  responseFor = async (path) => path.includes(JOB_ONE)
    ? Response.json({ ok: true, job: completed })
    : Response.json({ ok: false, message: "temporarily saving" }, { status: 503 });
  const builder = useCharacterBuilder("account-a");
  const result = await builder.jobs.refetch();
  assert.deepEqual(result[0].output, completed.output);
  assert.equal(result[0].isTerminal, true);
  assert.equal(result[1].isTerminal, false);
  assert.ok(result[1].checkError);
  assert.equal(builder.jobs.__options.refetchInterval({ state: { data: result } }), 2500);
  assert.equal(invalidated.length, 0);
  assert.equal(useCharacterBuilder("account-a").inProgress, true);
});

test("unknown batch status blocks replacement generation; terminal results refresh access and billing", async () => {
  setSession("account-a", { jobs: [receipt] });
  responseFor = async () => Response.json({ ok: false, message: "temporary status outage" }, { status: 503 });
  const builder = useCharacterBuilder("account-a");
  await assert.rejects(builder.jobs.refetch(), /temporary status outage/);
  assert.equal(useCharacterBuilder("account-a").inProgress, true);
  responseFor = async () => Response.json({ ok: true, job: { id: JOB_ONE, status: "failed", isTerminal: true, error: "Image could not be generated.", output: null } });
  const result = await builder.jobs.refetch();
  assert.equal(builder.jobs.__options.refetchInterval({ state: { data: result } }), false);
  assert.equal(useCharacterBuilder("account-a").inProgress, false);
  assert.ok(invalidated.some((key) => serializeKey(key) === serializeKey(["character-access", "account-a"])));
  assert.ok(invalidated.some((key) => serializeKey(key) === serializeKey(["billing-subscription", "account-a"])));
});

test("signed-out accounts cannot issue generation or selection API requests", async () => {
  const builder = useCharacterBuilder(null);
  await assert.rejects(builder.generate.mutateAsync(request), /Sign in/);
  await assert.rejects(builder.select.mutateAsync(JOB_ONE), /Sign in/);
  assert.equal(requests.length, 0);
  assert.equal(getSession(null).pendingRequest, null);
  assert.equal(builder.characters.__options.enabled, false);
  assert.equal(builder.access.__options.enabled, false);
  assert.equal(builder.jobs.__options.enabled, false);
});
