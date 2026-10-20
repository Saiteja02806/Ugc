import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import path from "node:path";
import ts from "typescript";

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Error, URL, URLSearchParams, Headers, AbortController, AbortSignal, process: { env: {} }, require: name => {
    if(name === "../../worker/src/lib/video-prompt-policy") return load("worker/src/lib/video-prompt-policy.ts");
    if (name in imports) return imports[name];
    if (name === "@/lib/ai-studio/pending-generation") return load("lib/ai-studio/pending-generation.ts", imports, globals);
    if (name === "@/lib/http/read-deadline") return load("lib/http/read-deadline.ts", imports, globals);
    if (name === "@/components/generation/use-generation-discovery") return load("components/generation/use-generation-discovery.ts", imports, globals);
    if (name === "@/lib/explore/slideshow-image") return { resolveSlideshowImage: async image => image };
    if (name === "@/worker/src/lib/image-reference-context") return load("worker/src/lib/image-reference-context.ts");
    if (name.startsWith("./") || name.startsWith("../")) return load(path.posix.join(path.posix.dirname(file), name), imports, globals);
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, component) => String(component) });
    throw new Error(`Unexpected import ${name}`);
  }, ...globals });
  return exports;
}
function harness(format, { reference = true, referenceUrls, referencePrompt, referenceDuration = null, regenerationTarget, access = "pro", preview = false, captureRequests = false, completedJob = null, persistedJobId = completedJob?.id ?? null, wanEnabled = false } = {}) {
  const events = [], controls = {}, results = {};
  const requests = [], states = [], errors = [];
  const effects = [], readyVideos = [];
  let cursor = 0;
  let promptSet = false;
  const imports = {
    react: {
      useCallback: fn => fn,
      useState(initial) { let value = typeof initial === "function" ? initial() : initial;
        const index = cursor++;
        if (!promptSet && value === "") { promptSet = true; value = "My requested changes"; }
        if (!(index in states)) states[index] = value;
        return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
      useRef(value) { const index = cursor++; return states[index] ??= { current: value }; },
      useEffect: callback => { if (completedJob || captureRequests) effects.push(callback); }, useMemo: fn => fn(),
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries: async () => {} }) },
    "next/navigation": { usePathname: () => `/explore/${format}`, useRouter: () => ({}), useSearchParams: () => new URLSearchParams(captureRequests ? `refType=${format}&refId=${format}-fixture&exploreRecreate=1` : "") },
    "next/link": "Link",
    "@/contexts/auth-context": { useAuth: () => ({ loading: false, user: { uid: "test-owner" } }) },
    "@/lib/billing/generation-credit-policy": { DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND: 4 },
    "@/lib/ai-studio/generation-settings": load("lib/ai-studio/generation-settings.ts", {}, { process: { env: { NEXT_PUBLIC_ENABLE_OPENROUTER_WAN: String(wanEnabled) } } }),
    "@/lib/ai-studio/video-reference-policy": load("lib/ai-studio/video-reference-policy.ts", {
      "./generation-settings": load("lib/ai-studio/generation-settings.ts", {}, { process: { env: { NEXT_PUBLIC_ENABLE_OPENROUTER_WAN: String(wanEnabled) } } }),
    }),
    "@/lib/ai-studio/media-client": completedJob ? { fetchAIStudioMediaAssets: async () => [], fetchAIStudioMediaAsset: async id => ({
      id, collection: "video", sourceType: "generated_video", status: "ready", title: "Generated hook", url: "/generated-hook.mp4", durationSeconds: 3, ratio: "9:16", createdAt: "2026-10-09T00:00:00Z", metadata: {},
    }) } : {},
    "@/lib/ai-studio/media-results": load("lib/ai-studio/media-results.ts"),
    "@/lib/ai-studio/image-history": load("lib/ai-studio/image-history.ts"),
    "@/lib/ai-studio/video-history": load("lib/ai-studio/video-history.ts"),
    "@/lib/ai-studio/video-generation-state": load("lib/ai-studio/video-generation-state.ts"),
    "@/lib/ai-studio/generation-session": load("lib/ai-studio/generation-session.ts"),
    "@/lib/ai-studio/prompt-policy": load("lib/ai-studio/prompt-policy.ts", { "../../worker/src/lib/video-prompt-policy": load("worker/src/lib/video-prompt-policy.ts") }),
    "@/lib/explore/format-generation-prompt": load("lib/explore/format-generation-prompt.ts", { "@/lib/ai-studio/prompt-policy": load("lib/ai-studio/prompt-policy.ts") }),
    "@/lib/firebase/auth": { getCurrentUserIdToken: () => { events.push("waiting-for-auth"); return captureRequests || completedJob ? Promise.resolve("fixture-token") : new Promise(() => {}); } },
    "@/lib/jobs/background-job-client": { useStoredBackgroundJobIds: () => [], useRecoverableWorkflowJobs: () => ({ queries: completedJob ? [{ data: completedJob }] : [], recovering: false, recoveryError: null }), useBackgroundJobs: () => completedJob ? [{ data: completedJob }] : [], usePersistedJobIdFromUrl: () => persistedJobId,
      useCancelBackgroundJob: () => ({}), useRetryBackgroundJob: () => ({}) },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  const file = format === "slideshow" ? "components/workspace/ugc-chat-workspace.tsx" : "components/video/video-generation-workspace.tsx";
  const storageValues = new Map();
  const localStorage = { getItem: key => storageValues.get(key) ?? null, setItem: (key,value) => storageValues.set(key,value), removeItem: key => storageValues.delete(key) };
  const panelModule = load(file, imports, { URLSearchParams, localStorage, navigator: { locks: { request: async (_key, options, callback) => (typeof options === "function" ? options : callback)({ name: _key }) } }, setTimeout: () => 1, clearTimeout() {}, window: { addEventListener() {}, removeEventListener() {}, setTimeout: () => 1, clearTimeout() {}, localStorage }, console: { error: (...values) => errors.push(values.map(String).join(" ")) }, crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" }, fetch: async (url, options) => {
    assert.equal(captureRequests, true, "No network requests are allowed");
    requests.push({ url, ...options, body: JSON.parse(options.body) });
    return { ok: false, json: async () => ({ ok: false, error: "Fixture stops after capturing the request" }) };
  } });
  const Panel = format === "slideshow" ? panelModule.ImageGenerationStudioPanel : panelModule.VideoGenerationStudioPanel;
  const props = { active: true, accessState: access, creditsRemaining: 1000, creditCost: 1, recreateView: {
    referenceImageUrls: referenceUrls,
    referenceImageAssetId: regenerationTarget,
    preview, referenceImageUrl: format === "slideshow" && reference ? "https://example.test/reference.png" : undefined, styleVideo: format !== "slideshow" && reference ? {url:"https://example.test/style.mp4",name:"Style video",duration:referenceDuration,generationPrompt:referencePrompt} : undefined, emptyContent: "Empty",
    workflow: { format, controlsTarget: controls, resultsTarget: results, onGenerationStart: () => events.push("show-results"), onGeneratedVideo: video => readyVideos.push(video) },
  } };
  function find(node, type) {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, type); if (match) return match; }
    return null;
  }
  const render = () => { cursor = 0; const tree = Panel(props); return { composer: find(tree, "AiStudioComposer"), output: find(tree, "AiStudioResults") }; };
  return { events, controls, results, requests, errors, readyVideos, find, selectGallery(video) { props.recreateView.styleVideo = video; render(); return render(); }, flushEffects: async () => { for (const effect of effects.splice(0)) effect(); await new Promise(resolve => setImmediate(resolve)); }, render, ...render() };
}

test('a visible reference prompt and unchanged user instructions are submitted together', async () => {
  const h = harness('hook', { captureRequests: true, referencePrompt: 'Lift the glasses. Remove the text.' });
  await h.flushEffects();
  const composer = h.render().composer;
  assert.equal(h.find(composer.props.promptSupplement, 'textarea').props.value, 'Lift the glasses. Remove the text.');
  assert.equal(composer.props.prompt, 'My requested changes');
  await composer.props.onSubmit({ preventDefault() {} });
  assert.equal(h.requests[0].body.prompt, 'Lift the glasses. Remove the text.\n\nMy requested changes');
});

test('editing reference instructions changes the actual submitted prompt', async () => {
  const h = harness('hook', { captureRequests: true, referencePrompt: 'Original performance' });
  await h.flushEffects();
  h.find(h.render().composer.props.promptSupplement, 'textarea').props.onChange({ target: { value: 'My edited performance' } });
  await h.render().composer.props.onSubmit({ preventDefault() {} });
  assert.equal(h.requests[0].body.prompt, 'My edited performance\n\nMy requested changes');
});

test('removing the reference prompt keeps the video attached and submits only personal instructions', async () => {
  const h = harness('hook', { captureRequests: true, referencePrompt: 'Original performance' });
  await h.flushEffects();
  h.find(h.render().composer.props.promptSupplement, 'button').props.onClick();
  const composer = h.render().composer;
  assert.equal(h.find(composer.props.promptSupplement, 'textarea'), null);
  await composer.props.onSubmit({ preventDefault() {} });
  assert.equal(h.requests[0].body.prompt, 'My requested changes');
  assert.equal(h.requests[0].body.useGalleryVideoReference, true);
});

test('switching references replaces its suggestion, preserves user text, and removal clears it', () => {
  const h = harness('hook', { referencePrompt: 'First performance' });
  h.find(h.render().composer.props.promptSupplement, 'textarea').props.onChange({ target: { value: 'Edited first performance' } });
  const next = h.selectGallery({ id: 'next', url: 'https://example.test/next.mp4', name: 'Next', duration: 3, generationPrompt: 'Second performance' }).composer;
  assert.equal(next.props.prompt, 'My requested changes');
  assert.equal(h.find(next.props.promptSupplement, 'textarea').props.value, 'Second performance');
  const removed = h.selectGallery(undefined).composer;
  assert.equal(removed.props.promptSupplement, undefined);
  assert.equal(removed.props.prompt, 'My requested changes');
});


for (const format of ["hook", "wall_text"]) {
  test(format + ': decimal reference length is distinct from whole-second billing and both prompt fields reach the request', async () => {
    const seconds = format === 'hook' ? 3.7 : 6.7;
    const h = harness(format, { captureRequests: true, referenceDuration: seconds, referencePrompt: 'Keep the reference performance. Remove captions.' });
    await h.flushEffects();
    const composer = h.render().composer;
    const duration = composer.props.settings.props.children.find(n => h.find(n, 'output'));
    assert.equal(h.find(duration, 'span').props.children, 'Duration');
    assert.equal(h.find(duration, 'output').props.children[1].props.children, `${Math.round(seconds)} sec`);
    assert.equal(h.find(duration, 'small').props.children, `${seconds}s reference · source timing kept`);
    assert.equal(composer.props.estimatedCredits, Math.round(seconds) * 4);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.durationSeconds, Math.round(seconds));
    assert.equal(h.requests[0].body.referenceVideoMode, 'edit');
    assert.equal(h.requests[0].body.prompt, 'Keep the reference performance. Remove captions.\n\nMy requested changes');
  });
  for (const [seconds, selected] of [[2.8, 3], [3.3, 3], [3.49, 3], [3.5, 4], [3.7, 4], [6.3, 6], [6.7, 7]]) test(`${format}: ${seconds}s reference auto-selects ${selected}s`, async () => {
    const h = harness(format, { captureRequests: true, referenceDuration: seconds });
    await h.flushEffects();
    const composer = h.render().composer;
    const duration = composer.props.settings.props.children.find(n => h.find(n, 'output'));
    assert.equal(h.find(duration, 'output').props.children[1].props.children, `${selected} sec`);
    assert.equal(composer.props.estimatedCredits, selected * 4);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.durationSeconds, selected);
    assert.equal(h.requests[0].body.referenceVideoMode, 'edit');
  });
  test(format + ': WAN reference guidance keeps an independent supported output duration', async () => {
    const h = harness(format, { captureRequests: true, referenceDuration: 6.7, wanEnabled: true });
    await h.flushEffects();
    h.render().composer.props.settings.props.children.find(n => n?.props?.ariaLabel === 'Video model').props.onChange('wan_3_0');
    const composer = h.render().composer;
    assert.equal(composer.props.settings.props.children.some(n => h.find(n, 'output')), false);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.referenceVideoMode, undefined);
    assert.equal(Number.isInteger(h.requests[0].body.durationSeconds), true);
    assert.equal(h.requests[0].body.useGalleryVideoReference, true);
  });
  test(format + ': gallery source is requested as actual video input with the prompt and appearance image', async () => {
    const h = harness(format, { captureRequests: true });
    await h.flushEffects();
    h.render().composer.props.referenceControls.props.onChange({ kind: 'image', asset: { id: 'image', url: 'https://owned.test/image.png', title: 'Image' } }, 'image');
    await h.render().composer.props.onSubmit({ preventDefault() {} });
    assert.ok(h.requests[0], JSON.stringify({ errors: h.errors, events: h.events }));
    assert.equal(h.requests[0].body.useGalleryVideoReference, true);
    assert.equal(h.requests[0].body.referenceVideoMode, 'edit');
    assert.equal(h.requests[0].body.referenceId, format + '-fixture');
    assert.equal(h.requests[0].body.referenceImageUrls[0], 'https://owned.test/image.png');
    assert.equal(h.requests[0].body.prompt, 'My requested changes');
  });
  for (const order of [['image', 'video'], ['video', 'image']]) test(format + ': both selection orders retain both media and send a ten-second edit', async () => {
    const h = harness(format, { captureRequests: true, reference: false });
    await h.flushEffects();
    const references = {
      image: { kind: 'image', asset: { id: 'identity', url: 'https://owned.test/image.png', title: 'Identity' } },
      video: { kind: 'video', asset: { id: 'source', url: 'https://owned.test/source.mp4', durationSeconds: 10, ratio: '9:16', title: 'Source' } },
    };
    for (const kind of order) h.render().composer.props.referenceControls.props.onChange(references[kind], kind);
    let composer = h.render().composer;
    assert.equal(composer.props.referenceControls.props.imageSelection.asset.id, 'identity');
    assert.equal(composer.props.referenceControls.props.videoSelection.asset.id, 'source');
    assert.equal(composer.props.estimatedCredits ?? Number(composer.props.accessMessage.match(/(\d+) AI credits/)?.[1]), 40);
    assert.match(composer.props.settingsSummary, /Google Omni.*10.0s clip/);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.referenceImageUrls[0], references.image.asset.url);
    assert.equal(h.requests[0].body.referenceVideoUrl, references.video.asset.url);
    assert.equal(h.requests[0].body.referenceVideoDurationSeconds, 10);
    assert.equal(h.requests[0].body.durationSeconds, 10);
    assert.equal(h.requests[0].body.referenceVideoMode, 'edit');
    assert.equal(h.requests[0].body.useGalleryVideoReference, false);
    composer.props.referenceControls.props.onChange(null, 'image');
    assert.equal(h.render().composer.props.referenceControls.props.videoSelection.asset.id, 'source');
    h.render().composer.props.referenceControls.props.onChange(references.image, 'image');
    h.render().composer.props.referenceControls.props.onChange(null, 'video');
    assert.equal(h.render().composer.props.referenceControls.props.imageSelection.asset.id, 'identity');
    assert.equal(h.render().composer.props.referenceControls.props.videoSelection, null);
  });
  test(format + ': switching to WAN retains the source clip', () => {
    const h = harness(format, { wanEnabled: true });
    const model = h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === 'Video model');
    assert.equal(model.props.options.find(option => option.value === 'wan_3_0').disabled, false);
    model.props.onChange('wan_3_0');
    assert.equal(h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === 'Video model').props.value, 'wan_3_0');
    assert.ok(h.render().composer.props.referenceControls.props.styleVideo);
  });
}
