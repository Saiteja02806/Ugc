import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as drafts from "../lib/explore/hook-keyframe-draft.ts";
import * as motions from "../lib/explore/hook-keyframe-motion.ts";
import * as imagePrompts from "../lib/explore/hook-keyframe-image-prompt.ts";
import * as promptPreviews from "../lib/explore/hook-keyframe-prompt-preview.ts";
import * as keyframeClient from "../lib/explore/hook-keyframe-client.ts";
import * as variationClient from "../lib/explore/hook-keyframe-variations.ts";
import * as statusPolling from "../lib/explore/hook-starting-image-polling.ts";
import * as curatedFrames from "../worker/src/lib/hook-curated-frames.ts";

const draftId = "00000000-0000-4000-8000-000000000001";
const photoId = "00000000-0000-4000-8000-000000000002";
const secondId = "00000000-0000-4000-8000-000000000003";
const referenceId = "explore-paired-hook-ef59f4b5e69bc9e125f8ada7";
const sha = motions.hookKeyframeMotionCatalog[referenceId].sourceSha256;
const scope = { ownerId: "owner", draftId, referenceId, sourceSha256: sha };
const photo = id => ({ kind: "image", asset: { id, url: `https://media.example.test/${id}.png`,
  status: "ready", collection: "image", sourceType: "generated_image", mimeType: "image/png", metadata: {} } });
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" || typeof tree === "number" ? String(tree) : ""; }
function harness({ presentation = "dialog", preparationFormat = "hook", frameWidth = 720, frameHeight = 1280, raw = null, sourceHash = sha, ownerId = "owner", frameError = null, submitError = false, failureAt = 1, rejectionAt = null, token = "fixture-token", previewRuntime, motionBlocked = false, previewState = "ready" } = {}) {
  const stored = new Map(), effects = [], slots = [], queries = [], fetched = [], urls = [], revoked = [], errors = [];
  let cursor = 0, closed = 0, uuidIndex = 43;
  const jobs = new Map();
  const submissions = [], selections = [];
  const key = drafts.hookKeyframeDraftStorageKey(ownerId, draftId, referenceId);
  if (raw) stored.set(key, raw);
  const storage = { getItem: id => stored.get(id) ?? null, setItem: (id, value) => stored.set(id, value), removeItem: id => stored.delete(id) };
  const frameData = frameError ? undefined : { referenceId, sourceSha256: sourceHash, frame: { index: 0, timeSeconds: 0, width: frameWidth, height: frameHeight, sha256: "b".repeat(64) }, blob: new Blob(["frame"]) };
  const historyData = { pages: [{ images: [{ mediaAssetId: secondId, jobId: "saved-influencer" }], nextCursor: null }] };
  const element = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const imports = {
    "@/worker/src/lib/hook-curated-frames": curatedFrames,
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
    react: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
        return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
      useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
      useCallback(fn) { return fn; },
      useMemo(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((x, n) => !Object.is(x, previous.deps[n]))) slots[i] = { deps, value: fn() }; return slots[i].value; },
      useEffect(fn, deps) { const i = cursor++, previous = slots[i];
        if (!previous || deps.some((x, n) => !Object.is(x, previous.deps[n]))) { const next = { deps }; slots[i] = next; effects.push(() => { previous?.cleanup?.(); next.cleanup = fn(); }); } },
    },
    "@tanstack/react-query": {
      useQuery(options) {
        queries.push(options);
        const name = options.queryKey[0];
        return { data: name === "hook-source-frame-v3" ? frameData : name === "hook-starting-image-cost" ? 1 : undefined,
          isPending: false, error: name === "hook-source-frame-v3" ? frameError : null, refetch: () => {}, isFetching: false };
      },
      useQueries({ queries: batchQueries }) {
        return batchQueries.map(options => {
          queries.push(options);
          return { data: options.enabled ? jobs.get(options.queryKey[4]) : undefined, error: null, isFetching: false, refetch: async () => {} };
        });
      },
      useInfiniteQuery: options => { queries.push(options); return { data: historyData, isPending: false, error: null, refetch() {}, hasNextPage: false }; },
    },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async id => { fetched.push(id); return { ...photo(id).asset, collection: "influencer" }; } },
    "@/lib/characters/history": { mergeCharacterHistoryPages: pages => pages.flatMap(page => page.images) },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => typeof token === "function" ? token() : token },
    "@/lib/http/read-deadline": { withReadDeadline: fn => fn(new AbortController().signal) },
    "@/lib/explore/hook-keyframe-draft": drafts,
    "@/lib/explore/hook-keyframe-motion": motions,
    "@/lib/explore/hook-keyframe-image-prompt": imagePrompts,
    "@/lib/explore/hook-keyframe-prompt-preview": { getHookKeyframePromptPreview: (draft, format) => ({ ...promptPreviews.getHookKeyframePromptPreview(draft, format), ...(motionBlocked ? { requiresDecision: true } : {}) }) },
    "@/lib/explore/hook-keyframe-client": keyframeClient,
    "@/lib/explore/hook-keyframe-variations": variationClient,
    "@/lib/explore/hook-starting-image-polling": statusPolling,
    "@/lib/explore/hook-starting-frame-client": { hookSourceSha256: () => sourceHash, fetchHookStartingFrame: async () => assert.fail("Query does not infer media") },
  };
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/hook-starting-frame-workspace.tsx", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, localStorage: storage, queueMicrotask, AbortController, AbortSignal, Response, process: { env: { NODE_ENV: previewRuntime ? "development" : "test" } }, console,
    navigator: { locks: { request: async (_name, _options, callback) => callback() } }, crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuidIndex).padStart(12, "0")}` }, URL: class extends URL {
    static createObjectURL() { const url = `blob:fixture-${urls.length}`; urls.push(url); return url; } static revokeObjectURL(url) { revoked.push(url); }
  }, require(name) {
    if (name in imports) return imports[name];
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    if (name.endsWith(".module.css")) return { default: {} };
    throw Error(`Unexpected import ${name}`);
  }, fetch: async (url, options) => {
    assert.equal(url, "/api/explore/hook-keyframe"); assert.equal(options.method, "POST");
    const saved = keyframeClient.readHookKeyframeCheckpoint(stored.get(keyframeClient.hookKeyframeCheckpointKey(scope)), scope);
    assert.ok(saved, "request is persisted before submission");
    submissions.push(JSON.parse(options.body));
    if (submitError && submissions.length === failureAt) throw new Error("Unconfirmed connection");
    if (submissions.length === rejectionAt) return Response.json({ ok: false, message: "Insufficient credits." }, { status: 402 });
    const frozenInput = JSON.parse(saved.inputKey);
    return Response.json({ ok: true, jobId: `00000000-0000-4000-8000-${String(500 + submissions.length).padStart(12, "0")}`, generationId: photoId,
      receipt: { ...scope, version: frozenInput.version, imageModel: frozenInput.imageModel, promptVersion: 2, purpose: "hook_starting_frame", inputKey: saved.inputKey } }, { status: 202 });
  } });
  return { stored, key, fetched, queries, urls, revoked, errors, submissions, selections, previewStatus(value) { previewState = value; }, setJob(value) { jobs.set(value.id, value); }, closed: () => closed,
    restoreStore(other) { for (const [key, value] of other.stored) stored.set(key, value); for (const query of other.queries) {
      if (query.queryKey[0] === "hook-starting-image-job") { const value = other.jobFor(query.queryKey[4]); if (value) jobs.set(value.id, value); }
    } },
    jobFor(id) { return jobs.get(id); },
    render() { cursor = 0; const tree = exports.HookStartingFrameWorkspace({ presentation, preparationFormat, ownerId, draftId, previewRuntime,
      reference: { id: referenceId, title: "Hook 2", videoUrl: `https://media.example.test/${sourceHash}.mp4` }, onClose: () => closed++, onUseStartingFrame: value => selections.push(value) });
      for (const image of nodes(tree).filter(node => node.type === "img")) if (image.props.ref) image.props.ref.current = { src: "", removeAttribute() {} };
      for (const effect of effects.splice(0)) effect();
      for (const image of nodes(tree).filter(node => node.type === "StartingFrameImage")) image.props.onStateChange(image.props.assetId, image.props.url, previewState);
      cursor = 0; return exports.HookStartingFrameWorkspace({ presentation, preparationFormat, ownerId, draftId, previewRuntime, reference: { id: referenceId, title: "Hook 2", videoUrl: `https://media.example.test/${sourceHash}.mp4` }, onClose: () => closed++, onUseStartingFrame: value => selections.push(value) }); },
    async settle() { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); },
  };
}
function find(tree, type) { return nodes(tree).find(node => node.type === type); }
function button(tree, label) { return nodes(tree).find(node => node.type === "Button" && (node.props?.["aria-label"] === label || text(node).trim() === label)); }

test("Talking Head and Wall reuse approval controls with workflow-specific guidance and shape admission", async () => {
  for (const preparationFormat of ["talking_head", "wall_text"]) {
    const h = harness({ presentation: "recreation", preparationFormat }); h.render(); await h.settle();
    let tree = h.render();
    assert.equal(button(tree, "Use selected frame"), undefined, "Approval appears after a submitted result exists");
    assert.match(text(tree), preparationFormat === "talking_head" ? /own spoken script and Sound setting/ : /editable overlay text in Edit/);
    find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId)]); tree = h.render();
    assert.equal(button(tree, "Generate starting image").props.disabled, false);
    assert.equal(h.submissions.length, 0, "Opening and choosing a person never generates automatically");
    const square = harness({ presentation: "recreation", preparationFormat, frameWidth: 1024, frameHeight: 1024 });
    square.render(); await square.settle(); tree = square.render();
    find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId)]); tree = square.render();
    assert.equal(button(tree, "Generate starting image").props.disabled, true);
    assert.match(text(tree), /Choose a 9:16 or 16:9 reference/);
  }
});

test("source-only local preview cannot submit an image or create a fake generation checkpoint", async () => {
  const h = harness({ previewRuntime: { generationDisabledReason: "Sign in to generate starting images." } });
  h.render(); await h.settle(); const tree = h.render();
  assert.equal(h.queries.filter(query => query.queryKey[0] === "hook-starting-image-cost").every(query => !query.enabled), true);
  const generate = button(tree, "Generate starting image"); assert.equal(generate.props.disabled, true);
  await generate.props.onClick(); await h.settle();
  assert.equal(h.submissions.length, 0);
  assert.equal([...h.stored.keys()].some(key => key.includes("hook-frame-job") || key.includes("hook-frame-variations")), false);
  assert.match(text(tree), /Sign in to generate starting images/);
});

test("opening preparation shows the actual frame and separate inputs without automatically submitting generation", async () => {
  const h = harness(); h.render(); await h.settle(); const tree = h.render();
  assert.match(text(tree), /Create your starting frame/); assert.match(text(tree), /Source frame/); assert.match(text(tree), /Face reference/);
  assert.equal(nodes(tree).some(node => node.props?.role === "switch"), false);
  assert.doesNotMatch(text(tree), /Video settings|Review animation instructions/);
  assert.equal(button(tree, "Generate starting image").props.disabled, true);
  assert.equal(h.submissions.length, 0);
  assert.equal(button(tree, "Save preparation").props.disabled, true);
  assert.equal(nodes(tree).some(node => node.type === "video"), false);
  assert.equal(h.queries[0].retry, false); assert.equal(h.queries[0].queryKey[1], "owner");
  assert.equal(h.urls.length, 1); assert.equal(find(tree, "img").props.alt, "Selected source frame of Hook 2");
  assert.equal(find(tree, "img").props.src, "blob:fixture-0", "the frame URL is rendered declaratively and survives later renders");
  const picker = find(tree, "FormatGenerationReferences").props;
  assert.equal(picker.imagePurpose, "person"); assert.equal(picker.videoInputEnabled, false); assert.equal(picker.audioInputEnabled, false);
  assert.equal(picker.ownerId, "owner"); assert.equal(picker.maxImages, 5);
  assert.equal(picker.imagePresentation, "person-strip");
  assert.equal(picker.inlineImagePicker, true);
  assert.ok(picker.influencerLibrary);
  assert.equal(nodes(tree).some(node => node.type === "SavedInfluencerPicker"), false);
  assert.match(text(tree), /Variations/);
  assert.equal(h.errors.length, 0);
});

test("batch upload completion is accepted while the picker is pending and saved main/support order is exact", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onPendingChange(true); tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId), photo(secondId)]);
  find(tree, "FormatGenerationReferences").props.onPendingChange(false); tree = h.render();
  assert.equal(button(tree, "Save preparation").props.disabled, false);
  button(tree, "Save preparation").props.onClick();
  const saved = drafts.readHookKeyframeDraft(h.stored.get(h.key), scope);
  assert.deepEqual(saved.imageAssetIds, [photoId, secondId]); assert.equal(saved.generateAudio, false);
  assert.equal(saved.approval, null); assert.equal(saved.generatedImage, null); assert.equal(saved.sourceFrame.index, 0);
  assert.doesNotMatch(h.stored.get(h.key), /https:|blob:/);
});

test("restoration resolves the owned photo IDs again and the builder preserves this preparation in another tab", async () => {
  const d = drafts.updateHookKeyframeDraft(drafts.createHookKeyframeDraft(scope), { imageAssetIds: [photoId], instructions: "Keep the surprised look." });
  const h = harness({ raw: drafts.serializeHookKeyframeDraft(d) }); h.render(); await h.settle(); const tree = h.render();
  assert.deepEqual(h.fetched, [photoId]);
  assert.equal(nodes(tree).find(node => node.type === "textarea" && node.props["aria-label"] !== "Animation instructions").props.value, "Keep the surprised look.");
  assert.equal(find(tree, "FormatGenerationReferences").props.imageSelections[0].asset.id, photoId);
  const builder = nodes(tree).find(node => node.type === "a" && node.props.href === "/explore/build-character");
  assert.equal(builder.props.target, "_blank"); assert.match(builder.props.rel, /noopener/);
});

test("a different saved influencer clears the previous person's supporting photos", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId), photo(secondId)]); tree = h.render();
  await find(tree, "FormatGenerationReferences").props.influencerLibrary.onSelect({ mediaAssetId: secondId }); await h.settle(); tree = h.render();
  assert.deepEqual(Array.from(find(tree, "FormatGenerationReferences").props.imageSelections, x => x.asset.id), [secondId]);
  assert.deepEqual(drafts.readHookKeyframeDraft(h.stored.get(h.key), scope).imageAssetIds, [secondId]);
});

test("saved influencer previews load for the owner without opening a history drawer", async () => {
  const h = harness(); h.render(); await h.settle(); const tree = h.render();
  const query = h.queries.filter(q => q.queryKey[0] === "hook-influencer-history").at(-1);
  assert.equal(query.enabled, true); assert.equal(query.queryKey[1], "owner");
  const picker = find(tree, "FormatGenerationReferences").props.influencerLibrary;
  assert.equal(picker.images[0].mediaAssetId, secondId);
  assert.equal(h.submissions.length, 0);
  assert.equal(nodes(tree).some(node => node.type === "CharacterHistory"), false);
});

test("failed saved-face admission retains the chosen main photo and supporting views", async () => {
  const h = harness({ token: null }); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId), photo(secondId)]); tree = h.render();
  assert.equal(await find(tree, "FormatGenerationReferences").props.influencerLibrary.onSelect({ mediaAssetId: secondId }), false); await h.settle(); tree = h.render();
  assert.deepEqual(Array.from(find(tree, "FormatGenerationReferences").props.imageSelections, x => x.asset.id), [photoId, secondId]);
  assert.match(find(tree, "FormatGenerationReferences").props.influencerLibrary.selectionError, /Sign in/);
  assert.equal(h.submissions.length, 0);
});

test("reselecting the current saved main photo retains its supporting views", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId), photo(secondId)]); tree = h.render();
  assert.equal(await find(tree, "FormatGenerationReferences").props.influencerLibrary.onSelect({ mediaAssetId: photoId }), true); await h.settle(); tree = h.render();
  assert.deepEqual(Array.from(find(tree, "FormatGenerationReferences").props.imageSelections, x => x.asset.id), [photoId, secondId]);
  assert.equal(h.fetched.length, 0); assert.equal(h.submissions.length, 0);
});

test("changed canonical source blocks restoration and does not overwrite the saved draft until explicitly reset", async () => {
  const raw = drafts.serializeHookKeyframeDraft(drafts.createHookKeyframeDraft(scope));
  const h = harness({ raw, sourceHash: "c".repeat(64) }); h.render(); await h.settle(); const tree = h.render();
  assert.match(text(tree), /saved preparation has not been overwritten/); assert.equal(h.stored.get(h.key), raw);
  assert.equal(button(tree, "Save preparation").props.disabled, true);
  button(tree, "Start a new preparation").props.onClick(); h.render();
  assert.equal(JSON.parse(h.stored.get(h.key)).scope.sourceSha256, "c".repeat(64));
});

test("image-only popup preserves saved video preferences for the later handoff", async () => {
  const directions = "Blink naturally, widen the eyes and hold the gaze.";
  const draft = drafts.updateHookKeyframeDraft(drafts.createHookKeyframeDraft(scope), { imageAssetIds: [photoId], motionInstructions: directions, generateAudio: true });
  const h = harness({ raw: drafts.serializeHookKeyframeDraft(draft) }); h.render(); await h.settle(); let tree = h.render();
  assert.doesNotMatch(text(tree), /Video settings|Sound on|Review animation instructions|Actions, expression and camera/);
  assert.equal(nodes(tree).filter(node => node.type === "textarea").length, 1);
  button(tree, "Generate starting image").props.onClick(); await h.settle(); completeImage(h); tree = h.render();
  button(tree, "Use as starting frame").props.onClick();
  assert.equal(h.selections[0].motionInstructions, directions);
  assert.equal(h.selections[0].generateAudio, true);
  assert.equal(h.submissions.length, 1);
});

test("partial upload warnings allow accepted person photos to be saved", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  const picker = find(tree, "FormatGenerationReferences").props;
  picker.onPendingChange(true);
  picker.onImagesChange([photo(photoId)]);
  picker.onErrorChange("1 added. The other image could not be uploaded.");
  picker.onPendingChange(false);
  tree = h.render();
  assert.match(text(tree), /1 added/);
  assert.equal(button(tree, "Save preparation").props.disabled, false);
  button(tree, "Save preparation").props.onClick();
  assert.deepEqual(drafts.readHookKeyframeDraft(h.stored.get(h.key), scope).imageAssetIds, [photoId]);
});

test("dismissal stays responsive while an upload is pending", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onPendingChange(true);
  tree = h.render();
  assert.equal(button(tree, "Save preparation").props.disabled, true);
  find(tree, "Dialog").props.onOpenChange(false);
  assert.equal(h.closed(), 1);
  assert.equal(h.errors.length, 0);
});

async function prepareImageRequest(h) {
  h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId), photo(secondId)]);
  tree = h.render();
  button(tree, "Generate starting image").props.onClick(); await h.settle(); tree = h.render();
  return tree;
}
function completeImage(h) {
  const checkpoint = keyframeClient.readHookKeyframeCheckpoint(h.stored.get(keyframeClient.hookKeyframeCheckpointKey(scope)), scope);
  const frozenInput = JSON.parse(checkpoint.inputKey);
  const job = { id: checkpoint.jobId, status: "completed", isTerminal: true, error: null,
    receipt: { ...scope, version: frozenInput.version, imageModel: frozenInput.imageModel, promptVersion: 2, purpose: "hook_starting_frame", inputKey: checkpoint.inputKey },
    output: { mediaAssetId: "00000000-0000-4000-8000-000000000046", url: "https://media.example.test/starting-frame.png", width: 720, height: 1280 } };
  h.setJob(job); return { checkpoint, job };
}
test("explicit image generation freezes person order, and approval hands off a starting frame without generating a video", async () => {
  const h = harness(); await prepareImageRequest(h);
  assert.equal(h.submissions.length, 1);
  assert.deepEqual(h.submissions[0].personImageAssetIds, [photoId, secondId]);
  assert.equal(h.submissions[0].referenceId, referenceId);
  assert.equal(h.submissions[0].sourceSha256, sha);
  assert.equal(h.submissions[0].imageModel, "gemini_3_pro");
  const { job } = completeImage(h); const tree = h.render();
  assert.equal(button(tree, "Use as starting frame").props.disabled, false);
  button(tree, "Use as starting frame").props.onClick();
  assert.equal(h.submissions.length, 1); assert.equal(h.selections.length, 1);
  const selected = h.selections[0];
  assert.equal(selected.assetId, job.output.mediaAssetId); assert.equal(selected.jobId, job.id);
  assert.equal(selected.generateAudio, false); assert.equal(selected.durationSeconds, 4);
  assert.equal("videoUrl" in selected, false); assert.equal("personImageAssetIds" in selected, false);
  assert.match(selected.motionInstructions, /OPENING STATE/);
  assert.equal(drafts.readHookKeyframeDraft(h.stored.get(h.key), scope).approval.assetId, job.output.mediaAssetId);
});
test("changing image inputs prevents use of a previously generated image", async () => {
  const h = harness(); await prepareImageRequest(h); completeImage(h); let tree = h.render();
  const imageInstructions = nodes(tree).find(node => node.type === "textarea" && !node.props["aria-label"]);
  imageInstructions.props.onChange({ target: { value: "Change the expression." } }); tree = h.render();
  assert.equal(button(tree, "Use as starting frame").props.disabled, true);
  assert.match(text(tree), /photos, model or image instructions have changed/);
  assert.equal(h.selections.length, 0);
});
test("uncertain image submission preserves recovery identity and blocks a second paid submission", async () => {
  const h = harness({ submitError: true }); let tree = await prepareImageRequest(h);
  assert.equal(h.submissions.length, 1);
  const checkpoint = keyframeClient.readHookKeyframeCheckpoint(h.stored.get(keyframeClient.hookKeyframeCheckpointKey(scope)), scope);
  assert.ok(checkpoint); assert.equal(checkpoint.jobId, null);
  assert.match(text(tree), /image request is unconfirmed/);
  assert.equal(button(tree, "Generate starting image").props.disabled, true);
  button(tree, "Generate starting image").props.onClick(); await h.settle(); tree = h.render();
  assert.equal(h.submissions.length, 1);
  assert.equal(button(tree, "Check image status").props.disabled, false);
});
test("client result verification rejects failed jobs, mismatched receipt and credential-bearing URLs", () => {
  const checkpoint = keyframeClient.createHookKeyframeCheckpoint(drafts.createHookKeyframeDraft(scope), draftId);
  const job = { id: photoId, status: "completed", isTerminal: true, error: null,
    receipt: { ...scope, version: 2, imageModel: "gemini_3_pro", promptVersion: 2, purpose: "hook_starting_frame", inputKey: checkpoint.inputKey },
    output: { mediaAssetId: secondId, url: "https://media.example.test/result.png", width: 720, height: 1280 } };
  assert.equal(keyframeClient.verifiedHookKeyframeJob(job, checkpoint), job);
  assert.throws(() => keyframeClient.verifiedHookKeyframeJob({ ...job, status: "failed" }, checkpoint));
  assert.throws(() => keyframeClient.verifiedHookKeyframeJob({ ...job, receipt: { ...job.receipt, ownerId: "other" } }, checkpoint));
  assert.throws(() => keyframeClient.verifiedHookKeyframeJob({ ...job, output: { ...job.output, url: "https://user:pass@media.example.test/result.png" } }, checkpoint));
});

test("model selection preserves photos, enforces the selected cap and binds the submitted request", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  const model = () => nodes(tree).find(node => node.type === "AiStudioSettingSelect" && node.props.ariaLabel === "Starting image model");
  assert.equal(model().props.value, "gemini_3_pro");
  const photos = [photoId, secondId, ...[4, 5, 6].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`)].map(photo);
  find(tree, "FormatGenerationReferences").props.onImagesChange(photos); tree = h.render();
  model().props.onChange("nano_banana_2"); tree = h.render();
  assert.equal(find(tree, "FormatGenerationReferences").props.maxImages, 4);
  assert.equal(find(tree, "FormatGenerationReferences").props.imageSelections.length, 5);
  assert.equal(button(tree, "Generate starting image").props.disabled, true);
  assert.match(text(tree), /Remove an extra photo or choose Gemini 3 Pro/);
  assert.equal(h.submissions.length, 0);
  model().props.onChange("gemini_3_pro"); tree = h.render();
  assert.equal(button(tree, "Generate starting image").props.disabled, false);
  button(tree, "Generate starting image").props.onClick(); await h.settle(); tree = h.render();
  assert.equal(h.submissions.length, 1); assert.equal(h.submissions[0].imageModel, "gemini_3_pro");
  assert.deepEqual(h.submissions[0].personImageAssetIds, photos.map(item => item.asset.id));
  assert.ok(h.queries.some(q => q.queryKey[0] === "hook-starting-image-cost" && q.queryKey[2] === "nano_banana_2"));
});

test("changing the selected model invalidates approval of a completed image", async () => {
  const h = harness(); await prepareImageRequest(h); completeImage(h); let tree = h.render();
  assert.equal(button(tree, "Use as starting frame").props.disabled, false);
  nodes(tree).find(node => node.type === "AiStudioSettingSelect").props.onChange("nano_banana_2"); tree = h.render();
  assert.equal(button(tree, "Use as starting frame").props.disabled, true);
  assert.match(text(tree), /photos, model or image instructions have changed/);
  assert.equal(h.selections.length, 0); assert.equal(h.submissions.length, 1);
});

test("a new submission from a restored legacy draft upgrades to an explicit Flash request", async () => {
  const legacy = { ...drafts.createHookKeyframeDraft(scope), version: 1, imageModel: "nano_banana_2", imageAssetIds: [photoId] };
  const h = harness({ raw: drafts.serializeHookKeyframeDraft(legacy) }); h.render(); await h.settle(); let tree = h.render();
  assert.equal(nodes(tree).find(node => node.type === "AiStudioSettingSelect").props.value, "nano_banana_2");
  button(tree, "Generate starting image").props.onClick(); await h.settle(); tree = h.render();
  assert.equal(h.submissions.length, 1); assert.equal(h.submissions[0].imageModel, "nano_banana_2");
  const checkpoint = keyframeClient.readHookKeyframeCheckpoint(h.stored.get(keyframeClient.hookKeyframeCheckpointKey(scope)), scope);
  assert.equal(JSON.parse(checkpoint.inputKey).version, 2);
  assert.equal(drafts.readHookKeyframeDraft(h.stored.get(h.key), scope).version, 2);
});

test("a completed legacy image remains usable even when its old photo count exceeds the new Flash limit", async () => {
  const ids = [photoId, secondId, ...[4, 5, 6].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`)];
  const legacy = { ...drafts.createHookKeyframeDraft(scope), version: 1, imageModel: "nano_banana_2", imageAssetIds: ids,
    sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } };
  const h = harness({ raw: drafts.serializeHookKeyframeDraft(legacy) });
  const checkpoint = keyframeClient.createHookKeyframeCheckpoint(legacy, draftId);
  checkpoint.jobId = "00000000-0000-4000-8000-000000000045";
  h.stored.set(keyframeClient.hookKeyframeCheckpointKey(scope), JSON.stringify(checkpoint));
  h.setJob({ id: checkpoint.jobId, status: "completed", isTerminal: true, error: null,
    receipt: { ...scope, version: 1, purpose: "hook_starting_frame", inputKey: checkpoint.inputKey },
    output: { mediaAssetId: "00000000-0000-4000-8000-000000000046", url: "https://media.example.test/old-frame.png", width: 720, height: 1280 } });
  h.render(); await h.settle(); const tree = h.render();
  assert.equal(button(tree, "Generate another starting image").props.disabled, true);
  assert.equal(button(tree, "Use as starting frame").props.disabled, false);
  button(tree, "Use as starting frame").props.onClick();
  assert.equal(h.selections.length, 1); assert.equal(h.submissions.length, 0);
});

async function prepareVariations(h, count) {
  h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId), photo(secondId)]); tree = h.render();
  nodes(tree).find(node => node.props?.["aria-label"] === "Number of starting frame variations").props.onChange({ target: { value: String(count) } });
  tree = h.render();
  assert.match(text(tree), new RegExp(`${count} ${count === 1 ? "credit" : "credits"} total`));
  button(tree, count === 1 ? "Generate starting image" : `Generate ${count} starting images`).props.onClick(); await h.settle(); return h.render();
}
function completeVariations(h) {
  const store = variationClient.readHookKeyframeVariations(h.stored.get(variationClient.hookKeyframeVariationsKey(scope)), scope);
  return store.entries.filter(entry => entry.state === "accepted").map((entry, index) => {
    const frozen = JSON.parse(entry.checkpoint.inputKey);
    const job = { id: entry.checkpoint.jobId, status: "completed", isTerminal: true, error: null,
      receipt: { ...scope, version: frozen.version, imageModel: frozen.imageModel, promptVersion: 2, purpose: "hook_starting_frame", inputKey: entry.checkpoint.inputKey },
      output: { mediaAssetId: `00000000-0000-4000-8000-${String(700 + index).padStart(12, "0")}`, url: `https://media.example.test/variation-${index}.png`, width: 720, height: 1280 } };
    h.setJob(job); return job;
  });
}
test("four-image choice displays total credits, submits four unique requests and hands off only the chosen result", async () => {
  const h = harness(); await prepareVariations(h, 4);
  assert.equal(h.submissions.length, 4);
  assert.equal(new Set(h.submissions.map(input => input.idempotencyKey)).size, 4);
  assert.ok(h.submissions.every(input => input.imageModel === "gemini_3_pro" && input.personImageAssetIds.join() === [photoId, secondId].join()));
  const jobs = completeVariations(h); let tree = h.render(); await h.settle(); tree = h.render();
  assert.match(text(tree), /4\s+of\s+4\s+ready/);
  const third = nodes(tree).find(node => node.props?.["aria-label"] === "View starting image 3");
  third.props.onClick(); await h.settle(); tree = h.render();
  assert.equal(nodes(tree).find(node => node.props?.["aria-label"] === "View starting image 3").props["aria-pressed"], true);
  assert.equal(nodes(tree).find(node => node.props?.alt === "Generated starting frame to review before animation").props.url, jobs[2].output.url);
  button(tree, "Use as starting frame").props.onClick();
  assert.equal(h.selections[0].assetId, jobs[2].output.mediaAssetId);
  assert.equal(h.selections[0].jobId, jobs[2].id); assert.equal(h.submissions.length, 4);
});
test("uncertain second variation stops remaining plans and survives reopen without creating more requests", async () => {
  const h = harness({ submitError: true, failureAt: 2 }); let tree = await prepareVariations(h, 4);
  assert.equal(h.submissions.length, 2);
  const stored = variationClient.readHookKeyframeVariations(h.stored.get(variationClient.hookKeyframeVariationsKey(scope)), scope);
  assert.deepEqual(stored.entries.map(entry => entry.state), ["accepted", "submitting", "planned", "planned"]);
  assert.equal(button(tree, "Generate 4 starting images").props.disabled, true);
  const reopened = harness(); reopened.restoreStore(h); reopened.render(); await reopened.settle(); tree = reopened.render();
  assert.equal(reopened.submissions.length, 0);
  assert.equal(button(tree, "Generate starting image").props.disabled, true);
  assert.match(text(tree), /will not retry automatically/);
});
test("second variation admission rejection preserves the first result and never submits remaining images", async () => {
  const h = harness({ rejectionAt: 2 }); await prepareVariations(h, 4);
  assert.equal(h.submissions.length, 2);
  const stored = variationClient.readHookKeyframeVariations(h.stored.get(variationClient.hookKeyframeVariationsKey(scope)), scope);
  assert.deepEqual(stored.entries.map(entry => entry.state), ["accepted", "rejected", "planned", "planned"]);
  const jobs = completeVariations(h); let tree = h.render(); await h.settle(); tree = h.render();
  button(tree, "Use as starting frame").props.onClick(); assert.equal(h.selections[0].assetId, jobs[0].output.mediaAssetId);
});
test("a changed cross-tab variation revision blocks new submission", async () => {
  const h = harness(); await prepareVariations(h, 2); completeVariations(h); h.render(); await h.settle(); let tree = h.render();
  const storeKey = variationClient.hookKeyframeVariationsKey(scope);
  const stored = variationClient.readHookKeyframeVariations(h.stored.get(storeKey), scope);
  h.stored.set(storeKey, JSON.stringify(variationClient.selectHookKeyframeVariation(stored, stored.entries[1].checkpoint.requestKey)));
  button(tree, "Generate 2 starting images").props.onClick(); await h.settle(); tree = h.render();
  assert.equal(h.submissions.length, 2); assert.match(text(tree), /Another tab has changed/);
});
test("authentication failure leaves only unsubmitted plans and permits an explicit later attempt", async () => {
  const h = harness({ token: null }); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId)]); tree = h.render();
  button(tree, "Generate starting image").props.onClick(); await h.settle(); tree = h.render();
  assert.equal(h.submissions.length, 0);
  const stored = variationClient.readHookKeyframeVariations(h.stored.get(variationClient.hookKeyframeVariationsKey(scope)), scope);
  assert.deepEqual(stored.entries.map(entry => entry.state), ["planned"]);
  assert.equal(button(tree, "Generate starting image").props.disabled, false);
  assert.match(text(tree), /No new image was submitted/);
});
test("closing while authentication is pending prevents all not-yet-submitted variations", async () => {
  let finishAuth;
  const pendingAuth = new Promise(resolve => { finishAuth = resolve; });
  const h = harness({ token: () => pendingAuth }); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId)]); tree = h.render();
  button(tree, "Generate starting image").props.onClick(); await h.settle(); tree = h.render();
  find(tree, "Dialog").props.onOpenChange(false); finishAuth("fixture-token"); await h.settle();
  assert.equal(h.closed(), 1); assert.equal(h.submissions.length, 0);
  const stored = variationClient.readHookKeyframeVariations(h.stored.get(variationClient.hookKeyframeVariationsKey(scope)), scope);
  assert.deepEqual(stored.entries.map(entry => entry.state), ["planned"]);
});

test("source and generated previews enlarge without selecting an image or submitting generation", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  const trigger = { focus() {} };
  nodes(tree).find(node => node.props?.["aria-label"] === "Enlarge source frame").props.onClick({ currentTarget: trigger }); tree = h.render();
  let zoom = nodes(tree).filter(node => node.type === "Dialog").at(-1);
  assert.equal(zoom.props.open, true);
  assert.equal(nodes(zoom).find(node => node.type === "img").props.src, "blob:fixture-0");
  assert.equal(nodes(zoom).find(node => node.type === "DialogContent").props.finalFocus.current, trigger);
  assert.equal(h.submissions.length, 0); assert.equal(h.selections.length, 0);
  zoom.props.onOpenChange(false); tree = h.render();
  assert.equal(nodes(tree).filter(node => node.type === "Dialog").at(-1).props.open, false); assert.equal(h.closed(), 0);
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId)]); tree = h.render();
  button(tree, "Generate starting image").props.onClick(); await h.settle(); const { job } = completeImage(h); tree = h.render();
  nodes(tree).find(node => node.props?.["aria-label"] === "Enlarge generated starting image").props.onClick({ currentTarget: trigger }); tree = h.render();
  zoom = nodes(tree).filter(node => node.type === "Dialog").at(-1);
  assert.equal(nodes(zoom).find(node => node.type === "img").props.src, job.output.url);
  assert.equal(h.submissions.length, 1); assert.equal(h.selections.length, 0);
  assert.equal(drafts.readHookKeyframeDraft(h.stored.get(h.key), scope).approval, null);
});
test("variation choices precede approval in the rendered review flow", async () => {
  const h = harness(); await prepareVariations(h, 4); completeVariations(h); let tree = h.render(); await h.settle(); tree = h.render();
  const generated = nodes(tree).find(node => node.type === "section" && node.props["aria-label"] === "Generated starting image");
  const children = nodes(generated);
  const choices = children.findIndex(node => node.props?.["aria-label"] === "Starting image variations");
  const approval = children.findIndex(node => node.type === "Button" && text(node) === "Use as starting frame");
  assert.ok(choices > 0 && approval > choices);
  assert.equal(h.selections.length, 0);
});


test("Recreate reserves source, person and result columns before generation with only one initial action", async () => {
  const h = harness({ presentation: "recreation" }); h.render(); await h.settle();
  const tree = h.render();
  const source = nodes(tree).find(node => node.props?.["data-recreation-step"] === "source");
  const person = nodes(tree).find(node => node.props?.["data-recreation-step"] === "person");
  const result = nodes(tree).find(node => node.props?.["data-recreation-step"] === "result");
  assert.ok(source && person && result);
  assert.match(text(source), /1 Source frame/); assert.match(text(person), /2 Face reference/); assert.match(text(result), /3 Your starting frame/);
  assert.match(text(result), /will appear here/);
  assert.equal(button(tree, "Use selected frame"), undefined);
  assert.ok(button(tree, "Generate starting image"));
  assert.ok(nodes(result).includes(button(tree, "Generate starting image")), "Generate belongs directly to the result column");
  assert.equal(nodes(tree).filter(node => node.type === "footer").length, 0, "No separate bottom action bar");
  assert.equal(h.submissions.length, 0);
  const settings = nodes(tree).find(node => node.props?.["aria-label"] === "Starting image actions");
  assert.ok(text(settings).includes("Adjust image instructions"));
  assert.equal(nodes(person).some(node => node.type === "textarea"), false, "Optional instructions follow the model settings");
});

test("Recreate selects thumbnail variations without approving, then result-column actions hand off the selected result", async () => {
  const h = harness({ presentation: "recreation" }); await prepareVariations(h, 4);
  const jobs = completeVariations(h); h.render(); await h.settle(); const tree = h.render();
  assert.equal(button(tree, "Save preparation"), undefined);
  assert.equal(button(tree, "Use as starting frame"), undefined);
  const gallery = nodes(tree).find(n => n.props?.["aria-label"] === "Generated starting frames");
  assert.equal(nodes(gallery).filter(n => n.props?.["aria-label"]?.startsWith("Select variation ")).length, 4);
  assert.equal(nodes(gallery).filter(n => n.type === "StartingFrameImage").length, 1, "Only the chosen preview controls load/readiness state");
  for (const index of [2, 0, 3, 1]) {
    const count = h.selections.length;
    const action = nodes(h.render()).find(n => n.props?.["aria-label"] === `Select variation ${index + 1}`);
    assert.equal(action.props.disabled, false); action.props.onClick(); await h.settle();
    const selected = h.render();
    assert.equal(h.selections.length, count, "Selection must not approve or generate");
    assert.equal(nodes(selected).find(n => n.props?.["aria-label"] === `Select variation ${index + 1}`).props["aria-pressed"], true);
    const use = button(selected, "Use selected frame"); assert.equal(use.props.disabled, false); use.props.onClick();
    assert.equal(h.selections.at(-1).assetId, jobs[index].output.mediaAssetId);
    assert.equal(h.selections.at(-1).jobId, jobs[index].id);
  }
  assert.equal(h.submissions.length, 4);
});

test("unresolved motion is disclosed beside image generation before any credits are submitted", async () => {
  const h = harness({ presentation: "recreation", motionBlocked: true }); h.render(); await h.settle();
  const tree = h.render(); const warning = nodes(tree).find(node => node.props?.role === "status" && text(node).includes("Image generation uses credits"));
  assert.ok(warning); assert.match(text(warning), /cannot currently be used to generate a video/);
  const result = nodes(tree).find(node => node.props?.["data-recreation-step"] === "result");
  assert.ok(result && nodes(result).includes(button(tree, "Generate starting image")));
  assert.match(text(result), /motion.*review|instructions.*review/i);
  assert.equal(h.submissions.length, 0); assert.equal(h.selections.length, 0);
});

test("Recreate result actions block stale approval after changing generation inputs", async () => {
  const h = harness({ presentation: "recreation" }); h.render(); await h.settle();
  assert.equal(button(h.render(), "Use selected frame"), undefined);
  await prepareImageRequest(h); completeImage(h); h.render(); await h.settle();
  let tree = h.render(); assert.equal(button(tree, "Use selected frame").props.disabled, false);
  nodes(tree).find(node => node.type === "AiStudioSettingSelect").props.onChange("nano_banana_2");
  tree = h.render(); assert.equal(button(tree, "Use selected frame").props.disabled, true);
  assert.match(text(tree), /Inputs changed/);
  assert.equal(h.selections.length, 0); assert.equal(h.submissions.length, 1);
});

test("completed jobs cannot be approved before the selected preview loads or after a preview error", async () => {
  const h = harness({ presentation: "recreation", previewState: "loading" });
  await prepareVariations(h, 1); completeVariations(h);
  let tree = h.render();
  assert.equal(button(tree, "Use selected frame").props.disabled, true);
  button(tree, "Use selected frame").props.onClick();
  assert.equal(h.selections.length, 0, "Handler rejects a click before the image is viewable");
  h.previewStatus("error"); tree = h.render();
  assert.equal(button(tree, "Use selected frame").props.disabled, true);
  const count = h.submissions.length;
  button(tree, "Retry preview").props.onClick();
  assert.equal(h.submissions.length, count, "Retrying preview never creates a paid image request");
  h.previewStatus("ready"); tree = h.render();
  assert.equal(button(tree, "Use selected frame").props.disabled, false);
  button(tree, "Use selected frame").props.onClick();
  assert.equal(h.selections.length, 1);
});
