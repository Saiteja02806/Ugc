import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "../worker/src/lib/hook-starting-frame-video.ts";
import * as photoSelection from "../lib/explore/starting-frame-photo-selection.ts";
import { startingFrameAnimationInput, startingFrameFaceReferenceError } from "../lib/explore/starting-frame-animation-input.ts";

const frame = { assetId: "frame-asset", jobId: "frame-job", referenceId: "hook-reference", url: "https://owned.test/frame.png" };
const photo = id => ({ kind: "image", asset: { id, url: `https://owned.test/${id}.png`, collection: "influencer", status: "ready", sourceType: "generated_image", mimeType: "image/png", createdAt: "2026-10-24T00:00:00Z" } });
const source = readFileSync(new URL("../components/explore/starting-frame-animation-references.tsx", import.meta.url), "utf8");
function nodes(tree) { return !tree || typeof tree !== "object" ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
function harness({ resolveAsset = async id => photo(id).asset } = {}) {
  const slots = [], pending = [], errors = [], changes = [], selectedFrames = [];
  let cursor = 0, cleanups = [], effects = [], clearedFrames = 0;
  const useRef = initial => { const i = cursor++; return slots[i] ??= { current: initial }; };
  const exported = {};
  const imports = {
    react: { useRef, useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; }, useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) { slots[i] = { deps, cleanup: null }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } } },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "@tanstack/react-query": { useInfiniteQuery: () => ({ data: { pages: [{ images: [], nextCursor: null }] }, isPending: false, error: null, hasNextPage: false, isFetchingNextPage: false, refetch() {}, fetchNextPage() {} }) },
    "lucide-react": { Plus: "Plus" },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/popover": Object.fromEntries(["Popover", "PopoverContent", "PopoverTitle", "PopoverTrigger"].map(name => [name, name])),
    "./workflow-reference-preview": { WorkflowReferencePreview: "frame-preview" },
    "./workflow-reference-preview.module.css": { default: {} },
    "./workflow-creation.module.css": { default: {} },
    "./format-generation-references": { FormatGenerationReferences: "picker" },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: resolveAsset },
    "@/lib/characters/history": { mergeCharacterHistoryPages: pages => pages.flatMap(page => page.images) },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "fixture-token" },
    "@/lib/http/read-deadline": { withReadDeadline: (fn, signal) => fn(signal ?? new AbortController().signal) },
    "@/worker/src/lib/hook-starting-frame-video": policy,
    "@/lib/explore/starting-frame-photo-selection": photoSelection,
    "./starting-frame-animation-references.module.css": { default: {} },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports: exported, AbortController, process: { env: { NODE_ENV: "test" } }, Error, require(name) { assert.ok(name in imports, name); return imports[name]; } });
  const base = { frame, model: "google_omni", photos: [], ownerId: "owner", preview: false, disabled: false,
    onPhotosChange: value => changes.push(value), onSelectFrame: value => selectedFrames.push(value), onClearFrame: () => { clearedFrames++; },
    onPendingChange: value => pending.push(value), onErrorChange: value => errors.push(value) };
  function render(patch = {}) {
    cursor = 0; const tree = exported.StartingFrameAnimationReferences({ ...base, ...patch });
    effects.forEach(effect => effect()); effects = []; cleanups = slots.flatMap(slot => slot?.cleanup ? [slot.cleanup] : []);
    const pickers = nodes(tree).filter(node => node.type === "picker"); return { tree, scene: pickers.length > 1 ? pickers[0].props : null, faces: pickers.at(-1).props };
  }
  return { render, pending, errors, changes, selectedFrames, clearedFrames: () => clearedFrames, unmount() { cleanups.forEach(fn => fn()); } };
}

test("the payload keeps first-frame identity and ordered face references in separate roles", () => {
  const photos = [photo("face-a"), photo("face-b")];
  assert.deepEqual(startingFrameAnimationInput(frame, photos), { startingFrameAssetId: frame.assetId, startingFrameJobId: frame.jobId, referenceId: frame.referenceId,
    referenceImageUrls: photos.map(value => value.asset.url), imageReferencePurpose: "person" });
  assert.deepEqual(startingFrameAnimationInput(frame, []), { startingFrameAssetId: frame.assetId, startingFrameJobId: frame.jobId, referenceId: frame.referenceId });
  // The approved frame stays the opening authority; photos ride behind it as
  // ordered identity references on every route that can carry them.
  assert.deepEqual(startingFrameAnimationInput(frame, photos, undefined, "wan_3_0").referenceImageUrls, photos.map(value => value.asset.url));
  assert.deepEqual(startingFrameAnimationInput(frame, photos, undefined, "seedance_2_5").referenceImageUrls, photos.map(value => value.asset.url));
  assert.deepEqual(startingFrameAnimationInput(frame, photos, undefined, "kling_4_0").referenceImageUrls, photos.map(value => value.asset.url));
  assert.deepEqual(startingFrameAnimationInput(frame, photos, "first_frame_with_identity", "google_omni").referenceImageUrls, photos.map(value => value.asset.url));
  // Kling 3.0 exposes only a first-frame and a last-frame slot, so the approved
  // frame travels alone and the photos shaped it during preparation.
  assert.equal("referenceImageUrls" in startingFrameAnimationInput(frame, photos, undefined, "kling_3_0"), false);
  assert.equal(policy.hookStartingFrameFaceReferenceRoute("kling_3_0"), "frame_only");
  for (const model of ["google_omni", "kling_4_0", "seedance_2_5", "wan_3_0"]) {
    assert.equal(policy.hookStartingFrameFaceReferenceRoute(model, model === "google_omni" ? "first_frame_with_identity" : undefined), "frame_and_references");
  }
});

test("identity photos are accepted with a starting frame on every animation model", () => {
  const photos = [photo("face-a"), photo("face-b")];
  for (const model of ["kling_3_0", "kling_4_0", "seedance_2_5", "wan_3_0"]) {
    assert.equal(startingFrameFaceReferenceError(model, frame, photos), null, model);
  }
  assert.equal(startingFrameFaceReferenceError("google_omni", frame, photos, "first_frame_with_identity"), null);
  // Omni's direct identity route is opt-in; without it the limit is zero.
  assert.match(startingFrameFaceReferenceError("google_omni", frame, photos), /Gemini Omni route/);
  assert.match(startingFrameFaceReferenceError("wan_3_0", frame, Array.from({length:6},(_,i)=>photo(`face-${i}`))), /up to 5 face references/);
  assert.match(startingFrameFaceReferenceError("google_omni", frame, Array.from({length:6},(_,i)=>photo(`face-${i}`)), "first_frame_with_identity"), /up to 5 face references/);
  assert.match(startingFrameFaceReferenceError("wan_3_0", frame, [{ asset: { id: frame.assetId, url: frame.url } }]), /separate clear face photo/);
  assert.match(startingFrameFaceReferenceError("wan_3_0", frame, [photos[0], photos[0]]), /duplicate face references/);
});

test("scene history and optional faces have independent selectors and removals", async () => {
  const h = harness(), first = h.render();
  assert.equal(first.scene.startingFramesOnly, true);
  assert.equal(first.scene.imageSelections.length, 0);
  assert.equal(first.faces.onSelectStartingFrame, undefined);
  assert.equal(first.faces.startingFrame, undefined);
  assert.equal(first.faces.inlineImagePicker, true);
  assert.equal(first.faces.heading, "Face identity photos");
  assert.equal(await first.faces.influencerLibrary.onSelect({ mediaAssetId: "face-a" }), true);
  assert.equal(h.changes.length, 1);
  const photos = [photo("face-a")], nextFrame = { ...frame, assetId: "other-frame" };
  const next = h.render({ frame: nextFrame, photos });
  assert.equal(next.faces.imageSelections, photos);
  next.faces.onImagesChange([]);
  assert.equal(h.clearedFrames(), 0);
  assert.equal(next.scene.startingFrame, nextFrame);
  next.scene.onClearStartingFrame();
  assert.equal(h.clearedFrames(), 1);
  assert.deepEqual(Array.from(photos, value => value.asset.id), ["face-a"]);
});

test("photo selection stays available without changing the selected model or starting frame", async () => {
  const h = harness(), photos = [photo("face-a")], result = h.render({ model: "wan_3_0", photos });
  assert.equal(result.faces.imageSelections, photos);
  assert.equal(result.faces.imagePickerDisabled, false);
  assert.equal(result.faces.maxImages, 5);
  assert.equal(result.faces.disabled, false);
  assert.equal(await result.faces.influencerLibrary.onSelect({ mediaAssetId: "face-b" }), true);
  assert.equal(h.changes.length, 1);
  result.faces.onImagesChange([]);
  assert.equal(h.changes.at(-1).length, 0);
  assert.equal(h.clearedFrames(), 0);
});

test("a stale influencer read cannot add photos after frame/model changes or leave generation pending", async () => {
  let resolve, notifyRead;
  const readStarted = new Promise(done => { notifyRead = done; });
  const h = harness({ resolveAsset: () => new Promise(done => { resolve = done; notifyRead(); }) });
  const first = h.render();
  const selection = first.faces.influencerLibrary.onSelect({ mediaAssetId: "face-a" });
  await readStarted;
  h.render({frame:{...frame,assetId:"new-frame"}});
  resolve(photo("face-a").asset);
  assert.equal(await selection, false);
  assert.equal(h.changes.length, 0);
  h.unmount(); assert.equal(h.pending.at(-1), false);
});

test("compact Change directly uses the full dialog and keeps frame/identity roles separate", () => {
  const h = harness(), photos = [photo("face-a")];
  const result = h.render({ compact: true, photos });
  assert.equal(result.scene, null);
  assert.equal(result.faces.inlineImagePicker, false);
  assert.equal(result.faces.startingFramePreview, frame);
  assert.equal(result.faces.startingFrame, undefined);
  assert.equal(result.faces.imageSelections, photos);
  assert.equal(result.faces.onSelectStartingFrame instanceof Function, true);
  assert.equal(nodes(result.tree).some(node => node.type === "PopoverContent"), false);
  result.faces.onChange(photo("face-b"));
  assert.deepEqual(Array.from(h.changes.at(-1), item => item.asset.id), ["face-a", "face-b"]);
  assert.equal(h.clearedFrames(), 0);
  result.faces.onSelectStartingFrame({ ...frame, assetId: "other-frame" });
  assert.equal(h.selectedFrames.at(-1).assetId, "other-frame");
});

test("model-specific starting-frame defaults preserve the supported duration contract", () => {
  for (const [model, expected] of [["google_omni", 4], ["wan_3_0", 3], ["seedance_2_5", 4]]) {
    assert.equal(policy.hookStartingFrameDefaultDuration(model), expected);
    assert.ok(policy.hookStartingFrameVideoDurations(model).includes(expected));
  }
  const workspace = readFileSync(new URL("../components/video/video-generation-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /Animate this image with your selected model/);
  assert.match(workspace, /compact frame=\{startingFrame\}/);
});


test("measured Hook source duration selects the nearest supported duration",()=>{
 for(const model of ["wan_3_0","seedance_2_5","kling_4_0"]){
  assert.equal(policy.hookStartingFrameSourceDuration(model,4),4);assert.equal(policy.hookStartingFrameSourceDuration(model,4.1),4);assert.equal(policy.hookStartingFrameSourceDuration(model,4.3),4);assert.equal(policy.hookStartingFrameSourceDuration(model,4.6),5);assert.equal(policy.hookStartingFrameSourceDuration(model,5),5);
 }
 assert.equal(policy.hookStartingFrameSourceDuration("google_omni",4),4);
 assert.equal(policy.hookStartingFrameSourceDuration("google_omni",4.1),4);
 assert.equal(policy.hookStartingFrameSourceDuration("google_omni",4.3),4);
 assert.equal(policy.hookStartingFrameSourceDuration("google_omni",4.6),6);
 assert.equal(policy.hookStartingFrameSourceDuration("google_omni",5),6);
 assert.equal(policy.hookStartingFrameSourceDuration("google_omni",2.3),4);
 assert.equal(policy.hookStartingFrameSourceDuration("seedance_2_5",2.3),4);
 assert.equal(policy.hookStartingFrameSourceDuration("google_omni",undefined,6),6);
});
