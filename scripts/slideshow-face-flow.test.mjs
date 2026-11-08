import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { planSlideshowFaceSwaps } from "../lib/explore/slideshow-face-swap.ts";

// Non-build handler tests. Evaluate source in memory; no bundle, dev server,
// provider call, upload or generated asset is created by this suite.
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join("") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" || typeof tree === "number" ? String(tree) : "";
const normalize = value => JSON.parse(JSON.stringify(value));
function component(file, name, dependencies) {
  let cursor = 0;
  const slots = [], effects = [], cleanups = [];
  const element = (type, props) => ({ type, props });
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useId() { return "face-status"; },
    useEffect(fn, deps) { const index = cursor++; if (!(index in slots) || deps.some((value, i) => value !== slots[index][i])) { slots[index] = deps; effects.push(fn); } },
  };
  const exported = {};
  const imports = { react, "react/jsx-runtime": { jsx: element, jsxs: element }, "lucide-react": new Proxy({}, { get: () => "icon" }), "@/components/ui/button": { Button: "Button" }, ...dependencies };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: exported, Error, require(key) { assert.ok(key in imports, key); return imports[key]; },
  });
  return {
    render(props) { cursor = 0; const tree = exported[name](props); for (const fn of effects.splice(0)) { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } return tree; },
    unmount() { cleanups.forEach(fn => fn()); },
  };
}
function dialog({ eligible = [1, 2, 3, 4, 5, 6], face = null, ids = [] } = {}) {
  const mod = component("components/explore/slideshow-face-swap-control.tsx", "SlideshowFaceSwapControl", {
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogDescription", "DialogTitle", "DialogTrigger"].map(name => [name, name])),
    "@/lib/media/image-picker": { imagePickerThumbnailUrl: url => url },
    "./slideshow-face-choice": { SlideshowFaceChoice: "FaceChoice" },
  });
  const commits = [];
  const props = { ownerId: "owner", disabled: false, value: {
    open: false, influencer: face, slideIds: ids, eligibleCount: eligible.length,
    slides: Array.from({ length: 6 }, (_, i) => ({ id: `slide-${i + 1}`, url: `/slide-${i + 1}.png`, number: i + 1, eligible: eligible.includes(i + 1) })),
    onOpenChange(open) { props.value.open = open; },
    onInfluencerChange(value) { props.value.influencer = value; commits.push(["face", normalize(value)]); },
    onSlideIdsChange(value) { props.value.slideIds = value; commits.push(["slides", normalize(value)]); },
  } };
  const tree = () => mod.render(props);
  const find = label => nodes(tree()).find(node => node.props?.["aria-label"] === label || node.type === "Button" && text(node) === label);
  const click = label => { const target = find(label); assert.ok(target, label); assert.equal(Boolean(target.props.disabled), false, label); target.props.onClick(); };
  const open = () => nodes(tree()).find(node => node.type === "Dialog").props.onOpenChange(true);
  const choose = value => nodes(tree()).find(node => node.type === "FaceChoice").props.onSelect(value);
  return { props, tree, find, click, open, choose, commits };
}
const primary = { id: "face-1", url: "/face.png", title: "Person" };

test("six-slide flow advances after choosing a primary and commits only Slide 1", () => {
  const h = dialog(); h.open();
  assert.equal(h.find("Next: choose slides").props.disabled, true);
  assert.equal(h.find("Done"), undefined);
  h.choose(primary);
  assert.equal(h.find("Next: choose slides").props.disabled, false);
  h.click("Next: choose slides");
  assert.equal(nodes(h.tree()).some(node => node.type === "FaceChoice"), false, "Photo library cannot hide the slide step");
  assert.equal(h.find("Done").props.disabled, true);
  assert.match(text(h.tree()), /Select at least one slide/);
  h.click("Face swap for source slide 1");
  assert.equal(h.find("Done").props.disabled, false);
  for (let n = 2; n <= 6; n++) assert.equal(h.find(`Face swap for source slide ${n}`).props["aria-pressed"], false);
  assert.match(text(h.tree()), /Face swap on Slide 1\. Other slides/);
  h.click("Done");
  assert.equal(h.props.value.open, false);
  assert.deepEqual(normalize(h.props.value.slideIds), ["slide-1"]);
  assert.equal(h.props.value.influencer.id, primary.id);
});

test("Back, Cancel and dismissal discard unfinished choices and reopening restores committed photos/slides", () => {
  const h = dialog({ face: primary, ids: ["slide-1"] }); h.open();
  h.choose({ ...primary, id: "different" }); h.click("Next: choose slides");
  h.click("Face swap for source slide 2"); h.click("Back");
  assert.equal(nodes(h.tree()).find(node => node.type === "FaceChoice").props.selected.id, "different");
  h.click("Cancel"); assert.deepEqual(h.commits, []);
  h.open(); h.click("Next: choose slides");
  assert.equal(h.find("Face swap for source slide 2").props["aria-pressed"], false);
  h.click("Face swap for source slide 3");
  nodes(h.tree()).find(node => node.type === "Dialog").props.onOpenChange(false);
  h.open(); h.click("Next: choose slides");
  assert.equal(h.find("Face swap for source slide 3").props["aria-pressed"], false);
  h.click("Remove face swap");
  assert.equal(h.props.value.influencer, null); assert.deepEqual(normalize(h.props.value.slideIds), []);
});

test("generation eligibility changes remove stale targets; no automatic all-slide marking", () => {
  const h = dialog({ eligible: [1], face: primary, ids: ["slide-6"] }); h.open(); h.click("Next: choose slides");
  assert.equal(h.find("Face swap for source slide 6").props.disabled, true);
  assert.equal(h.find("Done").props.disabled, true);
  h.click("Select all"); assert.equal(h.find("Face swap for source slide 1").props["aria-pressed"], true);
  h.click("Clear slides"); assert.equal(h.find("Done").props.disabled, true);
  h.click("Face swap for source slide 1");
  h.props.value.slides[0].eligible = false;
  assert.equal(h.find("Done").props.disabled, true);
  h.find("Done").props.onClick(); assert.deepEqual(h.commits, []);
});

test("upload busy and empty generation selections have precise, guarded next steps", () => {
  const h = dialog(); h.open(); h.choose(primary);
  nodes(h.tree()).find(node => node.type === "FaceChoice").props.onBusyChange(true);
  assert.equal(h.find("Next: choose slides").props.disabled, true);
  assert.equal(h.find("Cancel").props.disabled, true);
  nodes(h.tree()).find(node => node.type === "Dialog").props.onOpenChange(false);
  assert.equal(h.props.value.open, true);
  const empty = dialog({ eligible: [] }); empty.open(); empty.choose(primary);
  assert.equal(empty.find("Next: choose slides").props.disabled, true);
  assert.match(text(empty.tree()), /Select source slides in Create/);
});

function photos({ selected = null, upload = async file => ({ asset: { id: file.name, url: `/${file.name}`, fileName: file.name } }) } = {}) {
  const query = { data: [], isLoading: false, refetch() {} };
  const props = { ownerId: "owner", selected, onSelect(value) { props.selected = value; }, onBusyChange(value) { props.busy = value; } };
  const mod = component("components/explore/slideshow-face-choice.tsx", "SlideshowFaceChoice", {
    "@tanstack/react-query": { useInfiniteQuery: () => ({ data: { pages: [] } }), useQuery: () => query },
    "@/lib/explore/format-reference-images": { fetchFormatReferenceImages() {} },
    "@/lib/characters/photo-library-client": { fetchInfluencerPhotoLibrary() {} },
    "@/lib/characters/history": { mergeCharacterHistoryPages: () => [] },
    "@/lib/media/image-picker": { imagePickerThumbnailUrl: url => url },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: upload },
    "@/lib/utils": { cn: (...args) => args.join(" ") },
  });
  const tree = () => mod.render(props);
  const input = () => nodes(tree()).find(node => node.type === "input");
  const uploadFiles = (...names) => { input().props.onChange({ currentTarget: { files: names.map(name => ({ name })) } }); };
  return { ...mod, props, tree, query, input, uploadFiles };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test("uploaded photos select immediately in order and stay visible during library loading", async () => {
  const h = photos(); h.uploadFiles("first.png", "second.png"); await settle();
  assert.equal(h.props.selected.id, "first.png");
  assert.deepEqual(normalize(h.props.selected.referencePhotos.map(photo => photo.id)), ["second.png"]);
  h.query.isLoading = true;
  const choices = nodes(h.tree()).filter(node => node.props?.role === "option");
  assert.equal(choices.length, 2); assert.ok(choices.every(node => node.props["aria-selected"]));
  assert.match(text(choices[0]), /Primary/);
  choices[0].props.onClick(); assert.equal(h.props.selected.id, "second.png", "Removing primary promotes the next chosen photo");
});

test("partial upload failures keep successful photos selected and retain the prior primary", async () => {
  const h = photos({ selected: primary, upload: async file => { if (file.name === "fail") throw Error("Invalid image"); return { asset: { id: file.name, url: `/${file.name}` } }; } });
  h.uploadFiles("good", "fail", "also-good"); await settle();
  assert.equal(h.props.selected.id, primary.id);
  assert.deepEqual(normalize(h.props.selected.referencePhotos.map(photo => photo.id)), ["good", "also-good"]);
  assert.match(text(h.tree()), /2 photos added and selected\. Invalid image/);
  assert.equal(h.props.busy, false);
  h.uploadFiles("too-many-1", "too-many-2");
  assert.match(text(h.tree()), /Choose up to 1 more/);
});

test("failed uploads preserve the old selection, duplicate clicks upload once, unmount prevents late selection", async () => {
  let release, calls = 0;
  const h = photos({ selected: primary, upload: () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  h.uploadFiles("pending"); h.uploadFiles("duplicate"); assert.equal(calls, 1);
  h.unmount(); release({ asset: { id: "late", url: "/late" } }); await settle();
  assert.equal(h.props.selected.id, primary.id); assert.equal(h.props.busy, false);
  const failed = photos({ selected: primary, upload: async () => { throw Error("Unavailable"); } });
  failed.uploadFiles("bad"); await settle();
  assert.equal(failed.props.selected, primary); assert.match(text(failed.tree()), /Unavailable/);
});

test("first-slide-only choice creates exactly one paid swap from six generated slides across versions", () => {
  const sources = Array.from({ length: 6 }, (_, i) => ({ slideId: `slide-${i + 1}` }));
  const jobs = [1, 2].flatMap(versionIndex => sources.map((_, i) => ({ jobId: `v${versionIndex}-${i + 1}`, slideshowGeneration: { version: 1, batchKey: "batch", slideIndex: i + 1, slideCount: 6, versionIndex, versionCount: 2 } })));
  assert.deepEqual(planSlideshowFaceSwaps({ jobs, sources, slideIds: ["slide-1"], influencerAssetId: "primary", influencerReferenceAssetIds: ["support"] }), [{ jobId: "v1-1", influencerAssetId: "primary", influencerReferenceAssetIds: ["support"] }]);
});
