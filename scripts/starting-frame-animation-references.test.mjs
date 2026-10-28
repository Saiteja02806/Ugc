import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "../worker/src/lib/hook-starting-frame-video.ts";
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
    const pickers = nodes(tree).filter(node => node.type === "picker"); return { tree, scene: pickers[0].props, faces: pickers[1].props };
  }
  return { render, pending, errors, changes, selectedFrames, clearedFrames: () => clearedFrames, unmount() { cleanups.forEach(fn => fn()); } };
}

test("the payload keeps first-frame identity and ordered face references in separate roles", () => {
  const photos = [photo("face-a"), photo("face-b")];
  assert.deepEqual(startingFrameAnimationInput(frame, photos), { startingFrameAssetId: frame.assetId, startingFrameJobId: frame.jobId, referenceId: frame.referenceId,
    referenceImageUrls: photos.map(value => value.asset.url), imageReferencePurpose: "person" });
  assert.deepEqual(startingFrameAnimationInput(frame, []), { startingFrameAssetId: frame.assetId, startingFrameJobId: frame.jobId, referenceId: frame.referenceId });
  assert.equal(startingFrameFaceReferenceError("google_omni", frame, photos), null);
  assert.match(startingFrameFaceReferenceError("wan_3_0", frame, photos), /Choose Omni.*kept/);
  assert.match(startingFrameFaceReferenceError("seedance_2_5", frame, photos), /Choose Omni/);
  assert.match(startingFrameFaceReferenceError("google_omni", frame, Array.from({length:6},(_,i)=>photo(`face-${i}`))), /up to 5/);
  assert.match(startingFrameFaceReferenceError("google_omni", frame, [{ asset: { id: frame.assetId, url: frame.url } }]), /separate clear face/);
  assert.match(startingFrameFaceReferenceError("google_omni", frame, [photos[0], photos[0]]), /duplicate/);
});

test("scene history and optional faces have independent selectors and removals", async () => {
  const h = harness(), first = h.render();
  assert.equal(first.scene.startingFramesOnly, true);
  assert.equal(first.scene.imageSelections.length, 0);
  assert.equal(first.faces.onSelectStartingFrame, undefined);
  assert.equal(first.faces.startingFrame, undefined);
  assert.equal(first.faces.inlineImagePicker, true);
  assert.equal(first.faces.heading, "Your photos");
  assert.equal(await first.faces.influencerLibrary.onSelect({ mediaAssetId: "face-a" }), true);
  assert.equal(h.clearedFrames(), 0);
  assert.deepEqual(Array.from(h.changes.at(-1), value => value.asset.id), ["face-a"]);
  const photos = h.changes.at(-1), nextFrame = { ...frame, assetId: "other-frame" };
  const next = h.render({ frame: nextFrame, photos });
  assert.equal(next.faces.imageSelections, photos);
  next.faces.onImagesChange([]);
  assert.equal(h.clearedFrames(), 0);
  assert.equal(next.scene.startingFrame, nextFrame);
  next.scene.onClearStartingFrame();
  assert.equal(h.clearedFrames(), 1);
  assert.deepEqual(Array.from(photos, value => value.asset.id), ["face-a"]);
});

test("unsupported models retain removable face photos and block adding or selecting them", async () => {
  const h = harness(), photos = [photo("face-a")], result = h.render({ model: "wan_3_0", photos });
  assert.equal(result.faces.imageSelections, photos);
  assert.equal(result.faces.imagePickerDisabled, true);
  assert.equal(result.faces.disabled, false);
  assert.equal(await result.faces.influencerLibrary.onSelect({ mediaAssetId: "face-b" }), false);
  assert.equal(h.changes.length, 0);
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
  h.render({ model: "seedance_2_5" });
  resolve(photo("face-a").asset);
  assert.equal(await selection, false);
  assert.equal(h.changes.length, 0);
  assert.equal(h.pending.at(-1), false);
  h.unmount(); assert.equal(h.pending.at(-1), false);
});

test("compact approved frame is a single tile and keeps photo controls inside Change", () => {
  const result = harness().render({ compact: true });
  const all = nodes(result.tree);
  assert.equal(all.filter(node => node.type === "frame-preview").length, 1);
  const popup = all.find(node => node.type === "PopoverContent");
  assert.ok(popup);
  assert.equal(nodes(popup).filter(node => node.type === "picker").length, 2);
  const source = readFileSync(new URL("../components/explore/starting-frame-animation-references.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Choose Omni Flash 1.1 to add face references|Add clear photos of the same person for facial guidance/);
});

test("model-specific starting-frame defaults preserve the supported duration contract", () => {
  for (const [model, expected] of [["google_omni", 3], ["wan_3_0", 3], ["seedance_2_5", 4]]) {
    assert.equal(policy.hookStartingFrameDefaultDuration(model), expected);
    assert.ok(policy.hookStartingFrameVideoDurations(model).includes(expected));
  }
  const workspace = readFileSync(new URL("../components/video/video-generation-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /Animate this image with your selected model/);
  assert.match(workspace, /compact frame=\{startingFrame\}/);
});
