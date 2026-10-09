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
  vm.runInNewContext(code, { exports, process: { env: {} }, require: name => {
    if(name === "../../worker/src/lib/video-prompt-policy") return load("worker/src/lib/video-prompt-policy.ts");
    if (name in imports) return imports[name];
    if (name.startsWith("./")) return load(path.posix.join(path.posix.dirname(file), name), imports, globals);
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, component) => String(component) });
    throw new Error(`Unexpected import ${name}`);
  }, ...globals });
  return exports;
}
function harness(format, { reference = true, referenceUrls, access = "pro", captureRequests = false, completedJob = null, persistedJobId = completedJob?.id ?? null, wanEnabled = false } = {}) {
  const events = [], controls = {}, results = {};
  const requests = [], states = [], errors = [];
  const effects = [], readyVideos = [];
  let cursor = 0;
  let promptSet = false;
  const imports = {
    react: {
      useState(initial) { let value = typeof initial === "function" ? initial() : initial;
        const index = cursor++;
        if (!promptSet && value === "") { promptSet = true; value = "My requested changes"; }
        if (!(index in states)) states[index] = value;
        return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; }, useRef: value => ({ current: value }), useEffect: callback => { if (completedJob) effects.push(callback); }, useMemo: fn => fn(),
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries: async () => {} }) },
    "next/navigation": { usePathname: () => `/explore/${format}`, useRouter: () => ({}), useSearchParams: () => new URLSearchParams(captureRequests ? `refType=${format}&refId=${format}-fixture&exploreRecreate=1` : "") },
    "next/link": "Link",
    "@/contexts/auth-context": { useAuth: () => ({ loading: false, user: { uid: "test-owner" } }) },
    "@/lib/billing/generation-credit-policy": { DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND: 4 },
    "@/lib/ai-studio/generation-settings": load("lib/ai-studio/generation-settings.ts", {}, { process: { env: { NEXT_PUBLIC_ENABLE_OPENROUTER_WAN: String(wanEnabled) } } }),
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
  const panelModule = load(file, imports, { URLSearchParams, setTimeout: () => 1, clearTimeout() {}, window: { addEventListener() {}, removeEventListener() {}, setTimeout: () => 1, clearTimeout() {}, localStorage: { getItem: () => null, setItem() {} } }, console: { error: (...values) => errors.push(values.map(String).join(" ")) }, crypto: { randomUUID: () => "fixture-request" }, fetch: async (url, options) => {
    assert.equal(captureRequests, true, "No network requests are allowed");
    requests.push({ url, ...options, body: JSON.parse(options.body) });
    return { ok: false, json: async () => ({ ok: false, error: "Fixture stops after capturing the request" }) };
  } });
  const Panel = format === "slideshow" ? panelModule.ImageGenerationStudioPanel : panelModule.VideoGenerationStudioPanel;
  const props = { active: true, accessState: access, creditsRemaining: 1000, creditCost: 1, recreateView: {
    referenceImageUrls: referenceUrls,
    preview: false, referenceImageUrl: format === "slideshow" && reference ? "https://example.test/reference.png" : undefined, styleVideo: format !== "slideshow" && reference ? {url:"https://example.test/style.mp4",name:"Style video",duration:null} : undefined, emptyContent: "Empty",
    workflow: { format, controlsTarget: controls, resultsTarget: results, onGenerationStart: () => events.push("show-results"), onGeneratedVideo: video => readyVideos.push(video) },
  } };
  function find(node, type) {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, type); if (match) return match; }
    return null;
  }
  const render = () => { cursor = 0; const tree = Panel(props); return { composer: find(tree, "AiStudioComposer"), output: find(tree, "AiStudioResults") }; };
  return { events, controls, results, requests, errors, readyVideos, flushEffects: async () => { for (const effect of effects.splice(0)) effect(); await new Promise(resolve => setImmediate(resolve)); }, render, ...render() };
}

for (const format of ["hook", "wall_text"]) {
  test(`${format}: choosing WAN exposes its settings and sends the exact three-second request`, async () => {
    const h = harness(format, { captureRequests: true, wanEnabled: true });
    const setting = (composer, label) => composer.props.settings.props.children.find(node => node?.props?.ariaLabel === label);
    const model = setting(h.composer, "Video model");
    assert.equal(model.props.options.find(option => option.value === "wan_3_0").disabled, false);
    model.props.onChange("wan_3_0");
    let composer = h.render().composer;
    assert.equal(composer.props.referenceControls.props.videoInputEnabled, false);
    setting(composer, "Video duration").props.onChange("3");
    setting(composer, "Video quality").props.onChange("1080p");
    composer = h.render().composer;
    assert.match(composer.props.settingsSummary, /WAN 3\.0.*3s/);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.model, "wan_3_0");
    assert.equal(h.requests[0].body.durationSeconds, 3); assert.equal(h.requests[0].body.resolution, "1080p");
    assert.equal(h.requests[0].body.exploreFormat, format);
  });
  test(`${format}: restoring the current completed generation notifies the opening card without a result click`, async () => {
    const h = harness(format, { completedJob: { id: "current-job", jobType: "video_generation", exploreFormat: format, status: "completed", output: { mediaAssetId: "ready-video", url: "/generated-hook.mp4", ratio: "9:16" }, updatedAt: "2026-10-09T00:00:00Z" } });
    await h.flushEffects();
    assert.equal(h.readyVideos.length, 1); assert.equal(h.readyVideos[0].mediaAssetId, "ready-video");
    assert.equal(h.readyVideos[0].durationSeconds, 3); assert.equal(h.requests.length, 0);
  });
  test(`${format}: unrelated and other-workflow completions cannot replace the opening`, async () => {
    for (const other of [false, true]) {
      const h = harness(format, { persistedJobId: "current-job", completedJob: { id: other ? "current-job" : "historical-job", jobType: "video_generation", exploreFormat: other ? "slideshow" : format, status: "completed", output: { mediaAssetId: "wrong-video", url: "/wrong.mp4" }, updatedAt: "2026-10-09T00:00:00Z" } });
      await h.flushEffects(); assert.equal(h.readyVideos.length, 0); assert.equal(h.requests.length, 0);
    }
  });
  test(`${format}: a gallery video remains playable guidance and never becomes an image attachment`, async () => {
    const h = harness(format, { captureRequests: true });
    assert.equal(h.composer.props.referenceControls.props.styleVideo.url, "https://example.test/style.mp4");
    await h.composer.props.onSubmit({preventDefault() {}});
    assert.equal(h.requests[0].body.avatarImageUrl,null);
    assert.equal(h.requests[0].body.referenceVideoUrl,null);
    assert.equal(h.requests[0].body.referenceVideoAssetId,null);
    assert.equal(h.requests[0].body.referenceId,`${format}-fixture`);
  });
  test(`${format}: custom video is sent as owned generation input in the real generation request`, async () => {
    const h = harness(format, { captureRequests: true });
    h.composer.props.referenceControls.props.onChange({ kind: "video", asset: { url: "https://owned-media.test/clip.mp4", id: "reference-video-id", durationSeconds: 2.8, ratio: "16:9", title: "My clip" } });
    const { composer } = h.render();
    assert.match(composer.props.settingsSummary, /Runway.*2.8s clip.*16:9/);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].url, "/api/ai-studio/videos/generate");
    assert.equal(h.requests[0].body.avatarImageUrl, null);
    assert.equal(h.requests[0].body.referenceVideoUrl, "https://owned-media.test/clip.mp4");
    assert.equal(h.requests[0].body.referenceVideoDurationSeconds, 2.8);
    assert.equal(h.requests[0].body.referenceVideoAssetId, "reference-video-id");
    assert.equal(h.requests[0].body.durationSeconds, 3);
    assert.equal(h.requests[0].body.exploreFormat, format);
    assert.equal(h.requests[0].body.prompt, "My requested changes");
    assert.deepEqual(h.events, ["show-results", "waiting-for-auth"]);
  });
  test(`${format}: custom image replaces the default and generation waits for upload completion`, async () => {
    const h = harness(format, { captureRequests: true });
    h.composer.props.referenceControls.props.onPendingChange(true);
    let composer = h.render().composer;
    assert.equal(composer.props.generateDisabled, true);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(h.requests, []); assert.deepEqual(h.events, []);
    composer.props.referenceControls.props.onChange({ kind: "image", asset: { url: "https://owned-media.test/image.png", title: "My image" } });
    composer.props.referenceControls.props.onPendingChange(false);
    composer = h.render().composer;
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.avatarImageUrl, "https://owned-media.test/image.png");
    assert.equal(h.requests[0].body.referenceVideoUrl, null);
  });
}

for (const format of ["hook", "wall_text", "slideshow"]) {
  test(`${format} switches to results synchronously before authentication or a generation request`, () => {
    const h = harness(format);
    assert.ok(h.composer); assert.ok(h.output);
    assert.equal(h.composer.props.layout, "workflow");
    assert.equal(h.composer.props.portalTarget, h.controls);
    assert.equal(h.output.props.portalTarget, h.results);
    h.composer.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(h.events, ["show-results", "waiting-for-auth"]);
  });
  test(`${format} respects generation access and the image-only slideshow reference requirement`, () => {
    for (const options of [...(format === "slideshow" ? [{ reference: false }] : []), { access: "locked" }]) {
      const h = harness(format, options);
      h.composer.props.onSubmit({ preventDefault() {} });
      assert.deepEqual(h.events, []);
    }
  });
  if (format !== "slideshow") test(`${format} can start with instructions alone`, () => {
    const h = harness(format, { reference: false });
    assert.equal(h.composer.props.generateDisabled, false);
    h.composer.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(h.events, ["show-results", "waiting-for-auth"]);
    assert.equal(h.composer.props.referenceControls.type, "FormatGenerationReferences");
    assert.equal(h.composer.props.leadingControl, undefined);
    assert.equal(h.composer.props.promptLabel, "Your instructions");
  });
}

test("slideshow sends the exact selected context independently of output quantity", async () => {
  const urls = ["https://example.test/reference.png", "https://example.test/slide-4.png", "https://example.test/slide-6.png"];
  const h = harness("slideshow", { captureRequests: true, referenceUrls: urls });
  const count = h.composer.props.settings.props.children.find(node => node.props?.ariaLabel === "Number of images");
  assert.equal(count.props.fieldLabel, "Versions for this slide");
  count.props.onChange("2");
  await h.render().composer.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.equal(h.requests.length, 1, JSON.stringify(h.errors));
  assert.deepEqual(h.requests[0].body.referenceImageUrls, urls);
  assert.equal(h.requests[0].body.quantity, 2);
  assert.equal(h.requests[0].body.prompt, "My requested changes");
});

test("slideshow uses GPT Image 2.5 by default, offers Nano Banana and omits Seedream", async () => {
  const h = harness("slideshow", { captureRequests: true });
  const settings = [h.composer.props.settings.props.children].flat(Infinity);
  const selector = settings.find(node => node.props?.ariaLabel === "Image model");
  assert.equal(selector.props.value, "gpt_image_2_5");
  assert.deepEqual(Array.from(selector.props.options, option => option.value), ["gpt_image_2_5", "nano_banana_2"]);
  await h.composer.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.equal(h.requests.length, 1, JSON.stringify(h.errors));
  assert.equal(h.requests[0].body.model, "gpt_image_2_5");
  assert.equal(h.requests[0].body.referenceImageUrl, "https://example.test/reference.png");
  assert.equal(h.requests[0].body.exploreFormat, "slideshow");
});
