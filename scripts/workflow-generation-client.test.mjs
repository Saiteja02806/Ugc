import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const load = (file, imports = {}, globals = {}) => {
  const exported = {};
  vm.runInNewContext(ts.transpileModule(read(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: exported,
    Error,
    require(name) { assert.ok(name in imports, `Unexpected import: ${name}`); return imports[name]; },
    ...globals,
  });
  return exported;
};
const backend = load("lib/ai-studio/generation-settings.ts", {}, { process: { env: { NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE: "true" } } });
const settings = load("lib/explore/workflow-generation-settings.ts", { "../ai-studio/generation-settings": backend }, { process: { env: { NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE: "true" } } });
const clientModule = load("lib/explore/workflow-generation-client.ts", {
  "../ai-studio/prompt-policy": load("lib/ai-studio/prompt-policy.ts"),
  "./workflow-generation-settings": settings,
});
const rollout = load("lib/explore/workflow-generation-rollout.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const draft = (overrides = {}) => ({ kind: "hook", instructions: "  Keep my words.\nNo template.  ", settings: settings.createWorkflowGenerationSettings(), creator: null, appScreen: null, videoReference: null, audioReference: null, ...overrides });
const queued = (count = 1, overrides = {}) => ({ ok: true, jobId: "job-1", jobs: Array.from({ length: count }, (_, i) => ({ jobId: `job-${i + 1}`, videoId: `video-${i + 1}` })), message: `${count} started.`, partial: false, ...overrides });
const response = (body, status = 202) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function harness(overrides = {}) {
  const calls = [], uploads = [], tokens = [];
  let nextKey = 0;
  const client = clientModule.createWorkflowGenerationClient({
    getOwnerToken: async () => { tokens.push("owner-a"); return "fake-owner-token"; },
    uploadImage: async (image) => { uploads.push(image); return { url: `https://storage.googleapis.com/test/${uploads.length}.png` }; },
    fetch: async (url, init) => { calls.push({ url, ...init }); return response(queued()); },
    createIdempotencyKey: () => `request-${++nextKey}`,
    assertActive() {},
    ...overrides,
  });
  return { client, calls, uploads, tokens };
}

test("text-only generation uses the existing authenticated API without requiring or inventing references", async () => {
  for (const kind of ["hook", "phone"]) {
    const actual = harness();
    const result = await actual.client.generate(draft({ kind }));
    assert.equal(result.jobs.length, 1);
    assert.equal(actual.uploads.length, 0);
    assert.equal(actual.calls[0].url, "/api/ai-studio/videos/generate");
    assert.equal(actual.calls[0].method, "POST");
    const body = JSON.parse(actual.calls[0].body);
    assert.equal(body.prompt, "Keep my words.\nNo template.");
    assert.equal(body.avatarImageUrl, null);
    assert.deepEqual(body.referenceImageUrls, []);
    assert.equal(body.model, "seedance_2_5");
    assert.equal(body.durationSeconds, 5);
    assert.equal(body.quantity, 1);
    assert.equal(body.resolution, "720p");
    assert.equal(body.aspectRatio, "9:16");
    assert.equal(body.idempotencyKey, actual.calls[0].headers["Idempotency-Key"]);
    assert.equal(actual.calls[0].headers.Authorization, "Bearer fake-owner-token");
    assert.equal(body.referenceType, undefined); // No Recreate image-required context.
  }
});

test("invalid settings and unsupported attached inputs fail before auth, upload or generation calls", async () => {
  const badDrafts = [
    draft({ instructions: "  " }), draft({ referencesPending: true }),
    draft({ videoReference: { url: "blob:video" } }),
    draft({ audioReference: { url: "blob:audio" } }),
    draft({ kind: "phone", appScreen: { kind: "video", url: "blob:screen" } }),
    draft({ settings: { ...settings.createWorkflowGenerationSettings(), resolution: "1080p" } }),
    draft({ instructions: "x".repeat(10_001) }),
    draft({ kind: "phone", appScreen: { kind: "image", url: "blob:app" }, settings: { ...settings.createWorkflowGenerationSettings(), model: "kling_3_0" } }),
    draft({ creator: { url: "blob:svg", file: { type: "image/svg+xml", size: 20 } } }),
    draft({ creator: { url: "blob:empty", file: { type: "image/png", size: 0 } } }),
  ];
  for (const input of badDrafts) {
    const actual = harness();
    await assert.rejects(actual.client.generate(input));
    assert.equal(actual.calls.length, 0);
    assert.equal(actual.uploads.length, 0);
    assert.equal(actual.tokens.length, 0);
  }
});

test("creator and app images are uploaded in order; browser/local URLs never reach the generation API", async () => {
  const creator = { name: "me.png", url: "blob:creator", file: { type: "image/png", size: 200 } };
  const app = { name: "app.png", url: "blob:app", kind: "image", file: { type: "image/png", size: 200 } };
  const actual = harness();
  await actual.client.generate(draft({ kind: "phone", creator, appScreen: app }));
  assert.deepEqual(actual.uploads, [creator, app]);
  const body = JSON.parse(actual.calls[0].body);
  assert.deepEqual(body.referenceImageUrls, ["https://storage.googleapis.com/test/1.png", "https://storage.googleapis.com/test/2.png"]);
  assert.equal(body.avatarImageUrl, body.referenceImageUrls[0]);
  assert.doesNotMatch(actual.calls[0].body, /blob:|file:|\/ai-studio\/creator-references/);
});

test("duplicate image selections upload only once", async () => {
  const creator = { name: "me.png", url: "blob:creator" };
  const actual = harness();
  await actual.client.generate(draft({ kind: "phone", creator, appScreen: { ...creator, kind: "image" } }));
  assert.equal(actual.uploads.length, 1);
  assert.equal(JSON.parse(actual.calls[0].body).referenceImageUrls.length, 1);
});

const referenceId = "11111111-1111-4111-8111-111111111111";
const timed = kind => ({ name: `${kind}.media`, url: `blob:${kind}`, duration: 5, file: { type: kind === "audio" ? "audio/mpeg" : "video/mp4", size: 1024 } });
test("Create references upload once, guide Seedance and preserve the exact uncertain request", async () => {
  const uploads = [], calls = [];
  const actual = harness({
    uploadReference: async (source, kind) => { uploads.push({ source, kind }); return { url: `https://storage.googleapis.com/test/${kind}.media`, assetId: kind === "audio" ? referenceId : "22222222-2222-4222-8222-222222222222", duration: source.duration }; },
    fetch: async (_, init) => { calls.push(init); if (calls.length === 1) throw new Error("lost response"); return response(queued()); },
  });
  const input = draft({ videoReference: timed("video"), audioReference: timed("audio") });
  await assert.rejects(actual.client.generate(input), /lost response/);
  await assert.rejects(actual.client.generate({ ...input, audioReference: { ...input.audioReference, url: "blob:different" } }), /previous request/);
  await actual.client.generate(input);
  assert.equal(uploads.length, 2);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
  const body = JSON.parse(calls[0].body);
  assert.deepEqual(body.referenceAudioAssetIds, [referenceId]);
  assert.equal(body.referenceVideoDurationSeconds, 5);
  assert.doesNotMatch(calls[0].body, /blob:|demoAssetId|backgroundAssetId/);
});

test("phone recordings use the same reference contract; unsupported or conflicting inputs never submit", async () => {
  const actual = harness({ uploadReference: async () => ({ url: "https://storage.googleapis.com/test/screen.mp4", assetId: referenceId, duration: 5 }) });
  await actual.client.generate(draft({ kind: "phone", appScreen: { ...timed("video"), kind: "video" } }));
  assert.equal(JSON.parse(actual.calls[0].body).referenceVideoAssetId, referenceId);
  for (const input of [
    draft({ audioReference: timed("audio"), settings: settings.normalizeWorkflowGenerationSettings({ model: "google_omni" }) }),
    draft({ videoReference: timed("video"), appScreen: { ...timed("video"), kind: "video" } }),
    draft({ audioReference: { ...timed("audio"), duration: 31 } }),
    draft({ videoReference: { ...timed("video"), file: { type: "video/mp4", size: 251 * 1024 ** 2 } } }),
  ]) {
    const blocked = harness();
    await assert.rejects(blocked.client.generate(input));
    assert.equal(blocked.calls.length + blocked.tokens.length, 0);
  }
  const noUpload = harness();
  await assert.rejects(noUpload.client.generate(draft({ audioReference: timed("audio") })), /Reference uploads are unavailable/);
  assert.equal(noUpload.calls.length, 0);
});

test("a lost response retries the exact key and payload, without reuploading images", async () => {
  const calls = [], uploads = [];
  let attempts = 0;
  const actual = harness({
    uploadImage: async (image) => { uploads.push(image); return { url: "https://storage.googleapis.com/test/owned.png" }; },
    fetch: async (url, init) => { calls.push(init); if (++attempts === 1) throw new Error("lost response"); return response(queued()); },
  });
  const input = draft({ creator: { name: "me.png", url: "blob:me" } });
  await assert.rejects(actual.client.generate(input), /lost response/);
  await actual.client.generate(input);
  assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(uploads.length, 1);
  await actual.client.generate(input); // An explicitly requested new batch gets a new key.
  assert.notEqual(calls[1].headers["Idempotency-Key"], calls[2].headers["Idempotency-Key"]);
});

test("an unconfirmed request cannot be replaced by a changed prompt or settings", async () => {
  let attempts = 0;
  const actual = harness({ fetch: async () => { if (++attempts === 1) throw new Error("lost response"); return response(queued()); } });
  const input = draft();
  await assert.rejects(actual.client.generate(input), /lost response/);
  await assert.rejects(actual.client.generate({ ...input, instructions: "A different request" }), /previous request has not been confirmed/);
  await assert.rejects(actual.client.generate({ ...input, settings: { ...input.settings, quantity: 2 } }), /previous request has not been confirmed/);
  assert.equal(attempts, 1);
  await actual.client.generate(input);
  assert.equal(attempts, 2);
});

test("malformed success also retains the request identity; partial batches preserve every queued job", async () => {
  const calls = [];
  const actual = harness({ fetch: async (_, init) => { calls.push(init); return response(calls.length === 1 ? { ok: true } : queued(2, { partial: true })); } });
  const input = draft({ settings: { ...settings.createWorkflowGenerationSettings(), quantity: 4 } });
  await assert.rejects(actual.client.generate(input), /could not be confirmed/);
  const result = await actual.client.generate(input);
  assert.equal(result.partial, true);
  assert.deepEqual(plain(result.jobs), queued(2).jobs);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
  for (const value of [queued(1, { jobId: "wrong" }), queued(2, { jobs: [queued().jobs[0], queued().jobs[0]] }), queued(1, { jobs: [{ jobId: "../../unsafe", videoId: "video-1" }] })]) {
    assert.throws(() => clientModule.parseWorkflowGenerationBatch(value, 4), /could not be confirmed/);
  }
});

test("double-clicks cannot submit twice and changes made during upload do not rewrite the captured prompt/settings", async () => {
  let finishUpload;
  const actual = harness({ uploadImage: () => new Promise((resolve) => { finishUpload = resolve; }) });
  const input = draft({ creator: { name: "me.png", url: "blob:me" } });
  const first = actual.client.generate(input);
  await new Promise(setImmediate);
  await assert.rejects(actual.client.generate(input), /already starting/);
  input.instructions = "Changed later";
  input.settings.quantity = 4;
  finishUpload({ url: "https://storage.googleapis.com/test/owned.png" });
  await first;
  assert.equal(actual.calls.length, 1);
  const body = JSON.parse(actual.calls[0].body);
  assert.equal(body.prompt, "Keep my words.\nNo template.");
  assert.equal(body.quantity, 1);
});

test("an account change or unmount during reference preparation stops before the paid request", async () => {
  let active = true;
  const actual = harness({
    assertActive() { if (!active) throw new Error("account changed"); },
    uploadImage: async () => { active = false; return { url: "https://storage.googleapis.com/test/owned.png" }; },
  });
  await assert.rejects(actual.client.generate(draft({ creator: { name: "me.png", url: "blob:me" } })), /account changed/);
  assert.equal(actual.calls.length, 0);
  const signedOut = harness({ getOwnerToken: async () => null });
  await assert.rejects(signedOut.client.generate(draft()), /Sign in/);
  assert.equal(signedOut.calls.length, 0);
});

test("server rejection is shown without an automatic retry or a changed request key", async () => {
  const actual = harness({ fetch: async () => response({ ok: false, error: "Not enough credits." }, 402) });
  await assert.rejects(actual.client.generate(draft()), /Not enough credits/);
  assert.equal(actual.uploads.length, 0);
});

test("saved job IDs are bounded, versioned and isolated by account and workflow", () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value) };
  const batch = clientModule.parseWorkflowGenerationBatch(queued(2, { partial: true }), 4);
  clientModule.persistWorkflowGenerationJobs(storage, "owner-a", "hook", batch);
  assert.deepEqual(Array.from(clientModule.readWorkflowGenerationJobs(storage, "owner-a", "hook")), ["job-1", "job-2"]);
  assert.equal(clientModule.readWorkflowGenerationJobs(storage, "owner-b", "hook").length, 0);
  assert.equal(clientModule.readWorkflowGenerationJobs(storage, "owner-a", "phone").length, 0);
  const raw = [...store.values()][0];
  assert.doesNotMatch(raw, /instructions|prompt|token|blob:|file/);
  const key = clientModule.workflowGenerationStorageKey("owner-a", "hook");
  for (const bad of ["broken json", JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, ownerId: "owner-b", kind: "hook", jobIds: ["job-1"] }), JSON.stringify({ version: 1, ownerId: "owner-a", kind: "hook", jobIds: Array(5).fill("job-1") })]) {
    store.set(key, bad);
    assert.equal(clientModule.readWorkflowGenerationJobs(storage, "owner-a", "hook").length, 0);
  }
  assert.equal(clientModule.readWorkflowGenerationJobs({ getItem() { throw new Error("blocked storage"); } }, "owner-a", "hook").length, 0);
  assert.doesNotThrow(() => clientModule.persistWorkflowGenerationJobs({ setItem() { throw new Error("blocked storage"); } }, "owner-a", "hook", batch));
});

test("workflows stay visible, generation requires the explicit server rollout flag, and previews always stay non-spending", async () => {
  for (const environment of ["development", "production", "test"]) {
    for (const generationEnabled of [undefined, "false", "true"]) {
      for (const preview of [undefined, "1"]) {
        for (const mode of [undefined, "generate"]) {
          const value = rollout.getWorkflowGenerationMode({ environment, generationEnabled, preview, mode });
          const expected = preview === "1" ? "preview" : generationEnabled === "true" ? "generation" : "preview";
          assert.equal(value, expected);
          for (const kind of ["hook", "phone"]) {
            const page = load(kind === "hook" ? "app/explore/create-hook/page.tsx" : "app/explore/creator-phone/page.tsx", {
              "next/navigation": { notFound() { throw new Error("NOT_FOUND"); } },
              "@/components/explore/hook-workflow-preview": { HookWorkflowPreview: "hook" },
              "@/components/explore/phone-workflow-preview": { PhoneWorkflowPreview: "phone" },
              "@/lib/explore/launch-presets": { parseWorkflowDuration: () => 5 },
              "@/lib/explore/workflow-generation-rollout": rollout,
              "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
            }, { process: { env: { NODE_ENV: environment, EXPLORE_GENERATION_ENABLED: generationEnabled } } });
            const invoke = () => page.default({ searchParams: Promise.resolve({ preview, mode }) });
            if (value === "hidden") await assert.rejects(invoke(), /NOT_FOUND/);
            else assert.equal((await invoke()).props.generationEnabled, value === "generation");
          }
        }
      }
    }
  }
});

test("the actual preview boundaries cannot mount auth, job or billing hooks", () => {
  const forbidden = () => { throw new Error("Preview mounted a live hook"); };
  const boundary = load("components/explore/workflow-generation-boundary.tsx", {
    react: { useCallback: forbidden, useEffect: forbidden, useRef: forbidden, useState: forbidden, useSyncExternalStore: forbidden },
    "@tanstack/react-query": { useQueries: forbidden, useQueryClient: forbidden },
    "@/contexts/auth-context": { useAuth: forbidden },
    "@/components/billing/use-billing-subscription": { useBillingSubscription: forbidden },
    "@/components/generation/use-ai-studio-access": { useAIStudioAccess: forbidden },
    "@/lib/ai-studio/access-policy": {}, "@/lib/ai-studio/creator-references": {}, "@/lib/ai-studio/media-client": {},
    "@/lib/ai-studio/reference-media-upload": {}, "@/lib/explore/workflow-generation-client": clientModule,
    "@/lib/firebase/auth": {}, "@/lib/jobs/background-job-client": {},
    "react/jsx-runtime": { jsx: forbidden },
  });
  assert.equal(boundary.WorkflowAccountBoundary({ enabled: false, children: (owner) => owner }), null);
  assert.equal(boundary.WorkflowGenerationBoundary({ enabled: false, ownerId: "owner-a", draft: draft(), children: (view) => view }), null);
  const locked = boundary.WorkflowGenerationBoundary({ enabled: true, ownerId: null, draft: draft(), children: (view) => view });
  assert.equal(locked.disabled, true);
  assert.equal(locked.results.length, 0);
});

function connectedHarness(overrides = {}) {
  const state = {
    account: "owner-a", access: "pro", urlJob: null,
    billing: { data: { userId: "owner-a", creditsRemaining: 100, videoGenerationCreditsPerSecond: 1 }, isError: false, isPending: false },
    jobQueries: [], mediaQueries: [], ...overrides,
  };
  const slots = [], effects = [], calls = [], invalidations = [], queryOptions = [], queriedJobIds = [], store = new Map();
  let cursor = 0;
  const fakeWindow = {
    localStorage: { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  };
  const react = {
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useCallback(fn) { return fn; },
    useSyncExternalStore(_subscribe, snapshot) { return snapshot(); },
    useEffect(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) effects.push(() => {
        previous?.cleanup?.();
        slots[index] = { deps, cleanup: fn() };
      });
    },
  };
  const boundary = load("components/explore/workflow-generation-boundary.tsx", {
    react,
    "@tanstack/react-query": {
      useQueryClient: () => ({ invalidateQueries: (value) => { invalidations.push(value); return Promise.resolve(); } }),
      useQueries: (options) => { queryOptions.push(options); return state.mediaQueries; },
    },
    "@/contexts/auth-context": { useAuth: () => ({ loading: false, user: state.account ? { uid: state.account } : null }) },
    "@/components/billing/use-billing-subscription": { useBillingSubscription: () => state.billing },
    "@/components/generation/use-ai-studio-access": { useAIStudioAccess: () => state.access },
    "@/lib/ai-studio/access-policy": { getAIStudioAccessMessage: () => "Access required." },
    "@/lib/ai-studio/creator-references": { CREATOR_REFERENCES: [] },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async (...args) => { calls.push({ media: args }); return state.asset; } },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async (...args) => { calls.push({ upload: args }); return { asset: { url: "https://storage.googleapis.com/test/owned.png" } }; } },
    "@/lib/explore/workflow-generation-client": clientModule,
    "@/lib/firebase/auth": { getCurrentUserIdToken: async (expected) => { if (state.account !== expected) throw new Error("account changed"); return "fake-owner-token"; } },
    "@/lib/jobs/background-job-client": {
      useBackgroundJobs: (ids) => { queriedJobIds.push([...ids]); return state.jobQueries; },
      usePersistedJobIdFromUrl: () => state.urlJob,
      persistJobIdInUrl: (id, parameter) => calls.push({ urlJob: id, parameter }),
    },
    "react/jsx-runtime": { jsx: (type, props) => typeof type === "function" ? type(props) : ({ type, props }) },
  }, {
    window: fakeWindow, Event, crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    navigator: { locks: { request: async (_key, _options, callback) => callback({ name: "fixture-lock" }) } },
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      if (state.fetchResponse) return state.fetchResponse(url, init);
      const body = JSON.parse(init.body);
      const jobs = Array.from({ length: body.quantity }, (_, index) => ({
        jobId: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
        videoId: `33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}`,
      }));
      return response({ ok: true, receiptVersion: 2, requestKey: body.idempotencyKey, kind: body.workflowKind,
        quantity: body.quantity, outcome: "accepted", jobId: jobs[0].jobId, jobs, partial: false });
    },
  });
  return {
    state, calls, invalidations, queryOptions, queriedJobIds, store,
    render(input = draft({ settings: { ...settings.createWorkflowGenerationSettings(), quantity: 4 } })) {
      cursor = 0;
      const view = boundary.WorkflowGenerationBoundary({ enabled: true, ownerId: "owner-a", draft: input, children: (value) => value });
      while (effects.length) effects.shift()();
      return view;
    },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
const readyAsset = (id = "asset-1") => ({ id, title: "Saved video", collection: "video", status: "ready", sourceType: "generated_video", url: `https://storage.googleapis.com/test/${id}.mp4`, durationSeconds: 5 });
const jobQuery = (id, status, output = null, error = null) => ({ data: { id, status, output, error, jobType: "video_generation", projectId: "ai-studio" }, isError: false, isPending: false, refetch: async () => {} });

test("the connected controller queues only after a click and keeps every atomic-batch job", async () => {
  for (const kind of ["hook", "phone"]) {
    const actual = connectedHarness();
    const input = draft({ kind, settings: { ...settings.createWorkflowGenerationSettings(), quantity: 4 } });
    const view = actual.render(input);
    assert.equal(view.disabled, false);
    assert.equal(actual.calls.length, 0);
    view.onGenerate();
    view.onGenerate();
    assert.equal(actual.render(input).busy, true);
    await new Promise(setImmediate);
    const next = actual.render(input);
    assert.equal(actual.calls.filter((call) => call.method === "POST").length, 1);
    const expectedJobs = [1, 2, 3, 4].map(index => `22222222-2222-4222-8222-${String(index).padStart(12, "0")}`);
    assert.deepEqual(actual.queriedJobIds.at(-1), expectedJobs);
    assert.equal(next.notice, null);
    const saved = JSON.parse([...actual.store.values()][0]);
    assert.deepEqual(saved.jobIds, expectedJobs);
    assert.equal(saved.kind, kind);
    assert.equal(actual.calls.find((call) => call.urlJob)?.parameter, kind === "hook" ? "hookJob" : "phoneJob");
  }
});

test("the connected atomic controller retains a partial or malformed acknowledgement for recovery", async () => {
  const actual = connectedHarness({ fetchResponse: async () => response(queued(2, { partial: true })) });
  const view = actual.render(); view.onGenerate(); await new Promise(setImmediate);
  const next = actual.render();
  assert.equal(next.disabled, true); assert.match(next.error, /could not be verified/);
  const saved = JSON.parse(actual.store.get(clientModule.workflowGenerationRequestStorageKey("owner-a", "hook")));
  assert.equal(saved.version, 2); assert.equal(saved.quantity, 4);
  assert.equal(actual.calls.filter(call => call.method === "POST").length, 1);
});

test("access, credits, account mismatch and malformed billing fail closed before submission", async () => {
  for (const overrides of [
    { access: "signed_out" }, { billing: { data: null, isError: false, isPending: true } },
    ...[0, -1, NaN, Infinity].map((rate) => ({ billing: { data: { userId: "owner-a", creditsRemaining: 100, videoGenerationCreditsPerSecond: rate }, isError: false, isPending: false } })),
    { billing: { data: { userId: "owner-b", creditsRemaining: 100, videoGenerationCreditsPerSecond: 1 }, isError: false, isPending: false } },
    { billing: { data: { userId: "owner-a", creditsRemaining: 1, videoGenerationCreditsPerSecond: 1 }, isError: false, isPending: false } },
  ]) {
    const actual = connectedHarness(overrides);
    const view = actual.render();
    assert.equal(view.disabled, true);
    view.onGenerate();
    await new Promise(setImmediate);
    assert.equal(actual.calls.length, 0);
  }
});

test("a remounted controller restores an unacknowledged request through GET even with an empty draft or no credits", async () => {
  const requestKey = "11111111-1111-4111-8111-111111111111";
  const actual = connectedHarness({ billing: { data: null, isError: false, isPending: true }, fetchResponse: async (_url, init) => {
    assert.equal(init.method, "GET");
    return response({ ...queued(), requestKey, resolved: true });
  } });
  actual.store.set(clientModule.workflowGenerationRequestStorageKey("owner-a", "hook"), JSON.stringify({ version: 1, ownerId: "owner-a", kind: "hook", requestKey, quantity: 1 }));
  const view = actual.render(draft({ instructions: "" }));
  assert.equal(view.disabled, true); view.onGenerate();
  await new Promise(setImmediate);
  actual.render(draft({ instructions: "" }));
  assert.equal(actual.calls.filter((call) => call.method === "POST").length, 0);
  assert.equal(actual.calls.filter((call) => call.method === "GET").length, 1);
  assert.deepEqual(actual.queriedJobIds.at(-1), ["job-1"]);
});

test("a corrupt reload marker is visible and blocks generation without fetching or clearing it", async () => {
  const actual = connectedHarness();
  const key = clientModule.workflowGenerationRequestStorageKey("owner-a", "hook");
  actual.store.set(key, "corrupt request");
  const view = actual.render();
  assert.equal(view.disabled, true); assert.match(view.error, /cannot be verified/);
  view.onGenerate(); view.refreshStatus(); await new Promise(setImmediate);
  assert.equal(actual.calls.length, 0); assert.equal(actual.store.get(key), "corrupt request");
});

test("account changes and unmounts cannot turn a stale generation click into a paid request", async () => {
  for (const deactivate of ["account", "unmount"]) {
    const actual = connectedHarness();
    const view = actual.render();
    if (deactivate === "account") actual.state.account = "owner-b";
    else actual.unmount();
    view.onGenerate();
    await new Promise(setImmediate);
    assert.equal(actual.calls.filter((call) => call.method === "POST").length, 0);
  }
});

test("saved jobs recover read-only, and status errors or uncertain provider submissions block new spending", async () => {
  for (const job of [
    { ...jobQuery("job-1", "running"), isPending: true },
    { ...jobQuery("job-1", "failed"), isError: true },
    jobQuery("job-1", "failed", null, { code: "provider_submission_uncertain", message: "Provider status unconfirmed." }),
    jobQuery("job-1", "completed"),
    { ...jobQuery("job-1", "completed"), data: { ...jobQuery("job-1", "completed").data, projectId: "another-project" } },
  ]) {
    let reads = 0;
    const actual = connectedHarness({ urlJob: "job-1", jobQueries: [{ ...job, refetch: async () => { reads++; } }] });
    const view = actual.render();
    assert.equal(view.disabled, true);
    assert.deepEqual(actual.queriedJobIds.at(-1), ["job-1"]);
    view.onGenerate();
    view.refreshStatus();
    await new Promise(setImmediate);
    assert.equal(reads, 1);
    assert.equal(actual.calls.filter((call) => call.method === "POST").length, 0);
  }
});

test("completed-job media queries verify the owner and returned asset before previewing", async () => {
  const actual = connectedHarness({ urlJob: "job-1", jobQueries: [jobQuery("job-1", "completed", { mediaAssetId: "asset-1" })], asset: readyAsset() });
  actual.render();
  const query = actual.queryOptions.at(-1).queries[0];
  assert.deepEqual(Array.from(query.queryKey), ["explore-generation-media", "owner-a", "asset-1"]);
  assert.equal((await query.queryFn()).id, "asset-1");
  for (const asset of [readyAsset("wrong-id"), { ...readyAsset(), sourceType: "upload" }, { ...readyAsset(), url: "blob:local" }, { ...readyAsset(), status: "processing" }]) {
    actual.state.asset = asset;
    await assert.rejects(query.queryFn(), /not ready/);
  }
  actual.state.account = "owner-b";
  await assert.rejects(query.queryFn(), /account changed/);
  assert.equal(actual.calls.filter((call) => call.method === "POST").length, 0);
});

test("selecting a saved result changes the editing input but cannot select an unrelated asset", () => {
  const first = readyAsset("asset-1"), second = readyAsset("asset-2");
  const actual = connectedHarness({ mediaQueries: [{ data: first }, { data: second }] });
  const view = actual.render();
  assert.equal(view.selected.id, "asset-1");
  view.selectResult("asset-2");
  assert.equal(actual.render().selected.id, "asset-2");
  actual.render().selectResult("someone-elses-asset");
  assert.equal(actual.render().selected.id, "asset-2");
  assert.equal(actual.calls.length, 0);
});

test("the shared uploader verifies the expected account before any cloud write, while legacy calls remain compatible", async () => {
  let currentOwner = "owner-b";
  const calls = [], expectedOwners = [], released = [];
  class FakeImage {
    naturalWidth = 720; naturalHeight = 1280;
    set src(value) { queueMicrotask(() => this.onload?.()); }
  }
  const uploader = load("lib/ai-studio/reference-media-upload.ts", {
    "@/lib/firebase/auth": { getCurrentUserIdToken: async (expected) => { expectedOwners.push(expected); if (expected && expected !== currentOwner) throw new Error("account changed"); return "fake-token"; } },
  }, {
    window: { Image: FakeImage },
    URL: { createObjectURL: () => "blob:metadata", revokeObjectURL: (url) => released.push(url) },
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      if (url === "/api/media/create-upload-url") return response({ ok: true, assetId: "asset-1", key: "owned/key", uploadUrl: "https://storage.googleapis.com/fake/upload", requiredHeaders: { "Content-Type": "image/png" } });
      if (url === "https://storage.googleapis.com/fake/upload") return new Response("", { status: 200 });
      if (url === "/api/media/complete-upload") return response({ ok: true, asset: { id: "asset-1", status: "ready", collection: "image", url: "https://storage.googleapis.com/fake/saved.png" } });
      throw new Error(`Unexpected request ${url}`);
    },
  });
  const file = { name: "me.png", type: "image/png", size: 200 };
  await assert.rejects(uploader.uploadAIStudioReferenceMedia(file, "image", undefined, "owner-a"), /account changed/);
  assert.equal(calls.length, 0);
  assert.deepEqual(expectedOwners, ["owner-a"]);
  currentOwner = "owner-a";
  const result = await uploader.uploadAIStudioReferenceMedia(file, "image", undefined, "owner-a");
  assert.equal(result.asset.id, "asset-1");
  assert.equal(calls.length, 3);
  await uploader.uploadAIStudioReferenceMedia(file, "image");
  assert.equal(expectedOwners.at(-1), undefined); // Existing callers keep their original behavior.
  assert.equal(released.length, 3);
});
