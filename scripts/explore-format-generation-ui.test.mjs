import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import path from "node:path";
import ts from "typescript";
import * as remixSource from "../lib/explore/remix-source.ts";
import * as pendingGeneration from "../lib/ai-studio/pending-generation.ts";
import * as readDeadline from "../lib/http/read-deadline.ts";
import * as slideshowBatch from "../worker/src/lib/slideshow-generation-batch.ts";
import * as slideshowGroups from "../lib/explore/slideshow-generation-groups.ts";
import * as referencePrompts from "../lib/explore/reference-video-prompts.ts";

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, process: { env: {} }, require: name => {
    if(name === "../../worker/src/lib/video-prompt-policy") return load("worker/src/lib/video-prompt-policy.ts");
    if (name in imports) return imports[name];
    if (name === "../../worker/src/lib/slideshow-generation-batch.ts" || name === "@/worker/src/lib/slideshow-generation-batch") return slideshowBatch;
    if (name === "@/lib/explore/slideshow-generation-groups") return slideshowGroups;
    if (name === "@/lib/explore/slideshow-composer-draft") return load("lib/explore/slideshow-composer-draft.ts");
    if (name === "../../lib/explore/reference-video-prompts.ts") return referencePrompts;
    if (name === "../explore/remix-source.ts") return remixSource;
    if (name === "@/lib/explore/slideshow-image") return { resolveSlideshowImage: async image => image };
    if (name === "@/worker/src/lib/image-reference-context") return load("worker/src/lib/image-reference-context.ts");
    if (name.startsWith("./")) return load(path.posix.join(path.posix.dirname(file), name), imports, globals);
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, component) => String(component) });
    throw new Error(`Unexpected import ${name}`);
  }, ...globals });
  return exports;
}
function harness(format, { reference = true, referenceUrls, slideshowSlideCount, regenerationTarget, access = "pro", preview = false, captureRequests = false, completedJob = null, completedJobs = null, persistedJobId = completedJob?.id ?? null, wanEnabled = false, seedanceEnabled = false, initialStorage = [], recoveredBatch = null } = {}) {
  const events = [], controls = {}, results = {};
  const requests = [], states = [], errors = [];
  const effects = [], readyVideos = [], selectedVersions = [], autoVersions = [];
  const jobs = completedJobs ?? (completedJob ? [completedJob] : []);
  const fixtureUser = { uid: "test-owner" };
  let cursor = 0, refCursor = 0, effectCursor = 0;
  const refs = [], effectDependencies = [];
  let promptSet = false, rendering = false, stateChanged = false;
  const imports = {
    react: {
      useState(initial) { let value = typeof initial === "function" ? initial() : initial;
        const index = cursor++;
        if (!promptSet && value === "") { promptSet = true; value = "My requested changes"; }
        if (!(index in states)) states[index] = value;
        return [states[index], next => { const value = typeof next === "function" ? next(states[index]) : next; if (rendering && !Object.is(states[index], value)) stateChanged = true; states[index] = value; }]; },
      useRef(value) { return refs[refCursor++] ??= { current: value }; },
      useEffect(callback, deps) {
        const index = effectCursor++, prior = effectDependencies[index];
        if (!prior || !deps || deps.some((value, i) => !Object.is(value, prior[i]))) {
          effectDependencies[index] = deps ?? [];
          // Submission-only fixtures still execute the actual account lifecycle.
          if (callback.toString().includes("activeUserIdRef.current =") || callback.toString().includes("activeGalleryVideoUrl.current =")) callback();
          else if (jobs.length) effects.push(callback);
        }
      }, useMemo: fn => fn(), useCallback: fn => fn,
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries: async () => {} }) },
    "next/navigation": { usePathname: () => `/explore/${format}`, useRouter: () => ({}), useSearchParams: () => new URLSearchParams(captureRequests ? `refType=${format}&refId=${format}-fixture&exploreRecreate=1` : "") },
    "next/link": "Link",
    "@/contexts/auth-context": { useAuth: () => ({ loading: false, user: fixtureUser }) },
    "@/lib/billing/generation-credit-policy": { DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND: 4 },
    "@/lib/ai-studio/generation-settings": load("lib/ai-studio/generation-settings.ts", {}, { process: { env: { NEXT_PUBLIC_ENABLE_OPENROUTER_WAN: String(wanEnabled), NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE: String(seedanceEnabled) } } }),
    "@/lib/ai-studio/video-reference-policy": load("lib/ai-studio/video-reference-policy.ts", { "./generation-settings": load("lib/ai-studio/generation-settings.ts") }),
    "@/lib/ai-studio/media-client": jobs.length ? { fetchAIStudioMediaAssets: async () => [], fetchAIStudioMediaAsset: async id => ({
      id, collection: format === "slideshow" ? "image" : "video", sourceType: format === "slideshow" ? "generated_image" : "generated_video", status: "ready", title: "Generated hook", url: "/generated-hook.mp4", durationSeconds: 3, ratio: "9:16", createdAt: "2026-10-09T00:00:00Z", metadata: {},
    }) } : {},
    "@/lib/ai-studio/media-results": load("lib/ai-studio/media-results.ts"),
    "@/lib/ai-studio/image-history": load("lib/ai-studio/image-history.ts"),
    "@/lib/ai-studio/video-history": load("lib/ai-studio/video-history.ts"),
    "@/lib/ai-studio/video-generation-state": load("lib/ai-studio/video-generation-state.ts"),
    "@/lib/ai-studio/generation-session": load("lib/ai-studio/generation-session.ts"),
    "@/lib/ai-studio/pending-generation": pendingGeneration,
    "@/components/explore/slideshow-prompt-improver": { useSlideshowPromptImprover: options => ({ busy: false, action: { type: "button", props: { onClick: () => options.onChange("One improved prompt for the entire slideshow") } }, feedback: null }) },
    // The real recovery hook is covered by slideshow-reliable-edits.browser.cjs.
    "@/components/explore/use-slideshow-composer-draft": { useSlideshowComposerDraft: () => { const [prompt, setPrompt] = imports.react.useState("My requested changes"); const [images, setImages] = imports.react.useState([]); return { prompt, setPrompt, images, setImages, busy: false, error: null }; } },
    "@/components/generation/use-generation-discovery": { useGenerationDiscovery: args => ({ available: Boolean(recoveredBatch), checking: false, error: null, check: async () => { if (recoveredBatch) args.onRecovered(recoveredBatch.result, recoveredBatch.input); } }) },
    "@/lib/http/read-deadline": readDeadline,
    "@/lib/ai-studio/prompt-policy": load("lib/ai-studio/prompt-policy.ts", { "../../worker/src/lib/video-prompt-policy": load("worker/src/lib/video-prompt-policy.ts") }),
    "@/lib/explore/format-generation-prompt": load("lib/explore/format-generation-prompt.ts", { "@/lib/ai-studio/prompt-policy": load("lib/ai-studio/prompt-policy.ts") }),
    "@/lib/firebase/auth": { getCurrentUserIdToken: () => { events.push("waiting-for-auth"); return captureRequests || jobs.length ? Promise.resolve("fixture-token") : new Promise(() => {}); } },
    "@/lib/jobs/background-job-client": { useStoredBackgroundJobIds: () => completedJobs ? jobs.map(job => job.id) : [], useRecoverableWorkflowJobs: () => ({ queries: jobs.map(data => ({ data })), recovering: false, recoveryError: null }), useBackgroundJobs: () => jobs.map(data => ({ data })), usePersistedJobIdFromUrl: () => persistedJobId,
      useCancelBackgroundJob: () => ({}), useRetryBackgroundJob: () => ({}) },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  };
  const file = format === "slideshow" ? "components/workspace/ugc-chat-workspace.tsx" : "components/video/video-generation-workspace.tsx";
  const stored = new Map(initialStorage);
  const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  const panelModule = load(file, imports, { URLSearchParams, AbortSignal, localStorage: storage, navigator: { locks: { request: async (_key, _options, callback) => callback({}) } }, setTimeout: () => 1, clearTimeout() {}, window: { addEventListener() {}, removeEventListener() {}, setTimeout: () => 1, clearTimeout() {}, localStorage: storage }, console: { error: (...values) => errors.push(values.map(String).join(" ")) }, crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" }, fetch: async (url, options) => {
    assert.equal(captureRequests, true, "No network requests are allowed");
    requests.push({ url, ...options, body: JSON.parse(options.body) });
    return { ok: false, json: async () => ({ ok: false, error: "Fixture stops after capturing the request" }) };
  } });
  const Panel = format === "slideshow" ? panelModule.ImageGenerationStudioPanel : panelModule.VideoGenerationStudioPanel;
  const props = { active: true, accessState: access, creditsRemaining: 1000, creditCost: 1, recreateView: {
    referenceImageUrls: referenceUrls,
    slideshowSlideCount,
    referenceImageAssetId: regenerationTarget,
    preview, referenceImageUrl: format === "slideshow" && reference ? "https://example.test/reference.png" : undefined, styleVideo: format !== "slideshow" && format !== "studio" && reference ? {url:"https://example.test/style.mp4",name:"Style video",duration:null} : undefined, emptyContent: "Empty",
    workflow: format === "studio" ? undefined : { format, controlsTarget: controls, resultsTarget: results, onGenerationStart: () => events.push("show-results"), onGeneratedVideo: video => readyVideos.push(video), onSelectSlideshow: images => { selectedVersions.push(images); return true; }, onGeneratedSlideshow: images => { autoVersions.push(images); return true; } },
  } };
  props.recreateView.onClearReference = () => { props.recreateView.styleVideo = undefined; };
  function find(node, type) {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, type); if (match) return match; }
    return null;
  }
  const render = () => { let tree; do { stateChanged = false; rendering = true; cursor = 0; refCursor = 0; effectCursor = 0; tree = Panel(props); rendering = false; } while (stateChanged); return { composer: find(tree, "AiStudioComposer"), output: find(tree, "AiStudioResults") }; };
  return { events, controls, results, requests, errors, readyVideos, selectedVersions, autoVersions, stored, selectGallery(video) { props.recreateView.styleVideo = video; return render(); }, clearGallery() { props.recreateView.onClearReference(); return render(); }, flushEffects: async () => { for (const effect of effects.splice(0)) effect(); await new Promise(resolve => setImmediate(resolve)); }, render, ...render() };
}

function resultNodes(tree) {
  return Array.isArray(tree) ? tree.flatMap(resultNodes) : tree && typeof tree === "object" ? [tree, ...resultNodes(tree.props?.children)] : [];
}

test("slideshow sends the text-box rewrite through the existing generation request without per-slide plans", async () => {
  for (const editAfterRewrite of [false, true]) {
    const h = harness("slideshow", { referenceUrls: ["https://example.test/reference.png", "https://example.test/slide4.png"], slideshowSlideCount: 2, captureRequests: true });
    let composer = h.render().composer;
    composer.props.promptAction.props.onClick();
    composer = h.render().composer;
    assert.equal(composer.props.prompt, "One improved prompt for the entire slideshow");
    if (editAfterRewrite) { composer.props.onPromptChange("My edited rewrite"); composer = h.render().composer; }
    await composer.props.onSubmit({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    const sent = h.requests.find(request => request.url === "/api/ai-studio/images/generate");
    assert.ok(sent);
    assert.equal(sent.body.prompt, editAfterRewrite ? "My edited rewrite" : "One improved prompt for the entire slideshow");
    assert.equal("slideshowPromptPlan" in sent.body, false);
    assert.equal(sent.body.slideshowSlideCount, 2);
    assert.deepEqual(Array.from(sent.body.referenceImageUrls), ["https://example.test/reference.png", "https://example.test/slide4.png"]);
  }
});

for (const state of ["completed", "queued", "failed"]) test(`slideshow groups a ${state} neighboring slide without duplicate cards or automatic draft edits`, async () => {
  const job = (index, status) => ({ id: `slide-${index}`, jobType: "image_generation", exploreFormat: "slideshow", status, createdAt: `2026-10-16T10:00:0${2 - index}Z`, updatedAt: "2026-10-16T10:01:00Z", slideshowGeneration: slideshowBatch.slideshowGenerationSlot("batch", 2, 1, index), output: status === "completed" ? { mediaAssetId: `asset-${index}`, url: `https://owned.test/${index}.png`, ratio: "4:5" } : null });
  const jobs = [job(1, "processing"), job(0, "processing")];
  const h = harness("slideshow", { completedJobs: jobs });
  await h.flushEffects(); h.render();
  Object.assign(jobs[0], job(1, state)); Object.assign(jobs[1], job(0, "completed"));
  for (let i = 0; i < 3; i++) { await h.flushEffects(); h.render(); }
  const nodes = resultNodes(h.render().output);
  const versions = nodes.filter(node => node.type === "section" && node.props["aria-label"] === "Generated slideshow version 1");
  assert.equal(versions.length, 1);
  const cards = nodes.filter(node => node.type?.name === "ImageGenerationCard");
  assert.equal(cards.length, state === "failed" ? 1 : 2);
  assert.equal(cards[0].props.asset.id, "asset-0", "reference order wins over request/completion order");
  assert.equal(cards[0].props.compact, true);
  const edit = nodes.find(node => node.type === "Button" && /^Edit (these|this)/.test([node.props.children].flat().join("")));
  assert.equal(edit.props.disabled, state === "queued");
  assert.equal(h.autoVersions.length, 0, "completion must not populate the draft behind the user's back");
  if (state !== "queued") {
    await edit.props.onClick(); await new Promise(setImmediate);
    assert.deepEqual(Array.from(h.selectedVersions[0], image => image.id), state === "completed" ? ["asset-0", "asset-1"] : ["asset-0"]);
  }
});

test("slideshow pending cards restore prompt and ratio from the same owner/scope key used by admission", async () => {
  const jobId = "00000000-0000-4000-8000-000000000002";
  const metadataKey = `ugc-ai-studio.image-job.v2.test-owner.slideshow.${jobId}`;
  const h = harness("slideshow", { initialStorage: [[metadataKey, JSON.stringify({ prompt: "Original slide instructions", aspectRatio: "4:5" })]], completedJob: { id: jobId, jobType: "image_generation", exploreFormat: "slideshow", status: "queued", createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z" } });
  await h.flushEffects();
  const pending = [h.render().output]; let card;
  while (pending.length) {
    const node = pending.shift();
    if (Array.isArray(node)) pending.push(...node);
    else if (node && typeof node === "object") {
      if (node.type?.name === "ImageGenerationCard") { card = node; break; }
      pending.push(node.props?.children);
    }
  }
  assert.ok(card, "Recovered output remains visible through result grouping");
  assert.equal(card.props.prompt, "Original slide instructions"); assert.equal(card.props.aspectRatio, "4:5");
});

test("slideshow failures have a stable dismissal identity across polling and a new identity for another failed job", () => {
  const failed = { id: "failed-slide-one", jobType: "image_generation", exploreFormat: "slideshow", status: "failed", error: { message: "The image provider's credit balance is too low.", retryable: false } };
  const h = harness("slideshow", { completedJob: failed });
  const before = h.render().output.props;
  assert.equal(before.status.tone, "error");
  assert.ok(before.dismissibleStatusKey);
  failed.updatedAt = "2026-10-16T08:00:00Z";
  assert.equal(h.render().output.props.dismissibleStatusKey, before.dismissibleStatusKey, "a status poll must not restart the notice");
  failed.id = "failed-slide-two";
  assert.notEqual(h.render().output.props.dismissibleStatusKey, before.dismissibleStatusKey, "a distinct failed job must announce its error");
  assert.equal(failed.status, "failed", "dismissal identity never changes durable job status");
  assert.equal(harness("studio").output.props.dismissibleStatusKey, undefined);
});

test("read-only earlier image recovery merges scoped job hints and retains newer metadata", async () => {
  const oldJob = "00000000-0000-4000-8000-000000000002", newJob = "00000000-0000-4000-8000-000000000003";
  const storageKey = "ugc-ai-studio.latest-image-job.v2.test-owner.slideshow", newMetadataKey = `ugc-ai-studio.image-job.v2.test-owner.slideshow.${newJob}`;
  const h = harness("slideshow", { initialStorage: [[storageKey, JSON.stringify([newJob])], [newMetadataKey, JSON.stringify({ prompt: "Newer instructions", aspectRatio: "9:16" })]], recoveredBatch: { result: { jobs: [{ jobId: oldJob }] }, input: { prompt: "Earlier slide instructions", aspectRatio: "4:5" } } });
  const button = h.composer.props.secondaryActions.props.children.find(node => node?.props?.children === "Check earlier requests");
  await button.props.onClick();
  assert.deepEqual(new Set(JSON.parse(h.stored.get(storageKey))), new Set([newJob, oldJob]));
  assert.equal(JSON.parse(h.stored.get(`ugc-ai-studio.image-job.v2.test-owner.slideshow.${oldJob}`)).prompt, "Earlier slide instructions");
  assert.equal(JSON.parse(h.stored.get(newMetadataKey)).prompt, "Newer instructions"); assert.equal(h.requests.length, 0);
});

test("earlier video discovery preserves newer hints and cannot select an old completed opening", async () => {
  const oldJob = "00000000-0000-4000-8000-000000000002", newJob = "00000000-0000-4000-8000-000000000003";
  const storageKey = "ugc-ai-studio.latest-video-job.v2.test-owner.hook";
  const h = harness("hook", { initialStorage: [[storageKey, JSON.stringify([newJob])]], completedJob: { id: oldJob, jobType: "video_generation", exploreFormat: "hook", status: "completed", output: { mediaAssetId: "old-video", url: "/old.mp4", ratio: "9:16" }, updatedAt: "2026-10-13T00:00:00Z" }, recoveredBatch: { result: { jobs: [{ jobId: oldJob }] }, input: { prompt: "Earlier instructions", aspectRatio: "9:16", model: "google_omni", resolution: "720p" } } });
  const button = h.composer.props.secondaryActions.props.children.find(node => node?.props?.children === "Check earlier requests");
  await button.props.onClick(); await h.flushEffects();
  assert.deepEqual(new Set(JSON.parse(h.stored.get(storageKey))), new Set([newJob, oldJob]));
  assert.equal(JSON.parse(h.stored.get(`ugc-ai-studio.video-job.v2.test-owner.hook.${oldJob}`)).prompt, "Earlier instructions");
  assert.equal(h.readyVideos.length, 0); assert.equal(h.requests.length, 0);
});

for (const format of ["hook", "wall_text"]) {
  test(`${format}: Seedance keeps gallery guidance, output duration and audio without Omni edit mode`, async () => {
    const h = harness(format, { seedanceEnabled: true, captureRequests: true });
    const setting = label => h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === label);
    h.render().composer.props.referenceControls.props.onStyleVideoDurationChange("https://example.test/style.mp4", 12);
    setting("Video model").props.onChange("seedance_2_5");
    setting("Video duration").props.onChange(17);
    const audio = { kind: "audio", asset: { id: "seedance-audio", url: "https://owned.test/voice.mp3", title: "Voice", durationSeconds: 3, fileSizeBytes: 1000 } };
    h.render().composer.props.referenceControls.props.onChange(audio, "audio");
    const composer = h.render().composer;
    assert.equal(composer.props.generateDisabled, false);
    assert.equal(composer.props.estimatedCredits, 68);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests.length, 1);
    const input = h.requests[0].body;
    assert.equal(input.exploreFormat, format); assert.equal(input.model, "seedance_2_5");
    assert.equal(input.useGalleryVideoReference, true); assert.equal(input.referenceVideoMode, undefined);
    assert.equal(input.durationSeconds, 17); assert.deepEqual(input.referenceAudioUrls, [audio.asset.url]);
    assert.deepEqual(input.referenceAudioAssetIds, [audio.asset.id]);
  });
  test(`${format}: Seedance 2.5 is selectable and submits its exact output settings`, async () => {
    const h = harness(format, { seedanceEnabled: true, reference: false, captureRequests: true });
    const setting = label => h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === label);
    const option = setting("Video model").props.options.find(option => option.value === "seedance_2_5");
    assert.ok(option, "Explore must offer Seedance alongside Omni and WAN");
    assert.equal(option.label, "Seedance 2.5");
    assert.equal(option.disabled, false);
    setting("Video model").props.onChange(option.value);
    setting("Video duration").props.onChange(17);
    setting("Video quality").props.onChange("480p");
    const composer = h.render().composer;
    assert.match(composer.props.settingsSummary, /Seedance 2\.5.*17s/);
    assert.equal(composer.props.referenceControls.props.audioInputEnabled, true);
    assert.equal(composer.props.referenceControls.props.videoInputEnabled, true);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].body.model, "seedance_2_5");
    assert.equal(h.requests[0].body.durationSeconds, 17);
    assert.equal(h.requests[0].body.resolution, "480p");
    const disabled = harness(format).composer.props.settings.props.children.find(node => node?.props?.ariaLabel === "Video model").props.options.find(option => option.value === "seedance_2_5");
    assert.equal(disabled.disabled, true, "the provider kill switch remains respected");
  });
  test(`${format}: local preview allows supported quality changes while generation remains locked`, () => {
    const h = harness(format, { preview: true, access: "signed_out", reference: false });
    const setting = (label) => h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === label);
    const quality = setting("Video quality");
    assert.equal(quality.props.disabled, false);
    setting("Video model").props.onChange("google_omni");
    const omniQuality = setting("Video quality");
    assert.equal(omniQuality.props.options.find(option => option.value === "1080p").disabled, false);
    assert.equal(omniQuality.props.options.find(option => option.value === "480p").disabled, true);
    omniQuality.props.onChange("1080p");
    assert.equal(setting("Video quality").props.value, "1080p");
    assert.equal(h.render().composer.props.generateDisabled, true);
    assert.equal(h.requests.length, 0);
  });
  for (const duration of [2, 3, 17, 30]) test(`${format}: WAN exposes its settings and sends the exact ${duration}-second request`, async () => {
    const h = harness(format, { captureRequests: true, wanEnabled: true, reference: false });
    const setting = (composer, label) => composer.props.settings.props.children.find(node => node?.props?.ariaLabel === label);
    const model = setting(h.composer, "Video model");
    assert.equal(model.props.options.find(option => option.value === "wan_3_0").disabled, false);
    model.props.onChange("wan_3_0");
    let composer = h.render().composer;
    assert.equal(composer.props.referenceControls.props.videoInputEnabled, true);
    assert.equal(composer.props.referenceControls.props.audioInputEnabled, true);
    setting(composer, "Video duration").props.onChange(duration);
    setting(composer, "Video quality").props.onChange("1080p");
    composer = h.render().composer;
    assert.match(composer.props.settingsSummary, new RegExp(`WAN 3\\.0.*${duration}s`));
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.model, "wan_3_0");
    assert.equal(h.requests[0].body.durationSeconds, duration); assert.equal(h.requests[0].body.resolution, "1080p");
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
  test(`${format}: a gallery video becomes an explicit source input and never becomes an image attachment`, async () => {
    const h = harness(format, { captureRequests: true });
    assert.equal(h.composer.props.referenceControls.props.styleVideo.url, "https://example.test/style.mp4");
    await h.composer.props.onSubmit({preventDefault() {}});
    assert.equal(h.requests[0].body.avatarImageUrl,null);
    assert.equal(h.requests[0].body.referenceVideoUrl,null);
    assert.equal(h.requests[0].body.referenceVideoAssetId,null);
    assert.equal(h.requests[0].body.useGalleryVideoReference, true);
    assert.equal(h.requests[0].body.referenceVideoMode, "edit");
    assert.equal(h.requests[0].body.referenceId,`${format}-fixture`);
  });
  test(`${format}: gallery metadata displays seconds before generation and preserves the video request`, async () => {
    const h = harness(format, { captureRequests: true });
    const durationText = () => h.render().composer.props.settings.props.children
      .find(node => node?.type === "div" && node.props.children[1]?.type === "output").props.children[1].props.children[1].props.children;
    assert.equal(durationText(), "Reading…");
    h.render().composer.props.referenceControls.props.onStyleVideoDurationChange("https://example.test/style.mp4", 7.54);
    assert.equal(durationText(), "8 sec");
    assert.equal(h.render().composer.props.estimatedCredits, 32);
    await h.render().composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.durationSeconds, 8);
    assert.equal(h.requests[0].body.useGalleryVideoReference, true);
    assert.equal(h.requests[0].body.referenceVideoUrl, null, "The server still resolves the registered video independently");
    assert.deepEqual(h.requests[0].body.referenceImageUrls, []);
  });
  test(`${format}: switching video references cannot inherit a stale duration`, () => {
    const h = harness(format);
    const first = h.composer.props.referenceControls.props;
    first.onStyleVideoDurationChange(first.styleVideo.url, 4);
    const next = { id: "next", url: "https://example.test/next.mp4", name: "Next", duration: null };
    h.selectGallery(next);
    const controls = h.render().composer.props.referenceControls.props;
    controls.onStyleVideoDurationChange(next.url, 9.25);
    first.onStyleVideoDurationChange(first.styleVideo.url, 4);
    for (const duration of [0, -1, Infinity, NaN]) controls.onStyleVideoDurationChange(next.url, duration);
    assert.match(h.render().composer.props.settingsSummary, /9.3s clip/);
    assert.equal(h.render().composer.props.estimatedCredits, 36);
    h.clearGallery();
    controls.onStyleVideoDurationChange(next.url, 8);
    assert.ok(h.render().composer.props.settings.props.children.some(node => node?.type === "WorkflowDurationControl"));
  });
  test(`${format}: Recreate replaces an earlier upload, preserves the appearance image and sends the clicked gallery ID`, async () => {
    const h = harness(format, { captureRequests: true, reference: false });
    const image = { kind: "image", asset: { id: "appearance", url: "https://owned-media.test/person.png", title: "Appearance" } };
    const upload = { kind: "video", asset: { id: "earlier-upload", url: "https://owned-media.test/old.mp4", durationSeconds: 4, title: "Earlier upload" } };
    h.render().composer.props.referenceControls.props.onChange(image, "image");
    h.render().composer.props.referenceControls.props.onChange(upload, "video");
    const gallery = { id: `${format}-clicked`, url: "https://example.test/clicked.mp4", name: "Clicked reference", duration: 7, selectionRevision: 1 };
    h.selectGallery(gallery);
    const composer = h.render().composer;
    assert.equal(composer.props.referenceControls.props.videoSelection, null);
    assert.equal(composer.props.referenceControls.props.styleVideo.url, gallery.url);
    assert.equal(composer.props.referenceControls.props.imageSelection.asset.id, image.asset.id);
    await composer.props.onSubmit({ preventDefault() {} });
    const input = h.requests[0].body;
    assert.equal(input.useGalleryVideoReference, true); assert.equal(input.referenceId, gallery.id);
    assert.equal(input.referenceVideoUrl, null); assert.equal(input.referenceVideoAssetId, null);
    assert.equal(input.referenceImageUrls.length, 1); assert.equal(input.referenceImageUrls[0], image.asset.url);
    h.clearGallery();
    assert.equal(h.render().composer.props.referenceControls.props.videoSelection, null, "Removing gallery guidance must not restore the earlier upload");
  });
  test(`${format}: clicking the same gallery card again replaces a later upload and selects compatible model quality`, async () => {
    const h = harness(format, { reference: false, wanEnabled: true, captureRequests: true });
    const setting = label => h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === label);
    setting("Video model").props.onChange("wan_3_0");
    setting("Video quality").props.onChange("480p");
    setting("Video duration").props.onChange(30);
    const gallery = { id: `${format}-repeat`, url: "https://example.test/repeat.mp4", name: "Repeated reference", duration: 6, selectionRevision: 1 };
    h.selectGallery(gallery);
    assert.equal(setting("Video model").props.value, "google_omni");
    assert.equal(setting("Video quality").props.value, "720p");
    h.render().composer.props.referenceControls.props.onChange({ kind: "video", asset: { id: "new-upload", url: "https://owned-media.test/new.mp4", durationSeconds: 4, title: "New upload" } }, "video");
    h.render();
    h.selectGallery({ ...gallery, selectionRevision: 2 });
    await h.render().composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.referenceId, gallery.id);
    assert.equal(h.requests[0].body.referenceVideoUrl, null);
    assert.equal(h.requests[0].body.resolution, "720p");
    h.clearGallery();
    assert.equal(setting("Video duration").props.value, 5);
  });
  test(`${format}: failed replacement blocks generation using the previous reference until an explicit new selection`, async () => {
    const h = harness(format, { captureRequests: true });
    h.composer.props.referenceControls.props.onErrorChange("Upload failed");
    let composer = h.render().composer;
    assert.equal(composer.props.generateDisabled, true);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests.length, 0);
    h.selectGallery({ id: `${format}-replacement`, url: "https://example.test/replacement.mp4", name: "Replacement", duration: 5, selectionRevision: 1 });
    composer = h.render().composer;
    assert.equal(composer.props.generateDisabled, false);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.referenceId, `${format}-replacement`);
  });
  test(`${format}: pending reference uploads cannot change models and Recreate keeps compatible quality`, () => {
    const h = harness(format, { reference: false, wanEnabled: true });
    const setting = label => h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === label);
    setting("Video quality").props.onChange("1080p");
    h.render().composer.props.referenceControls.props.onPendingChange(true);
    assert.equal(setting("Video model").props.disabled, true);
    setting("Video model").props.onChange("wan_3_0");
    assert.equal(setting("Video model").props.value, "google_omni");
    h.render().composer.props.referenceControls.props.onPendingChange(false);
    h.selectGallery({ id: `${format}-quality`, url: "https://example.test/quality.mp4", name: "Quality", duration: 6 });
    assert.equal(setting("Video quality").props.value, "1080p");
  });
  test(`${format}: plus appends multiple images in the same reference container and submits every selected image`, async () => {
    const h = harness(format, { captureRequests: true });
    const images = Array.from({ length: 3 }, (_, index) => ({ kind: "image", asset: { id: `image-${index}`, url: `https://owned-media.test/image-${index}.png`, title: `Image ${index}` } }));
    for (const image of images) h.render().composer.props.referenceControls.props.onChange(image, "image");
    let controls = h.render().composer.props.referenceControls.props;
    assert.equal(controls.imageSelections.length, 3); assert.equal(controls.maxImages, 5);
    controls.onImagesChange(images.filter(image => image.asset.id !== "image-1"));
    controls = h.render().composer.props.referenceControls.props;
    assert.equal(controls.imageSelections.length, 2); assert.ok(controls.styleVideo);
    await h.render().composer.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(h.requests[0].body.referenceImageUrls, [images[0].asset.url, images[2].asset.url]);
    assert.equal(h.requests[0].body.useGalleryVideoReference, true);
  });
  test(`${format}: custom video is sent as owned generation input in the real generation request`, async () => {
    const h = harness(format, { captureRequests: true });
    h.composer.props.referenceControls.props.onChange({ kind: "video", asset: { url: "https://owned-media.test/clip.mp4", id: "reference-video-id", durationSeconds: 2.8, ratio: "16:9", title: "My clip" } });
    const { composer } = h.render();
    assert.match(composer.props.settingsSummary, /Google Omni.*2.8s clip.*16:9/);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].url, "/api/ai-studio/videos/generate");
    assert.equal(h.requests[0].body.avatarImageUrl, null);
    assert.equal(h.requests[0].body.referenceVideoUrl, "https://owned-media.test/clip.mp4");
    assert.equal(h.requests[0].body.referenceVideoDurationSeconds, 2.8);
    assert.equal(h.requests[0].body.referenceVideoAssetId, "reference-video-id");
    assert.equal(h.requests[0].body.durationSeconds, 3);
    assert.equal(h.requests[0].body.referenceVideoMode, "edit");
    assert.equal(h.requests[0].body.useGalleryVideoReference, false);
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
    assert.equal(h.requests[0].body.useGalleryVideoReference, true);
  });

  for (const order of [["image", "video"], ["video", "image"]]) test(`${format}: both reference selection orders retain and submit the image and video`, async () => {
    const h = harness(format, { captureRequests: true, reference: false });
    const references = {
      image: { kind: "image", asset: { id: "identity", url: "https://owned-media.test/identity.png", title: "Identity" } },
      video: { kind: "video", asset: { id: "source", url: "https://owned-media.test/source.mp4", durationSeconds: 6.25, ratio: "9:16", title: "Source" } },
    };
    for (const kind of order) h.render().composer.props.referenceControls.props.onChange(references[kind], kind);
    const composer = h.render().composer;
    assert.equal(composer.props.referenceControls.props.imageSelection.asset.id, "identity");
    assert.equal(composer.props.referenceControls.props.videoSelection.asset.id, "source");
    assert.equal(composer.props.estimatedCredits, 24);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.referenceImageUrls[0], references.image.asset.url);
    assert.equal(h.requests[0].body.referenceVideoUrl, references.video.asset.url);
    assert.equal(h.requests[0].body.referenceVideoMode, "edit");
    composer.props.referenceControls.props.onChange(null, "image");
    assert.equal(h.render().composer.props.referenceControls.props.videoSelection.asset.id, "source");
    h.render().composer.props.referenceControls.props.onChange(references.image, "image");
    h.render().composer.props.referenceControls.props.onChange(null, "video");
    assert.equal(h.render().composer.props.referenceControls.props.imageSelection.asset.id, "identity");
    assert.equal(h.render().composer.props.referenceControls.props.videoSelection, null);
  });

  test(`${format}: WAN retains a gallery video and uses the chosen output duration instead of edit mode`, async () => {
    const h = harness(format, { wanEnabled: true, captureRequests: true });
    h.render().composer.props.referenceControls.props.onStyleVideoDurationChange("https://example.test/style.mp4", 12);
    const model = h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === "Video model");
    assert.equal(model.props.options.find(option => option.value === "wan_3_0").disabled, false);
    model.props.onChange("wan_3_0");
    let composer = h.render().composer;
    composer.props.settings.props.children.find(node => node?.props?.ariaLabel === "Video duration").props.onChange(3);
    composer = h.render().composer;
    assert.equal(composer.props.referenceControls.props.styleVideo.url, "https://example.test/style.mp4");
    assert.equal(composer.props.estimatedCredits, 12);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.equal(h.requests[0].body.model, "wan_3_0");
    assert.equal(h.requests[0].body.durationSeconds, 3);
    assert.equal(h.requests[0].body.useGalleryVideoReference, true);
    assert.equal(h.requests[0].body.referenceVideoMode, undefined);
  });
  test(`${format}: WAN submits image, video and audio together and preserves them when changing models`, async () => {
    const h = harness(format, { wanEnabled: true, captureRequests: true, reference: false });
    const setting = label => h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === label);
    setting("Video model").props.onChange("wan_3_0");
    const image = { kind: "image", asset: { id: "image", url: "https://owned.test/person.png", title: "Person" } };
    const video = { kind: "video", asset: { id: "video", url: "https://owned.test/motion.mp4", title: "Motion", durationSeconds: 14, fileSizeBytes: 32 * 1024 ** 2 } };
    const audio = { kind: "audio", asset: { id: "audio", url: "https://owned.test/voice.mp3", title: "Voice", durationSeconds: 15, fileSizeBytes: 15 * 1024 ** 2 } };
    for (const ref of [image, video, audio]) h.render().composer.props.referenceControls.props.onChange(ref, ref.kind);
    setting("Video duration").props.onChange(3);
    setting("Video model").props.onChange("google_omni");
    let composer = h.render().composer;
    assert.equal(composer.props.referenceControls.props.audioSelection.asset.id, "audio");
    assert.equal(composer.props.referenceControls.props.videoSelection.asset.id, "video");
    assert.equal(composer.props.generateDisabled, true);
    assert.match(composer.props.accessMessage, /remove the unsupported reference/);
    await composer.props.onSubmit({ preventDefault() {} }); assert.equal(h.requests.length, 0);
    setting("Video model").props.onChange("wan_3_0");
    composer = h.render().composer;
    assert.equal(composer.props.generateDisabled, false);
    await composer.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(h.requests[0].body.referenceImageUrls, [image.asset.url]);
    assert.equal(h.requests[0].body.referenceVideoUrl, video.asset.url);
    assert.deepEqual(h.requests[0].body.referenceAudioUrls, [audio.asset.url]);
    assert.equal(h.requests[0].body.durationSeconds, 3);
    assert.equal(h.requests[0].body.referenceVideoMode, undefined);
  });
  test(`${format}: WAN blocks retained timed references that exceed its duration or upload limit`, async () => {
    for (const patch of [{ durationSeconds: 15.1 }, { fileSizeBytes: 32 * 1024 ** 2 + 1 }]) {
      const h = harness(format, { wanEnabled: true, captureRequests: true, reference: false });
      h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === "Video model").props.onChange("wan_3_0");
      h.render().composer.props.referenceControls.props.onChange({ kind: "video", asset: { id: "long", url: "https://owned.test/long.mp4", durationSeconds: 15, fileSizeBytes: 32 * 1024 ** 2, ...patch } }, "video");
      const composer = h.render().composer;
      assert.equal(composer.props.generateDisabled, true); assert.match(composer.props.accessMessage, /up to (?:15 seconds|32 MB)/);
      await composer.props.onSubmit({ preventDefault() {} }); assert.equal(h.requests.length, 0);
    }
  });
  test(`${format}: adding WAN audio revalidates a retained larger image without removing it`, () => {
    const h = harness(format, { wanEnabled: true, reference: false });
    h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === "Video model").props.onChange("wan_3_0");
    const image = { kind: "image", asset: { id: "larger-image", url: "https://owned.test/large.png", fileSizeBytes: 17 * 1024 ** 2 } };
    h.render().composer.props.referenceControls.props.onChange(image, "image");
    assert.equal(h.render().composer.props.generateDisabled, false);
    h.render().composer.props.referenceControls.props.onChange({ kind: "audio", asset: { id: "audio", url: "https://owned.test/audio.mp3", durationSeconds: 5, fileSizeBytes: 100 } }, "audio");
    let composer = h.render().composer;
    assert.equal(composer.props.referenceControls.props.imageSelection.asset.id, image.asset.id);
    assert.equal(composer.props.generateDisabled, true); assert.match(composer.props.accessMessage, /16 MB/);
    composer.props.referenceControls.props.onChange(null, "audio");
    composer = h.render().composer;
    assert.equal(composer.props.referenceControls.props.imageSelection.asset.id, image.asset.id);
    assert.equal(composer.props.generateDisabled, false);
  });
}

test("Studio retains the complete mixed reference set across model changes and gates failed uploads", async () => {
  const h = harness("studio", { seedanceEnabled: true, wanEnabled: true, captureRequests: true });
  const setting = label => h.render().composer.props.settings.props.children.find(node => node?.props?.ariaLabel === label);
  setting("Video model").props.onChange("seedance_2_5");
  const refs = [0, 1, 2].map(index => ({ kind: "image", asset: { id: `image-${index}`, url: `https://owned.test/${index}.png` } }));
  refs.push({ kind: "video", asset: { id: "video", url: "https://owned.test/source.mp4", durationSeconds: 10, fileSizeBytes: 100 } }, { kind: "audio", asset: { id: "audio", url: "https://owned.test/audio.mp3", durationSeconds: 10, fileSizeBytes: 100 } });
  h.render().composer.props.leadingControl.props.onChange(refs);
  setting("Video model").props.onChange("kling_3_0");
  let composer = h.render().composer;
  assert.equal(composer.props.leadingControl.props.selections.length, 5);
  assert.equal(composer.props.generateDisabled, true);
  await composer.props.onSubmit({ preventDefault() {} }); assert.equal(h.requests.length, 0);
  setting("Video model").props.onChange("wan_3_0");
  composer = h.render().composer;
  assert.deepEqual(Array.from(composer.props.leadingControl.props.allowedKinds), ["image", "video", "audio"]);
  assert.equal(composer.props.leadingControl.props.maxVideoDurationSeconds, 15);
  composer.props.leadingControl.props.onErrorChange("Replacement upload failed");
  composer = h.render().composer;
  assert.equal(composer.props.generateDisabled, true);
  await composer.props.onSubmit({ preventDefault() {} }); assert.equal(h.requests.length, 0);
  composer.props.leadingControl.props.onErrorChange(null);
  composer = h.render().composer;
  await composer.props.onSubmit({ preventDefault() {} });
  assert.equal(h.requests[0].body.referenceImageUrls.length, 3);
  assert.equal(h.requests[0].body.referenceVideoUrl, refs[3].asset.url);
  assert.deepEqual(h.requests[0].body.referenceAudioUrls, [refs[4].asset.url]);
});

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
  const h = harness("slideshow", { captureRequests: true, referenceUrls: urls, slideshowSlideCount: 3 });
  const count = h.composer.props.settings.props.children.find(node => node.props?.ariaLabel === "Number of images");
  assert.equal(count.props.fieldLabel, "Versions");
  count.props.onChange("2");
  await h.render().composer.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.equal(h.requests.length, 1, JSON.stringify(h.errors));
  assert.deepEqual(h.requests[0].body.referenceImageUrls, urls);
  assert.equal(h.requests[0].body.quantity, 2);
  assert.equal(h.requests[0].body.slideshowSlideCount, 3);
  assert.equal(h.requests[0].body.prompt, "My requested changes");
});

test("the rendered Hook, Wall of Text and slideshow selectors submit two or three outputs without normalization to one", async () => {
  for (const format of ["hook", "wall_text", "slideshow"]) for (const quantity of [2, 3]) {
    const h = harness(format, { captureRequests: true, reference: format === "slideshow" });
    const label = format === "slideshow" ? "Number of images" : "Number of videos";
    const select = h.composer.props.settings.props.children.flat(Infinity).find(node => node?.props?.ariaLabel === label);
    assert.ok(select, `${format} quantity selector must be rendered`);
    assert.ok(select.props.options.some(option => option.value === String(quantity)));
    select.props.onChange(String(quantity));
    await h.render().composer.props.onSubmit({ preventDefault() {} });
    await new Promise(setImmediate);
    assert.equal(h.requests.length, 1, JSON.stringify(h.errors));
    assert.equal(h.requests[0].body.quantity, quantity);
  }
});

test("slideshow defaults to Flare and offers Sunburst and Nano Banana", async () => {
  const h = harness("slideshow", { captureRequests: true });
  const settings = [h.composer.props.settings.props.children].flat(Infinity);
  const selector = settings.find(node => node.props?.ariaLabel === "Image model");
  assert.equal(selector.props.value, "gpt_image_2_5_flare");
  assert.deepEqual(Array.from(selector.props.options, option => option.value), ["gpt_image_2_5_flare", "gpt_image_2_5", "nano_banana_2"]);
  await h.composer.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.equal(h.requests.length, 1, JSON.stringify(h.errors));
  assert.equal(h.requests[0].body.model, "gpt_image_2_5_flare");
  assert.equal(h.requests[0].body.referenceImageUrl, "https://example.test/reference.png");
  assert.equal(h.requests[0].body.exploreFormat, "slideshow");
  assert.equal(h.requests[0].body.aspectRatio, "4:5");
});

test("slideshow recreates an existing slide without attachments or a catalogue and sends its own edit-target field", async () => {
  for (const reference of [false, true]) {
    const h = harness("slideshow", { captureRequests: true, reference, regenerationTarget: "existing-slide-id" });
    assert.equal(h.composer.props.generateDisabled, false);
    await h.composer.props.onSubmit({ preventDefault() {} });
    await new Promise(setImmediate);
    assert.equal(h.requests[0].body.regenerationImageAssetId, "existing-slide-id");
    assert.equal(h.requests[0].body.referenceImageAssetId, undefined);
    assert.equal(h.requests[0].body.referenceImageAssetIds, undefined);
  }
});

test("slideshow attachment order stays separate from style references and an overlapping edit target", async () => {
  const urls = ["https://example.test/reference.png", "https://example.test/style-2.png"];
  const h = harness("slideshow", { captureRequests: true, referenceUrls: urls, regenerationTarget: "existing-slide-id" });
  h.composer.props.promptAttachmentControl.props.onChange([
    { kind: "image", asset: { id: "existing-slide-id", url: "https://owned.test/slide.png" } },
    { kind: "image", asset: { id: "product-id", url: "https://owned.test/product.png" } },
  ]);
  await h.render().composer.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(h.requests[0].body.referenceImageUrls, urls);
  assert.deepEqual(h.requests[0].body.referenceImageAssetIds, ["existing-slide-id", "product-id"]);
  assert.equal(h.requests[0].body.regenerationImageAssetId, "existing-slide-id");
});
