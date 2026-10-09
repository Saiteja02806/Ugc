import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, URL, URLSearchParams, Headers, process: { env: {} }, require(name) { if(name === "../../worker/src/lib/video-prompt-policy") return load("worker/src/lib/video-prompt-policy.ts"); if(name === "./generation-session.ts") return load("lib/ai-studio/generation-session.ts");
    if (name in imports) return imports[name];
    if (name === "@/lib/explore/slideshow-image") return { resolveSlideshowImage: async image => image };
    if(name === "next/link") return "Link";
    if(name === "./generation-session.ts" || name === "@/lib/ai-studio/generation-session") return load("lib/ai-studio/generation-session.ts");
    if(name === "../../worker/src/lib/video-prompt-policy") return load("worker/src/lib/video-prompt-policy.ts");
    if(name === "@/lib/ai-studio/video-generation-state") return load("lib/ai-studio/video-generation-state.ts");
    if(name === "@/lib/ai-studio/video-history") return load("lib/ai-studio/video-history.ts");
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error(`Unexpected import: ${name}`);
  }, ...globals });
  return exports;
}
function nodes(tree) {
  return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

// Run the real recovery hooks and generation panels. Only React's scheduler,
// query transport and authenticated media responses are supplied by this fixture.
function harness(format, { saved = false, listed = true, history = "failure", discovery = "ready", storageBlocked = false, localPreview = false } = {}) {
  let cursor = 0, effects = [], tree = [], stateChanged = false, user = { uid: "owner" };
  const slots = [], effectDeps = [], cleanups = [], calls = [], subscriptions = [];
  const image = format === "slideshow";
  const job = { id: "current-job", jobType: image ? "image_generation" : "video_generation", exploreFormat: format,
    status: "processing", output: null, updatedAt: new Date().toISOString() };
  const asset = { id: "current-asset", collection: image ? "image" : "video", sourceType: image ? "generated_image" : "generated_video",
    status: "ready", url: image ? "/fixture.png" : "/fixture.mp4", ratio: image ? "4:5" : "9:16", durationSeconds: 3,
    title: "Saved result", createdAt: new Date().toISOString(), metadata: { exploreFormat: format } };
  const jobs = new Map([[job.id, job]]);
  let listedJobs = listed ? [job] : [];
  const historyResponse = deferred();
  const storage = new Map(saved ? [[`ugc-ai-studio.latest-${image ? "image" : "video"}-job.v2.owner.${format}`, JSON.stringify([job.id])]] : []);
  const auth = { useAuth: () => ({ loading: false, user }) };
  const react = {
    useMemo: fn => fn(), useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], next => { const value = typeof next === "function" ? next(slots[i]) : next;
        if (!Object.is(value, slots[i])) { slots[i] = value; stateChanged = true; } }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useEffect(fn, deps) { const i = cursor++;
      if (!effectDeps[i] || deps.some((v, j) => !Object.is(v, effectDeps[i][j]))) { effectDeps[i] = deps; effects.push({ i, fn }); } },
    useCallback: fn => fn,
    useSyncExternalStore(subscribe, snapshot) { subscriptions.push(subscribe); return snapshot(); },
  };
  const window = {
    localStorage: { getItem(key) { if (storageBlocked) throw new Error("Storage blocked"); return storage.get(key) ?? null; } },
    location: { href: `https://example.test/explore/${format}`, search: "" },
    addEventListener() {}, removeEventListener() {}, setTimeout: () => 1, clearTimeout() {},
  };
  const queryClient = { invalidateQueries: async () => {} };
  let activeOptions, individualOptions = [];
  const query = {
    useQueryClient: () => queryClient,
    useQuery(options) { activeOptions = options; return { data: discovery === "pending" ? undefined : listedJobs,
      isPending: discovery === "pending", isError: discovery === "failure",
      isFetching: discovery === "pending" || discovery === "cached", isFetchedAfterMount: discovery !== "pending" && discovery !== "cached" }; },
    useQueries({ queries }) { individualOptions = queries;
      return queries.map(options => ({ data: user?.uid === "owner" ? jobs.get(options.queryKey[2]) : undefined, isPending: false })); },
    useMutation: () => ({ isPending: false, mutateAsync: async () => { throw new Error("No mutation permitted in recovery"); } }),
  };
  const firebase = { getCurrentUserIdToken: async () => user ? `${user.uid}-token` : null };
  const transport = async (url, init) => {
    calls.push({ url, ...init }); assert.equal(init.method ?? "GET", "GET", "Recovery must never submit, cancel or retry a generation");
    return { ok: true, json: async () => url.startsWith("/api/jobs?") ? { ok: true, jobs: listedJobs } : { ok: true, job } };
  };
  const client = load("lib/jobs/background-job-client.ts", { react, "@tanstack/react-query": query,
    "@/contexts/auth-context": auth, "@/lib/firebase/auth": firebase }, { window, fetch: transport });
  const imports = {
    react, "@tanstack/react-query": query,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "next/navigation": { usePathname: () => `/explore/${format}`, useRouter: () => ({}), useSearchParams: () => new URLSearchParams() },
    "@/contexts/auth-context": auth,
    "@/lib/billing/generation-credit-policy": { DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND: 4 },
    "@/lib/ai-studio/generation-settings": load("lib/ai-studio/generation-settings.ts"),
    "@/lib/ai-studio/media-client": {
      fetchAIStudioMediaAssets: async () => {
        if (history === "failure") throw new Error("History unavailable");
        if (history === "pending") return historyResponse.promise;
        return [];
      },
      fetchAIStudioMediaAsset: async () => { if (history === "failure") throw new Error("Media temporarily unavailable"); return asset; },
    },
    "@/lib/ai-studio/media-results": load("lib/ai-studio/media-results.ts"),
    "@/lib/ai-studio/image-history": load("lib/ai-studio/image-history.ts"),
    "@/lib/ai-studio/prompt-policy": load("lib/ai-studio/prompt-policy.ts"),
    "@/lib/explore/format-generation-prompt": load("lib/explore/format-generation-prompt.ts", {
      "@/lib/ai-studio/prompt-policy": load("lib/ai-studio/prompt-policy.ts"),
    }),
    "@/lib/firebase/auth": firebase, "@/lib/jobs/background-job-client": client,
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  const mod = load(image ? "components/workspace/ugc-chat-workspace.tsx" : "components/video/video-generation-workspace.tsx", imports,
    { window, fetch: transport, setTimeout: () => 1, clearTimeout() {} });
  const Panel = image ? mod.ImageGenerationStudioPanel : mod.VideoGenerationStudioPanel;
  const props = { active: true, accessState: "pro", creditsRemaining: 1000, creditCost: 1, recreateView: {
    preview: localPreview, referenceImageUrl: "/reference.png",
    workflow: { format, controlsTarget: {}, resultsTarget: {}, onGenerationStart() {} },
  } };
  function render() {
    // React repeats a render before committing effects when state is adjusted
    // during render; discard that render's uncommitted effect closures.
    for (let pass = 0; pass < 10; pass++) {
      cursor = 0; stateChanged = false; const previousDeps = [...effectDeps]; const previousEffects = [...effects];
      tree = nodes(Panel(props));
      if (!stateChanged) return tree;
      effectDeps.splice(0, effectDeps.length, ...previousDeps); effects = previousEffects;
    }
    throw new Error("Unexpected render loop");
  }
  async function settle() {
    for (let iteration = 0; iteration < 3; iteration++) {
      render(); const pending = effects; effects = [];
      for (const { i, fn } of pending) { cleanups[i]?.(); cleanups[i] = fn(); }
      await new Promise(resolve => setImmediate(resolve));
    }
    render(); return tree;
  }
  return {
    client, job, asset, storage, calls, subscriptions, settle, render,
    composer: () => tree.find(n => n.type === "AiStudioComposer"), result: () => tree.find(n => n.type === "AiStudioResults"),
    ids: () => Array.from(individualOptions, options => options.queryKey[2]), activeQuery: () => activeOptions,
    individualQueries: () => individualOptions,
    setListed(value) { listedJobs = value; }, setDiscovery(value) { discovery = value; },
    changeOwner(uid) { user = uid ? { uid } : null; listedJobs = []; },
    finish() { jobs.set(job.id, { ...job, status: "completed", completedAt: asset.createdAt,
      output: { url: asset.url, mediaAssetId: asset.id, generationId: asset.id, ratio: asset.ratio } }); listedJobs = []; },
    resolveHistory(value = []) { historyResponse.resolve(value); },
    unmount() { for (const cleanup of cleanups) cleanup?.(); },
  };
}

for (const format of ["hook", "wall_text", "slideshow"]) {
  test(`${format}: fresh browser recovers the account task despite a failed history request`, async () => {
    const h = harness(format); await h.settle();
    assert.deepEqual(h.ids(), [h.job.id]); assert.equal(h.composer().props.isGenerating, true);
    assert.equal(h.result().props.loading, false); assert.equal(h.result().props.status.tone, "progress");
    const query = h.activeQuery(); assert.equal(query.enabled, true); assert.equal(query.staleTime, 0); assert.equal(query.refetchOnMount, "always");
    await query.queryFn(); await h.individualQueries()[0].queryFn();
    assert.equal(h.calls[0].url, `/api/jobs?status=active&limit=100&exploreFormat=${format}`);
    assert.equal(h.calls[0].headers.get("Authorization"), "Bearer owner-token");
    assert.equal(h.calls[1].url, `/api/jobs/${h.job.id}`); h.unmount();
  });
  test(`${format}: saved task restores immediately even when both account discovery and history fail`, async () => {
    const h = harness(format, { saved: true, listed: false, discovery: "failure" });
    h.render(); assert.deepEqual(h.ids(), [h.job.id]);
    await h.settle(); assert.equal(h.composer().props.isGenerating, true); assert.equal(h.result().props.loading, false);
    assert.equal(h.result().props.status.tone, "progress"); h.unmount();
  });
  test(`${format}: a hanging history request does not cover recovered progress with skeletons`, async () => {
    const h = harness(format, { history: "pending" }); await h.settle();
    assert.equal(h.composer().props.isGenerating, true); assert.equal(h.result().props.loading, false); h.unmount();
  });
  test(`${format}: task remains tracked after leaving the active list and restores its completed output`, async () => {
    const h = harness(format); await h.settle(); h.finish(); const tree = await h.settle();
    assert.deepEqual(h.ids(), [h.job.id]); assert.equal(h.composer().props.isGenerating, false);
    const card = tree.find(n => typeof n.type === "function" && ["VideoResultCard", "ImageGenerationCard"].includes(n.type.name));
    assert.equal((card.props.video ?? card.props.asset).url, h.asset.url); h.unmount();
  });
  test(`${format}: slow history cannot erase a result recovered while it was loading`, async () => {
    const h = harness(format, { history: "pending" }); await h.settle(); h.finish(); await h.settle();
    assert.equal(h.result().props.hasResults, true); h.resolveHistory(); await h.settle();
    assert.equal(h.result().props.hasResults, true); assert.equal(h.result().props.loading, false); h.unmount();
  });
  test(`${format}: recovery ignores jobs from other workflows and generation types`, async () => {
    const h = harness(format); h.setListed([h.job, { ...h.job, id: "wrong-format", exploreFormat: format === "hook" ? "wall_text" : "hook" },
      { ...h.job, id: "wrong-type", jobType: "audio_generation" }, { ...h.job, id: "legacy-untagged", exploreFormat: undefined }]);
    await h.settle(); assert.deepEqual(h.ids(), [h.job.id]); h.unmount();
  });
  test(`${format}: account discovery works when browser storage is blocked`, async () => {
    const h = harness(format, { storageBlocked: true }); await h.settle();
    assert.deepEqual(h.ids(), [h.job.id]); assert.equal(h.composer().props.isGenerating, true); h.unmount();
  });
  test(`${format}: switching accounts discards discovered job IDs`, async () => {
    const h = harness(format); await h.settle(); h.changeOwner("second-owner"); await h.settle();
    assert.deepEqual(h.ids(), []); assert.equal(h.composer().props.isGenerating, false);
    assert.equal(h.activeQuery().queryKey[1], "second-owner"); h.unmount();
  });
  test(`${format}: new submissions wait for initial task discovery without starting generation`, async () => {
    const h = harness(format, { listed: false, discovery: "pending", history: "ready" }); await h.settle();
    h.composer().props.onPromptChange("A short example"); h.render();
    assert.equal(h.composer().props.generateDisabled, true); assert.equal(h.composer().props.isGenerating, false);
    await h.composer().props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.calls, []); h.setDiscovery("ready"); await h.settle();
    assert.equal(h.composer().props.generateDisabled, false); h.unmount();
  });
  test(`${format}: preview and signed-out screens do not query account tasks`, async () => {
    const preview = harness(format, { localPreview: true }); await preview.settle(); assert.equal(preview.activeQuery().enabled, false); preview.unmount();
    const signedOut = harness(format); signedOut.changeOwner(null); await signedOut.settle();
    assert.equal(signedOut.activeQuery().enabled, false); assert.deepEqual(signedOut.ids(), []); signedOut.unmount();
  });
  test(`${format}: a cached empty task list still waits for the fresh reopening check`, async () => {
    const h = harness(format, { listed: false, discovery: "cached", history: "ready" }); await h.settle();
    h.composer().props.onPromptChange("An example video"); h.render();
    assert.equal(h.composer().props.generateDisabled, true);
    h.setListed([h.job]); h.setDiscovery("ready"); await h.settle();
    assert.equal(h.composer().props.isGenerating, true); assert.deepEqual(h.ids(), [h.job.id]); h.unmount();
  });
}

test("saved job hints support legacy IDs and reject malformed/non-string array entries", () => {
  const h = harness("hook", { listed: false });
  const key = "fixture-key";
  for (const [raw, expected] of [[null, []], ["legacy-job", ["legacy-job"]], ['["job",123,null]', ["job"]], ['{"unexpected":true}', []]]) {
    if (raw === null) h.storage.delete(key); else h.storage.set(key, raw);
    assert.deepEqual(Array.from(h.client.useStoredBackgroundJobIds(key)), expected);
  }
  const events = []; const unsubscribe = h.subscriptions.at(-1)((...args) => events.push(args));
  assert.equal(typeof unsubscribe, "function"); unsubscribe();
});
