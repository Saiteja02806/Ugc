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
import * as recentPhotos from "../lib/explore/recent-person-photos.ts";
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
function harness({ captureCreatorDirections, referenceOverrides = {}, curatedReplacement, uuidStart = 43, creatorAccountId, presentation = "dialog", preparationFormat = "hook", frameWidth = 720, frameHeight = 1280, raw = null, sourceHash = sha, ownerId = "owner", frameError = null, submitError = false, failureAt = 1, rejectionAt = null, token = "fixture-token", previewRuntime, motionBlocked = false, previewState = "ready", resolvePhoto } = {}) {
  const stored = new Map(), effects = [], slots = [], queries = [], fetched = [], urls = [], revoked = [], errors = [];
  let cursor = 0, closed = 0, uuidIndex = uuidStart;
  const jobs = new Map();
  let statusReadError = null;
  const submissions = [], selections = [], statusRefreshes = [];
  const key = drafts.hookKeyframeDraftStorageKey(ownerId, draftId, referenceId);
  if (raw) stored.set(key, raw);
  const storage = { getItem: id => stored.get(id) ?? null, setItem: (id, value) => stored.set(id, value), removeItem: id => stored.delete(id) };
  const frameData = frameError ? undefined : { referenceId, sourceSha256: sourceHash, frame: { index: 0, timeSeconds: 0, width: frameWidth, height: frameHeight, sha256: "b".repeat(64) }, blob: new Blob(["frame"]) };
  const historyData = { pages: [{ images: [{ mediaAssetId: secondId, jobId: "saved-influencer" }], nextCursor: null }] };
  const element = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const imports = {
    "@/worker/src/lib/hook-curated-frames": curatedReplacement ? { ...curatedFrames, getCuratedHookFrame: () => curatedReplacement } : curatedFrames,
    "@/lib/explore/recent-person-photos": recentPhotos,
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
        return { data: name === "hook-source-frame-v4-opening" ? frameData : name === "hook-starting-image-cost" ? 1 : undefined,
          isPending: false, error: name === "hook-source-frame-v4-opening" ? frameError : null, refetch: () => {}, isFetching: false };
      },
      useQueries({ queries: batchQueries }) {
        return batchQueries.map(options => {
          queries.push(options);
          return { data: options.enabled ? jobs.get(options.queryKey[4]) : undefined, error: statusReadError, isFetching: false, refetch: async () => { statusRefreshes.push(options.queryKey.slice()); } };
        });
      },
      useInfiniteQuery: options => { queries.push(options); return { data: historyData, isPending: false, error: null, refetch() {}, hasNextPage: false }; },
    },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async id => { fetched.push(id); return resolvePhoto ? resolvePhoto(id) : { ...photo(id).asset, collection: "influencer" }; } },
    "@/lib/characters/history": { mergeCharacterHistoryPages: pages => pages.flatMap(page => page.images) },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => typeof token === "function" ? token() : token },
    "@/lib/http/read-deadline": { withReadDeadline: fn => fn(new AbortController().signal) },
    "@/lib/explore/hook-keyframe-draft": drafts,
    "@/lib/explore/hook-keyframe-motion": motions,
    "@/lib/explore/hook-keyframe-image-prompt": imagePrompts,
    "@/lib/explore/hook-keyframe-prompt-preview": { getHookKeyframePromptPreview: (draft, format, ...args) => (captureCreatorDirections?.(args[0]), { ...promptPreviews.getHookKeyframePromptPreview(draft, format, ...args), ...(motionBlocked ? { requiresDecision: true } : {}) }) },
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
      receipt: { ...scope, version: frozenInput.version === 4 ? 5 : frozenInput.version, imageModel: frozenInput.imageModel, promptVersion: frozenInput.version === 4 ? 7 : 2, purpose: "hook_starting_frame", inputKey: saved.inputKey, preparationInputKey: frozenInput.version === 4 ? saved.inputKey : undefined } }, { status: 202 });
  } });
  return { stored, key, fetched, queries, urls, revoked, errors, submissions, selections, statusRefreshes, previewStatus(value) { previewState = value; }, setJob(value) { jobs.set(value.id, value); }, closed: () => closed,
    restoreStore(other) { for (const [key, value] of other.stored) stored.set(key, value); for (const query of other.queries) {
      if (query.queryKey[0] === "hook-starting-image-job") { const value = other.jobFor(query.queryKey[4]); if (value) jobs.set(value.id, value); }
    } },
    jobFor(id) { return jobs.get(id); },
    setStatusReadError(value) { statusReadError = value; },
    render() { cursor = 0; const tree = exports.HookStartingFrameWorkspace({ presentation, preparationFormat, ownerId, draftId, previewRuntime,
      reference: { creatorAccountId, id: referenceId, title: "Hook 2", videoUrl: `https://media.example.test/${sourceHash}.mp4`, ...referenceOverrides }, onClose: () => closed++, onUseStartingFrame: value => selections.push(value) });
      for (const image of nodes(tree).filter(node => node.type === "img")) if (image.props.ref) image.props.ref.current = { src: "", removeAttribute() {} };
      for (const effect of effects.splice(0)) effect();
      for (const image of nodes(tree).filter(node => node.type === "StartingFrameImage")) image.props.onStateChange(image.props.assetId, image.props.url, previewState);
      cursor = 0; return exports.HookStartingFrameWorkspace({ presentation, preparationFormat, ownerId, draftId, previewRuntime, reference: { creatorAccountId, id: referenceId, title: "Hook 2", videoUrl: `https://media.example.test/${sourceHash}.mp4`, ...referenceOverrides }, onClose: () => closed++, onUseStartingFrame: value => selections.push(value) }); },
    async settle() { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); },
  };
}
function find(tree, type) { return nodes(tree).find(node => node.type === type); }
function button(tree, label) { return nodes(tree).find(node => node.type === "Button" && (node.props?.["aria-label"] === label || text(node).trim() === label)); }

test("fresh recreation resolves remembered photos once without submitting generation", async () => {
  const first = harness(); first.render(); await first.settle();
  find(first.render(), "FormatGenerationReferences").props.onImagesChange([photo(photoId), photo(secondId)]);
  const memoryKey = recentPhotos.recentPersonPhotosKey("owner");
  const next = harness(); next.stored.set(memoryKey, first.stored.get(memoryKey));
  next.render(); await next.settle(); let tree = next.render();
  assert.deepEqual(Array.from(find(tree, "FormatGenerationReferences").props.imageSelections, x => x.asset.id), [photoId, secondId]);
  assert.deepEqual(next.fetched, [photoId, secondId]); assert.equal(next.submissions.length, 0);
  find(tree, "FormatGenerationReferences").props.onImagesChange([]); tree = next.render();
  assert.equal(find(tree, "FormatGenerationReferences").props.imageSelections.length, 0);
  assert.deepEqual(recentPhotos.readRecentPersonPhotos(next.stored.get(memoryKey), "owner"), []);
  const reopened = harness(); reopened.restoreStore(next); reopened.render(); await reopened.settle();
  assert.equal(find(reopened.render(), "FormatGenerationReferences").props.imageSelections.length, 0);
  assert.deepEqual(reopened.fetched, []);
});

test("saved photo choices including explicit clearing win and do not change the recent preference", async () => {
  const memoryKey = recentPhotos.recentPersonPhotosKey("owner");
  const remembered = recentPhotos.serializeRecentPersonPhotos("owner", [secondId]);
  for (const ids of [[], [photoId]]) {
    const draft = drafts.updateHookKeyframeDraft(drafts.createHookKeyframeDraft(scope), { imageAssetIds: ids });
    const h = harness({ raw: drafts.serializeHookKeyframeDraft(draft) }); h.stored.set(memoryKey, remembered);
    h.stored.set(`${h.key}:person-photos-choice`, "1");
    h.render(); await h.settle();
    assert.deepEqual(Array.from(find(h.render(), "FormatGenerationReferences").props.imageSelections, x => x.asset.id), ids);
    assert.equal(h.stored.get(memoryKey), remembered);
  }
});

test("an automatically saved empty Talking Head preparation restores recent photos without a generation", async () => {
  const draft = drafts.createHookKeyframeDraft(scope);
  const h = harness({ preparationFormat: "talking_head", raw: drafts.serializeHookKeyframeDraft(draft) });
  h.stored.set(recentPhotos.recentPersonPhotosKey("owner"), recentPhotos.serializeRecentPersonPhotos("owner", [photoId,secondId]));
  h.render();await h.settle();
  assert.deepEqual(Array.from(find(h.render(),"FormatGenerationReferences").props.imageSelections,x=>x.asset.id),[photoId,secondId]);
  assert.deepEqual(h.fetched,[photoId,secondId]);assert.equal(h.submissions.length,0);
});

test("account changes never reuse another account's photos", async () => {
  const h = harness({ ownerId: "other" });
  h.stored.set(recentPhotos.recentPersonPhotosKey("owner"), recentPhotos.serializeRecentPersonPhotos("owner", [photoId]));
  h.render(); await h.settle();
  assert.equal(find(h.render(), "FormatGenerationReferences").props.imageSelections.length, 0);
  assert.deepEqual(h.fetched, []);
});

test("missing remembered photos discard the whole default and allow choosing again", async () => {
  const h = harness({ resolvePhoto: async id => { if (id === secondId) throw Error("Deleted"); return photo(id).asset; } });
  h.stored.set(recentPhotos.recentPersonPhotosKey("owner"), recentPhotos.serializeRecentPersonPhotos("owner", [photoId, secondId]));
  h.render(); await h.settle(); const tree = h.render();
  assert.equal(find(tree, "FormatGenerationReferences").props.imageSelections.length, 0);
  assert.match(text(tree), /previous photos could not be loaded/);
  assert.equal(find(tree, "FormatGenerationReferences").props.disabled, false);
});

test("photo edits are gated until default resolution finishes so late defaults cannot overwrite choices", async () => {
  let resolve;
  const h = harness({ resolvePhoto: () => new Promise(done => { resolve = done; }) });
  h.stored.set(recentPhotos.recentPersonPhotosKey("owner"), recentPhotos.serializeRecentPersonPhotos("owner", [photoId]));
  h.render(); await h.settle(); let tree = h.render();
  assert.equal(find(tree, "FormatGenerationReferences").props.disabled, true);
  resolve(photo(photoId).asset); await h.settle(); tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(secondId)]); tree = h.render(); await h.settle();
  assert.deepEqual(Array.from(find(h.render(), "FormatGenerationReferences").props.imageSelections, x => x.asset.id), [secondId]);
});

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
  assert.match(text(tree), /Create your starting frame/); assert.match(text(tree), /Source frame/); assert.match(text(tree), /Your photos/);
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

test("source and price load while saved photo validation is pending without enabling generation or overwriting recovery", async () => {
  let finishAuth;
  const pendingAuth = new Promise(resolve => { finishAuth = resolve; });
  const saved = drafts.updateHookKeyframeDraft(drafts.createHookKeyframeDraft(scope), { imageAssetIds: [photoId], instructions: "Preserve this preparation." });
  const raw = drafts.serializeHookKeyframeDraft(saved);
  const h = harness({ raw, token: () => pendingAuth }); h.render(); await h.settle();
  let tree = h.render();
  for (const name of ["hook-source-frame-v4-opening", "hook-starting-image-cost"]) {
    assert.equal(h.queries.filter(query => query.queryKey[0] === name).at(-1).enabled, true, `${name} does not wait for photos`);
  }
  assert.equal(button(tree, "Generate starting image").props.disabled, true);
  assert.equal(h.stored.get(h.key), raw);
  assert.equal(h.submissions.length, 0);
  finishAuth("fixture-token"); await h.settle(); tree = h.render();
  assert.equal(find(tree, "FormatGenerationReferences").props.imageSelections[0].asset.id, photoId);
  assert.equal(button(tree, "Generate starting image").props.disabled, false);
  assert.equal(h.submissions.length, 0);
});

test("failed photo restoration leaves source readable and preserves the saved request with generation blocked", async () => {
  const saved = drafts.updateHookKeyframeDraft(drafts.createHookKeyframeDraft(scope), { imageAssetIds: [photoId] });
  const raw = drafts.serializeHookKeyframeDraft(saved);
  const h = harness({ raw, token: null }); h.render(); await h.settle(); const tree = h.render();
  assert.equal(h.queries.filter(query => query.queryKey[0] === "hook-source-frame-v4-opening").at(-1).enabled, true);
  assert.equal(button(tree, "Generate starting image").props.disabled, true);
  assert.match(text(tree), /saved preparation has not been overwritten/);
  assert.equal(h.stored.get(h.key), raw);
  assert.equal(h.submissions.length, 0);
});

test("saved influencer selection adds and toggles photos independently without generating", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId)]); tree = h.render();
  await find(tree, "FormatGenerationReferences").props.influencerLibrary.onSelect({ mediaAssetId: secondId }); await h.settle(); tree = h.render();
  assert.deepEqual(Array.from(find(tree, "FormatGenerationReferences").props.imageSelections, x => x.asset.id), [photoId, secondId]);
  assert.deepEqual(drafts.readHookKeyframeDraft(h.stored.get(h.key), scope).imageAssetIds, [photoId, secondId]);
  await find(tree, "FormatGenerationReferences").props.influencerLibrary.onSelect({ mediaAssetId: photoId }); await h.settle(); tree = h.render();
  assert.deepEqual(Array.from(find(tree, "FormatGenerationReferences").props.imageSelections, x => x.asset.id), [secondId]);
  assert.equal(h.submissions.length, 0);
});

test("saved influencer photo cap rejects additions but still permits deselection", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  const ids = [photoId, secondId, ...[4,5,6].map(n => `00000000-0000-4000-8000-00000000000${n}`)];
  find(tree, "FormatGenerationReferences").props.onImagesChange(ids.map(photo)); tree = h.render();
  assert.equal(await find(tree, "FormatGenerationReferences").props.influencerLibrary.onSelect({ mediaAssetId: "00000000-0000-4000-8000-000000000007" }), false);
  await h.settle(); tree = h.render();
  assert.equal(find(tree, "FormatGenerationReferences").props.imageSelections.length, 5);
  assert.equal(h.fetched.length, 0);
  assert.equal(await find(tree, "FormatGenerationReferences").props.influencerLibrary.onSelect({ mediaAssetId: photoId }), true);
  await h.settle(); tree = h.render();
  assert.equal(find(tree, "FormatGenerationReferences").props.imageSelections.length, 4);
  assert.equal(h.submissions.length, 0);
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
  assert.equal(await find(tree, "FormatGenerationReferences").props.influencerLibrary.onSelect({ mediaAssetId: "00000000-0000-4000-8000-000000000004" }), false); await h.settle(); tree = h.render();
  assert.deepEqual(Array.from(find(tree, "FormatGenerationReferences").props.imageSelections, x => x.asset.id), [photoId, secondId]);
  assert.match(find(tree, "FormatGenerationReferences").props.influencerLibrary.selectionError, /Sign in/);
  assert.equal(h.submissions.length, 0);
});

test("reselecting a saved photo removes only that photo", async () => {
  const h = harness(); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId), photo(secondId)]); tree = h.render();
  assert.equal(await find(tree, "FormatGenerationReferences").props.influencerLibrary.onSelect({ mediaAssetId: photoId }), true); await h.settle(); tree = h.render();
  assert.deepEqual(Array.from(find(tree, "FormatGenerationReferences").props.imageSelections, x => x.asset.id), [secondId]);
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
    receipt: { ...scope, version: frozenInput.version === 4 ? 5 : frozenInput.version, imageModel: frozenInput.imageModel, promptVersion: frozenInput.version === 4 ? 7 : 2, purpose: "hook_starting_frame", inputKey: checkpoint.inputKey, preparationInputKey: frozenInput.version === 4 ? checkpoint.inputKey : undefined },
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
  assert.equal(button(tree, "Refresh status").props.disabled, false);
});
test("client result verification rejects failed jobs, mismatched receipt and credential-bearing URLs", () => {
  const checkpoint = keyframeClient.createHookKeyframeCheckpoint({ ...drafts.createHookKeyframeDraft(scope), version: 2 }, draftId);
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
  assert.equal(JSON.parse(checkpoint.inputKey).version, 4);
  assert.equal(drafts.readHookKeyframeDraft(h.stored.get(h.key), scope).version, 4);
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
      receipt: { ...scope, version: frozen.version === 4 ? 5 : frozen.version, imageModel: frozen.imageModel, promptVersion: frozen.version === 4 ? 7 : 2, purpose: "hook_starting_frame", inputKey: entry.checkpoint.inputKey, preparationInputKey: frozen.version === 4 ? entry.checkpoint.inputKey : undefined },
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
  assert.match(text(source), /1 Source frame/); assert.match(text(person), /2 Your photos/); assert.match(text(result), /3 Your starting frame/);
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


test("verified failed image releases retry and model controls without losing source or photos", async () => {
  const h = harness(); await prepareImageRequest(h);
  const { checkpoint, job } = completeImage(h);
  h.setJob({ ...job, status: "failed", isTerminal: true, error: '402 API error occurred: {"httpMeta":{"response":{},"request":{}}}', output: null });
  h.render(); await h.settle(); let tree = h.render();
  assert.equal(button(tree, "Generate another starting image").props.disabled, false);
  const model = nodes(tree).find(node => node.type === "AiStudioSettingSelect" && node.props.ariaLabel === "Starting image model");
  assert.equal(model.props.disabled, false);
  model.props.onChange("seedream_5_pro"); tree = h.render();
  assert.equal(button(tree, "Generate another starting image").props.disabled, false);
  button(tree, "Generate another starting image").props.onClick(); await h.settle();
  assert.equal(h.submissions.length, 2);
  assert.equal(h.submissions[1].imageModel, "seedream_5_pro");
  assert.notEqual(h.submissions[1].idempotencyKey, checkpoint.requestKey);
  assert.deepEqual(h.submissions[1].personImageAssetIds, h.submissions[0].personImageAssetIds);
});

test("creator reference failure allows same-frame retry and model change after reopening", async () => {
  const h = harness({ creatorAccountId: "creator", presentation: "recreation", preparationFormat: "talking-head" });
  await prepareImageRequest(h);
  const { checkpoint, job } = completeImage(h);
  h.setJob({ ...job, status: "failed", isTerminal: true, error: "402 API error occurred", output: null });
  h.render(); await h.settle();
  const reopened = harness({ uuidStart: 100, creatorAccountId: "creator", presentation: "recreation", preparationFormat: "talking-head" });
  reopened.restoreStore(h); reopened.render(); await reopened.settle();
  let tree = reopened.render();
  assert.equal(button(tree, "Generate another image").props.disabled, false);
  const model = nodes(tree).find(node => node.type === "AiStudioSettingSelect" && node.props.ariaLabel === "Starting image model");
  assert.equal(model.props.disabled, false);
  model.props.onChange("seedream_5_pro"); tree = reopened.render();
  button(tree, "Generate another image").props.onClick(); await reopened.settle();
  assert.equal(reopened.submissions.length, 1);
  assert.equal(reopened.submissions[0].imageModel, "seedream_5_pro");
  assert.notEqual(reopened.submissions[0].idempotencyKey, checkpoint.requestKey);
  assert.equal(reopened.submissions[0].referenceId, h.submissions[0].referenceId);
  assert.equal(reopened.submissions[0].sourceSha256, h.submissions[0].sourceSha256);
  assert.deepEqual(reopened.submissions[0].personImageAssetIds, h.submissions[0].personImageAssetIds);
});

for (const outcome of ["failed", "cancelled"]) test(`creator ${outcome} attempt permits same-model retry without changing the source`, async () => {
  const h = harness({ creatorAccountId: "creator" }); await prepareImageRequest(h);
  const { checkpoint, job } = completeImage(h);
  h.setJob({ ...job, status: outcome, isTerminal: true, output: null });
  h.render(); await h.settle(); const tree = h.render();
  assert.equal(button(tree, "Generate another starting image").props.disabled, false);
  button(tree, "Generate another starting image").props.onClick(); await h.settle();
  assert.equal(h.submissions.length, 2);
  assert.notEqual(h.submissions[1].idempotencyKey, checkpoint.requestKey);
  const { idempotencyKey: oldKey, ...previous } = h.submissions[0];
  const { idempotencyKey: newKey, ...next } = h.submissions[1];
  assert.notEqual(newKey, oldKey);
  assert.deepEqual(next, previous);
});

test("new creator jobs ignore later curated replacements and retain opening-only retry preparation", async () => {
  const h = harness({ creatorAccountId: "creator", curatedReplacement: { index: 2, timeSeconds: 1, sha256: "c".repeat(64) } });
  await prepareImageRequest(h); const { job } = completeImage(h);
  h.setJob({ ...job, status: "failed", isTerminal: true, output: null });
  h.render(); await h.settle(); const tree = h.render();
  assert.equal(button(tree, "Generate another starting image").props.disabled, false);
  assert.doesNotMatch(text(tree), /earlier source frame/);
  assert.equal(button(tree, "Use clearer source frame"), undefined);
  assert.equal(JSON.parse(variationClient.readHookKeyframeVariations(h.stored.get(variationClient.hookKeyframeVariationsKey(scope)), scope).entries[0].checkpoint.inputKey).sourceFrame.index, 0);
});

const thirdPhotoId = "00000000-0000-4000-8000-000000000004";
test("Generate another freezes the updated three-photo selection separately from the first one-photo request", async () => {
  const h = harness({ creatorAccountId: "creator" }); h.render(); await h.settle();
  find(h.render(), "FormatGenerationReferences").props.onImagesChange([photo(photoId)]);
  button(h.render(), "Generate starting image").props.onClick(); await h.settle();
  const first = h.submissions[0];
  assert.deepEqual(first.personImageAssetIds, [photoId]);
  completeImage(h); h.render(); await h.settle();
  find(h.render(), "FormatGenerationReferences").props.onImagesChange([photo(photoId), photo(secondId), photo(thirdPhotoId)]);
  button(h.render(), "Generate another starting image").props.onClick(); await h.settle();
  assert.equal(h.submissions.length, 2);
  const second = h.submissions[1];
  assert.deepEqual(second.personImageAssetIds, [photoId, secondId, thirdPhotoId]);
  assert.deepEqual(first.personImageAssetIds, [photoId]);
  assert.notEqual(first.idempotencyKey, second.idempotencyKey);
  assert.equal(first.sourceSha256, second.sourceSha256);
  const entries = variationClient.readHookKeyframeVariations(h.stored.get(variationClient.hookKeyframeVariationsKey(scope)), scope).entries;
  assert.deepEqual(JSON.parse(entries[0].checkpoint.inputKey).imageAssetIds, [photoId]);
  assert.deepEqual(JSON.parse(entries[1].checkpoint.inputKey).imageAssetIds, [photoId, secondId, thirdPhotoId]);
});

for (const presentation of ["dialog", "workspace", "recreation"]) test(`${presentation} starting-frame generation displays a busy spinner and stops on failure`, async () => {
  const h = harness({ presentation }); await prepareImageRequest(h);
  let tree = h.render();
  let pending = nodes(tree).find(node => node.props?.["aria-busy"] === true);
  assert.ok(pending);
  assert.ok(nodes(pending).some(node => node.type === "Loader2" && node.props.className.includes("animate-spin")));
  const { job } = completeImage(h);
  for (const [status, label] of [["queued", /queued/], ["waiting_external_service", /Generating/], ["uploading_output", /Finishing/]]) {
    h.setJob({ ...job, status, isTerminal: false, output: null }); tree = h.render();
    pending = nodes(tree).find(node => node.props?.["aria-busy"] === true);
    assert.ok(pending); assert.match(text(pending), label);
  }
  h.setJob({ ...job, status: "failed", error: "Provider failed", output: null }); tree = h.render();
  assert.equal(nodes(tree).some(node => node.props?.["aria-busy"] === true), false);
  assert.match(text(tree), /Provider failed/);
});

test("status-read errors stop the spinner without discarding or resubmitting the saved request", async () => {
  const h = harness(); await prepareImageRequest(h);
  h.setStatusReadError(new Error("Connection lost"));
  const tree = h.render();
  assert.equal(nodes(tree).some(node => node.props?.["aria-busy"] === true), false);
  assert.match(text(tree), /Connection lost Your request is preserved/);
  assert.match(text(tree), /Your request is preserved/);
  assert.equal(h.submissions.length, 1);
  assert.ok(button(tree, "Refresh status"));
});


test("one result error and Refresh status retain the same job without another submission", async () => {
  const h = harness({ presentation: "recreation", submitError: true }); h.render(); await h.settle(); let tree = h.render();
  find(tree, "FormatGenerationReferences").props.onImagesChange([photo(photoId)]); tree = h.render();
  button(tree, "Generate starting image").props.onClick(); await h.settle(); tree = h.render();
  h.setStatusReadError(new Error("This starting-image job could not be verified.")); tree = h.render();
  assert.equal(nodes(tree).filter(node => node.props?.role === "alert" && /job could not be verified/.test(text(node))).length, 1);
  const settings = nodes(tree).find(node => node.props?.["aria-label"] === "Starting image actions");
  assert.doesNotMatch(text(settings), /job could not be verified|image request is unconfirmed/);
  const saved = h.stored.get(keyframeClient.hookKeyframeCheckpointKey(scope));
  for (let i=0; i<2; i++) { button(tree, "Refresh status").props.onClick(); await h.settle(); tree = h.render(); }
  assert.equal(h.submissions.length, 1);
  assert.equal(h.statusRefreshes.length, 2);
  assert.deepEqual(h.statusRefreshes[0], h.statusRefreshes[1]);
  assert.equal(h.stored.get(keyframeClient.hookKeyframeCheckpointKey(scope)), saved);
  assert.equal(button(tree, "Generate another image").props.disabled, true);
});


test("private frame-zero preparation passes full-source directions over the legacy fallback", async () => {
 const full = "OPENING: PHASE [0–0.5]: Hold the cup.\nENDING: PHASE [0.5–1]: Lower it and look up.";
 const seen=[]; const h=harness({creatorAccountId:"creator",captureCreatorDirections:value=>seen.push(value),referenceOverrides:{generationPrompt:full,legacyGenerationPrompt:"Old untimed directions",startingFrame:{sha256:"c".repeat(64)}}});
 h.render(); await h.settle(); h.render(); assert.equal(seen.at(-1),full);
});
