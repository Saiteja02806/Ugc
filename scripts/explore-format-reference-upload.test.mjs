import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as imagePicker from "../lib/media/image-picker.ts";
import * as personReference from "../lib/explore/person-reference.ts";

import * as imageBatch from "../lib/explore/reference-image-batch.ts";

const savedImage = (id = "saved-image") => ({ id, collection: "image", status: "ready", sourceType: "upload", mimeType: "image/png", projectId: "explore-reference", fileName: "my-reference.png", title: "My reference", url: `https://owned.test/${id}.png` });

function harness(upload, { images = [], queryError = false, queryPending = false, fetchSaved = async id => savedImage(id), preview = false, disabled = false, ownerId = "expected-owner", frames = [], fetchFrame = async frame => frame } = {}) {
  const states = [], refs = [], effects = [], changes = [], selectionChanges = [], pending = [], calls = [], queries = [], savedReads = [], cancellations = [], errors = [];
  const imageCache = new Map([[JSON.stringify(["explore-reference-images", ownerId ?? "signed-out", "explore-only-v2"]), images]]);
  let cursor = 0;
  const imports = {
    "@/lib/media/image-picker": imagePicker,
    "@/lib/explore/hook-starting-frame-history-client": { fetchRecentStartingFrames: async () => frames, fetchRecentStartingFrame: fetchFrame },
    "@/lib/explore/person-reference": personReference,
    "@/components/explore/inline-photo-picker": { InlinePhotoPicker: "InlinePhotoPicker", InlinePhotoPickerTrigger: "InlinePhotoPickerTrigger", InlinePhotoPickerContent: "InlinePhotoPickerContent" },
    "@/components/explore/person-photo-guide": { PersonPhotoGuide: "PersonPhotoGuide" },

    "@/lib/explore/reference-image-batch": imageBatch,
    react: { useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; },
      useRef: initial => { const index = cursor++; return refs[index] ??= { current: initial }; }, useEffect: effect => { effects.push(effect); } },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "lucide-react": new Proxy({}, { get: (_, key) => String(key) }),
    "@base-ui/react/tabs": { Tabs: { Root: "TabsRoot", List: "TabsList", Tab: "TabsTab", Panel: "TabsPanel" } },
    "@tanstack/react-query": {
      useQuery: options => { queries.push(options); const data = options.queryKey[0] === "hook-starting-frames" ? frames : imageCache.get(JSON.stringify(options.queryKey)); return { data, isPending: queryPending || data === undefined, isError: queryError, refetch: async () => {} }; },
      useQueryClient: () => ({ cancelQueries: async options => { cancellations.push(options); }, setQueryData: (key, update) => { const cacheKey = JSON.stringify(key); imageCache.set(cacheKey, update(imageCache.get(cacheKey))); } }),
    },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "@/lib/ai-studio/creator-references": { CREATOR_REFERENCES: [{ id: "creator-01", fileName: "creator-reference-01.png", src: "/catalog.png" }] },
    "@/lib/explore/format-reference-images": {
      USER_REFERENCE_IMAGE_PROJECT: "explore-reference", CATALOG_REFERENCE_IMAGE_PROJECT: "explore-catalog-reference",
      fetchFormatReferenceImages: async () => images,
      fetchFormatReferenceImage: (...args) => { savedReads.push(args); return fetchSaved(...args); },
    },
    "@/components/ui/button": { Button: "Button" },
    "@/components/ui/popover": { Popover: "Popover", PopoverContent: "PopoverContent", PopoverTitle: "PopoverTitle", PopoverTrigger: "PopoverTrigger" },
    "@/components/ui/dialog": { Dialog: "Dialog", DialogContent: "DialogContent", DialogTitle: "DialogTitle", DialogDescription: "DialogDescription", DialogTrigger: "DialogTrigger" },
    "@/components/explore/format-person-image-picker.module.css": { default: {} },
    "@/components/explore/hook-workflow-media-controls": { WorkflowMediaPlayer: "WorkflowMediaPlayer" },
    "@/components/explore/workflow-creation-form": { ReferenceVideoThumbnail: "ReferenceVideoThumbnail" },
    "@/components/explore/workflow-reference-preview": { WorkflowReferencePreview: "ImagePreview" },
    "@/components/explore/workflow-reference-preview.module.css": { default: {} },
    "@/components/explore/workflow-video-layout.module.css": { default: {} },
    "@/components/explore/workflow-creation.module.css": { default: {} },
    "@/components/explore/workflow-studio.module.css": { default: {} },
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({ asset: null, error: null, remove() {} }) },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: (...args) => { calls.push(args); return upload(...args); } },
  };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/format-generation-references.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports: exported, process: { env: { NODE_ENV: "test" } }, Error, File, fetch: async () => ({ ok: true, blob: async () => new Blob(["catalog"], { type: "image/png" }) }), require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  function all(node, condition) {
    if (!node || typeof node !== "object") return [];
    return [...(condition(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, condition))];
  }
  const render = (overrides = {}) => { cursor = 0; return exported.FormatGenerationReferences({ ownerId, preview, disabled,
    selection: { kind: "image", asset: { url: "https://owned.test/original.png", title: "Original" } },
    onChange: (value, kind) => { changes.push(value); selectionChanges.push({ value, kind }); }, onPendingChange: value => pending.push(value), onErrorChange: value => errors.push(value), ...overrides,
  }); };
  const tree = render();
  const cleanups = effects.map(effect => effect()).filter(Boolean);
  return { calls, changes, selectionChanges, pending, errors, queries, savedReads, imageCache, cancellations, render, all, cleanup: () => cleanups.forEach(cleanup => cleanup()),
    button(label) { return all(render(), node => node.type === "Button" && node.props["aria-label"] === label)[0]; },
    openImage() { all(render(), node => node.type === "Dialog")[0].props.onOpenChange(true); return render(); },

    choose(kind) { all(tree, node => node.type === "input" && node.props["aria-label"] === `Choose optional ${kind} reference`)[0].props.onChange({ currentTarget: { files: [new File(["reference"], kind === "image" ? "reference.png" : "reference.mp4", {type: kind === "image" ? "image/png" : "video/mp4"})], value: "selected" } }); },
  };
}
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

test("face-photo removal stays available when its add/change picker is disabled for the selected model", () => {
  const h = harness(async () => assert.fail("No uploads"));
  const photos = [{ kind: "image", asset: savedImage("first") }, { kind: "image", asset: savedImage("second") }];
  const updates = [];
  const tree = h.render({ selection: photos[0], imageSelections: photos, imagePurpose: "person", imagePresentation: "person-strip",
    inlineImagePicker: true, imagePickerDisabled: true, videoInputEnabled: false, onImagesChange: next => updates.push(next) });
  const trigger = h.all(tree, node => node.type === "InlinePhotoPickerTrigger")[0];
  assert.equal(trigger.props.render.props.disabled, true);
  const visiblePhotos = h.all(tree, node => node.type === "ImagePreview");
  assert.equal(visiblePhotos.length, 2);
  assert.equal(visiblePhotos[0].props.disabled, false);
  assert.equal(typeof visiblePhotos[0].props.onRemove, "function");
  visiblePhotos[0].props.onRemove();
  assert.deepEqual(Array.from(updates[0], image => image.asset.id), ["second"]);
});

test("a scene-only chooser exposes only starting-frame history without image uploads", () => {
  const h = harness(async () => assert.fail("No uploads"));
  const options = { selection: null, startingFramesOnly: true, startingFrame: { assetId: "frame", url: "https://owned.test/frame.png", width: 720, height: 1280 }, onSelectStartingFrame() {}, videoInputEnabled: false };
  let tree = h.render(options);
  h.all(tree, node => node.type === "Dialog")[0].props.onOpenChange(true); tree = h.render(options);
  assert.deepEqual(h.all(tree, node => node.type === "TabsTab").map(node => node.props.value), ["starting"]);
  assert.equal(h.all(tree, node => node.type === "input" && node.props.type === "file")[0].props.disabled, true);
});

test("one image tile opens saved influencers and uploads in the same chooser", async () => {
  const h = harness(async () => {});
  const selected = [];
  const library = { images: [{ jobId: "generated-job", mediaAssetId: "generated-image", url: "https://owned.test/person.png" }],
    loading: false, error: null, selectionError: null, hasMore: true, loadingMore: false, onRetry() {}, onLoadMore() {},
    onSelect: async image => { selected.push(image.mediaAssetId); return true; } };
  const options = { selection: null, imagePurpose: "person", videoInputEnabled: false, influencerLibrary: library };
  let tree = h.render(options);
  const triggers = h.all(tree, node => node.type === "DialogTrigger");
  assert.equal(triggers.length, 1); assert.equal(triggers[0].props.render.props["aria-label"], "Choose image");
  h.all(tree, node => node.type === "Dialog")[0].props.onOpenChange(true); tree = h.render(options);
  assert.equal(h.all(tree, node => node.type === "TabsRoot")[0].props.value, "influencers");
  assert.deepEqual(h.all(tree, node => node.type === "TabsTab").map(node => node.props.value), ["influencers", "user"]);
  h.all(tree, node => node.props?.["aria-label"] === "Use saved influencer 1")[0].props.onClick(); await flush(); tree = h.render(options);
  assert.deepEqual(selected, ["generated-image"]); assert.equal(h.all(tree, node => node.type === "Dialog")[0].props.open, true);
  assert.equal(h.calls.length, 0, "Selecting an existing influencer never uploads or generates again");
});

test("failed influencer selection keeps the chooser open and preserves the previous photos", async () => {
  const h = harness(async () => {});
  const options = { selection: null, videoInputEnabled: false, influencerLibrary: { images: [{ jobId: "job", mediaAssetId: "image", url: "https://owned.test/person.png" }],
    loading: false, error: null, selectionError: "This photo is unavailable.", hasMore: false, loadingMore: false, onRetry() {}, onLoadMore() {}, onSelect: async () => false } };
  let tree = h.render(options); h.all(tree, node => node.type === "Dialog")[0].props.onOpenChange(true); tree = h.render(options);
  h.all(tree, node => node.props?.["aria-label"] === "Use saved influencer 1")[0].props.onClick(); await flush(); tree = h.render(options);
  assert.equal(h.all(tree, node => node.type === "Dialog")[0].props.open, true); assert.equal(h.changes.length, 0);
});

test("compact face strip shows all photos without roles and opens the photo chooser", () => {
  const h = harness(async () => {});
  const selected = [1, 2, 3].map(id => ({ kind: "image", asset: savedImage(`face-${id}`) }));
  const options = { selection: null, imageSelections: selected, imagePurpose: "person", imagePresentation: "person-strip", videoInputEnabled: false, onImagesChange() {} };
  const tree = h.render(options);
  const previews = h.all(tree, node => node.type === "ImagePreview");
  assert.equal(previews.length, 3);
  assert.match(previews[0].props.name, /^Photo 1:/);
  assert.match(previews[1].props.name, /^Photo 2:/);
  assert.match(previews[2].props.name, /^Photo 3:/);
  const trigger = h.all(tree, node => node.type === "DialogTrigger")[0];
  assert.equal(trigger.props.render.props["aria-label"], "Change photos");
  h.all(tree, node => node.type === "Dialog")[0].props.onOpenChange(true);
  const opened = h.render(options);
  assert.equal(h.all(opened, node => node.type === "Dialog")[0].props.open, true);
  assert.equal(h.all(opened, node => node.type === "Button" && node.props["aria-label"] === "Make photo 2 the main face photo").length, 0);
  assert.equal(h.calls.length, 0);
  const legacy = h.render({ ...options, imagePresentation: "tile" });
  assert.equal(h.all(legacy, node => node.type === "ImagePreview").length, 1, "other workflows retain their existing person tile");
});

test("optional guidance blocks generation while pending and binds the upload to the original owner", async () => {
  let resolve;
  const h = harness(() => new Promise(done => { resolve = done; }));
  h.choose("video");
  assert.deepEqual(h.pending, [true]); assert.deepEqual(h.changes, []);
  assert.equal(h.calls[0][1], "video"); assert.equal(h.calls[0][2], 10); assert.equal(h.calls[0][3], "expected-owner");
  const ready = { kind: "video", asset: { url: "https://owned.test/new.mp4" } };
  resolve(ready); await flush();
  assert.deepEqual(h.changes, [ready]); assert.deepEqual(h.pending, [true, false]);
});
test("failed guidance retains the previous selection and releases the pending state", async () => {
  const h = harness(async () => { throw new Error("Upload failed"); });
  h.choose("video"); await flush();
  assert.deepEqual(h.changes, []); assert.deepEqual(h.pending, [true, false]);
  assert.deepEqual(h.errors, [null, "Upload failed"], "The generation owner must know the replacement failed");
  assert.equal(h.all(h.render(), node => node.props?.role === "alert")[0].props.children, "Upload failed");
  const cancel = h.all(h.render(), node => node.type === "Button" && node.props.children === "Cancel reference change")[0];
  cancel.props.onClick();
  assert.deepEqual(h.changes, [], "Cancelling the failed change retains the previously accepted reference");
  assert.deepEqual(h.errors, [null, "Upload failed", null]);
});
test("an unmounted owner's late upload cannot select media in the next workflow session", async () => {
  let resolve;
  const h = harness(() => new Promise(done => { resolve = done; }));
  h.choose("video"); h.cleanup();
  resolve({ kind: "video", asset: { url: "https://owned.test/late.mp4" } }); await flush();
  assert.deepEqual(h.changes, []); assert.deepEqual(h.pending, [true, false]);
});

test("saved images load only when the image picker opens and stay scoped to its owner", () => {
  const h = harness(async () => {}, { images: [savedImage()] });
  assert.equal(h.queries.filter(q => q.queryKey[0] === "explore-reference-images").at(-1).enabled, false);
  const opened = h.openImage();
  assert.equal(h.queries.filter(q => q.queryKey[0] === "explore-reference-images").at(-1).enabled, true);
  assert.equal(JSON.stringify(h.queries.filter(q => q.queryKey[0] === "explore-reference-images").at(-1).queryKey), JSON.stringify(["explore-reference-images", "expected-owner", "explore-only-v2"]));
  assert.equal(h.all(opened, node => node.type === "TabsPanel" && node.props["aria-label"] === "Uploaded photos").length, 1);
  assert.equal(h.all(opened, node => node.type === "TabsPanel" && node.props["aria-label"] === "UGC Pilot images").length, 1);
  for (const options of [{ preview: true }, { ownerId: null }]) {
    const isolated = harness(async () => {}, options); isolated.openImage();
    assert.equal(isolated.queries.filter(q => q.queryKey[0] === "explore-reference-images").at(-1).enabled, false);
  }
});

test("new user image uploads are saved immediately, deduplicated, and survive reopening the picker", async () => {
  const ready = { kind: "image", asset: savedImage("new-image") };
  const h = harness(async () => ready, { images: [ready.asset, savedImage("older-image")] });
  h.choose("image"); await flush();
  assert.equal(h.calls[0][3], "expected-owner");
  assert.equal(h.calls[0][4].purpose, "explore-reference");
  assert.equal(h.cancellations.length, 1);
  assert.equal(JSON.stringify(h.cancellations[0].queryKey), JSON.stringify(["explore-reference-images", "expected-owner", "explore-only-v2"]));
  assert.deepEqual(h.changes, [ready]); assert.deepEqual(h.pending, [true, false]);
  assert.equal(h.imageCache.values().next().value.length, 2);
  h.openImage();
  assert.ok(h.button("Use your image my-reference.png"));
});

test("reusing an owned saved image resolves its current record without a new upload", async () => {
  let resolve;
  const h = harness(async () => { throw new Error("Reusing must not upload"); }, { images: [savedImage()], fetchSaved: () => new Promise(done => { resolve = done; }) });
  h.button("Use your image my-reference.png").props.onClick();
  assert.deepEqual(h.pending, [true]); assert.deepEqual(h.changes, []);
  assert.deepEqual(h.savedReads, [["saved-image", "expected-owner"]]);
  const current = { ...savedImage(), url: "https://owned.test/current.png" }; resolve(current); await flush();
  assert.equal(h.calls.length, 0); assert.equal(h.changes[0].asset, current);
  assert.equal(h.changes[0].kind, "image"); assert.deepEqual(h.pending, [true, false]);
});

test("deleted or inaccessible saved images retain the current reference and owner changes discard late reads", async () => {
  const failed = harness(async () => {}, { images: [savedImage()], fetchSaved: async () => { throw new Error("Image was deleted"); } });
  failed.button("Use your image my-reference.png").props.onClick(); await flush();
  assert.deepEqual(failed.changes, []); assert.deepEqual(failed.pending, [true, false]);
  assert.ok(failed.all(failed.render(), node => node.props?.role === "alert" && node.props.children === "Image was deleted").length);
  let resolve;
  const late = harness(async () => {}, { images: [savedImage()], fetchSaved: () => new Promise(done => { resolve = done; }) });
  late.button("Use your image my-reference.png").props.onClick(); late.cleanup(); resolve(savedImage()); await flush();
  assert.deepEqual(late.changes, []); assert.deepEqual(late.pending, [true, false]);
});

test("catalogue uploads stay separate from Your images and remain usable during a library error", async () => {
  const h = harness(async () => ({ kind: "image", asset: { ...savedImage("catalog-copy"), projectId: "explore-catalog-reference" } }), { queryError: true });
  assert.equal(h.button("Use creator 1").props.disabled, false);
  h.button("Use creator 1").props.onClick(); await flush();
  assert.equal(h.calls[0][4].purpose, "explore-catalog-reference");
  assert.equal(h.changes.length, 1); assert.equal(h.imageCache.values().next().value.length, 0);
  assert.equal(h.cancellations.length, 0);
});

test("disabled controls cannot reuse saved images or start catalogue uploads", async () => {
  const h = harness(async () => { throw new Error("Must stay disabled"); }, { disabled: true, images: [savedImage()] });
  const own = h.button("Use your image my-reference.png"), catalog = h.button("Use creator 1");
  assert.equal(own.props.disabled, true); assert.equal(catalog.props.disabled, true);
  own.props.onClick(); catalog.props.onClick(); await flush();
  assert.deepEqual(h.pending, []); assert.equal(h.calls.length, 0); assert.equal(h.savedReads.length, 0);
});

test("the image picker defaults to uploaded photos even when empty, while manual source choices survive refresh", () => {
  const root = h => h.all(h.render(), node => node.type === "TabsRoot")[0];
  const saved = harness(async () => {}, { images: [savedImage()] });
  saved.openImage(); assert.equal(root(saved).props.value, "user");
  root(saved).props.onValueChange("catalog"); assert.equal(root(saved).props.value, "catalog");
  saved.openImage(); assert.equal(root(saved).props.value, "user");
  const empty = harness(async () => {}); empty.openImage(); assert.equal(root(empty).props.value, "user");
  empty.imageCache.set(JSON.stringify(["explore-reference-images", "expected-owner", "explore-only-v2"]), [savedImage()]);
  assert.equal(root(empty).props.value, "user");
  const manuallyChosen = harness(async () => {}); manuallyChosen.openImage(); root(manuallyChosen).props.onValueChange("catalog");
  manuallyChosen.imageCache.set(JSON.stringify(["explore-reference-images", "expected-owner", "explore-only-v2"]), [savedImage()]);
  assert.equal(root(manuallyChosen).props.value, "catalog");
});

test("a first successful upload switches the open picker to Your images", async () => {
  const h = harness(async () => ({ kind: "image", asset: savedImage() }));
  h.openImage();
  const root = () => h.all(h.render(), node => node.type === "TabsRoot")[0];
  assert.equal(root().props.value, "user");
  h.choose("image"); await flush();
  assert.equal(root().props.value, "user");
});

test("tile removal detaches only the chosen image and preserves the ordered collection", () => {
  const h = harness(async () => {});
  const images = ["first", "middle", "last"].map(id => ({ kind: "image", asset: savedImage(id) }));
  const updates = [];
  const previews = h.all(h.render({ imageSelections: images, onImagesChange: next => updates.push(next) }), node => node.type === "ImagePreview");
  previews[1].props.onRemove();
  assert.deepEqual(Array.from(updates[0], image => image.asset.id), ["first", "last"]);
  assert.deepEqual(h.changes, [], "An image removal must not clear the video or the whole selection");
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.errors, [null]);
});

test("person photos have no role controls and removal preserves the remaining order", () => {
  const h = harness(async () => {});
  let images = ["front", "left", "right"].map(id => ({ kind: "image", asset: savedImage(id) }));
  const props = () => ({ imagePurpose: "person", imageSelections: images, onImagesChange: next => { images = next; } });
  const tree = () => h.render(props());
  assert.equal(h.all(tree(), node => node.type === "PersonPhotoGuide").length, 1);
  assert.equal(h.all(tree(), node => /main|support/i.test(node.props?.["aria-label"] ?? "")).length, 0);
  h.all(tree(), node => node.props?.["aria-label"] === "Remove photo 2")[0].props.onClick();
  assert.deepEqual(Array.from(images, image => image.asset.id), ["front", "right"]);
  h.all(tree(), node => node.props?.["aria-label"] === "Remove photo 1")[0].props.onClick();
  assert.deepEqual(Array.from(images, image => image.asset.id), ["right"]);
  assert.equal(h.calls.length, 0);
});

test("busy person selections cannot remove photos", () => {
  const h = harness(async () => {}, { disabled: true });
  let changes = 0;
  const tree = h.render({ imagePurpose: "person", imageSelections: ["one", "two"].map(id => ({ kind: "image", asset: savedImage(id) })), onImagesChange: () => changes++ });
  const remove = h.all(tree, node => node.props?.["aria-label"] === "Remove photo 2")[0];
  assert.equal(remove.props.disabled, true); remove.props.onClick();
  assert.equal(changes, 0);
});

test("tile removal clears a gallery video through its gallery owner and an uploaded video through its video owner", () => {
  const h = harness(async () => {});
  let cleared = 0;
  const gallery = h.all(h.render({ styleVideo: { name: "Gallery clip", url: "https://gallery.test/clip.mp4" }, onClearStyle: () => cleared++ }), node => node.type === "ImagePreview" && node.props.kind === "video")[0];
  gallery.props.onRemove();
  assert.equal(cleared, 1);
  assert.deepEqual(h.changes, [], "Removing a gallery reference must not clear appearance images");
  const uploaded = h.all(h.render({ videoSelection: { kind: "video", asset: { url: "https://owned.test/clip.mp4", title: "Owned clip" } } }), node => node.type === "ImagePreview" && node.props.kind === "video")[0];
  uploaded.props.onRemove();
  assert.deepEqual(h.selectionChanges, [{ value: null, kind: "video" }]);
});

test("single-image callers retain their removal contract and busy tiles cannot change accepted references", async () => {
  const single = harness(async () => {});
  single.all(single.render(), node => node.type === "ImagePreview")[0].props.onRemove();
  assert.deepEqual(single.selectionChanges, [{ value: null, kind: "image" }]);
  for (const disabled of [true, false]) {
    let resolve;
    const h = harness(() => new Promise(done => { resolve = done; }), { disabled });
    if (!disabled) h.choose("video");
    let cleared = 0;
    const tree = h.render({ styleVideo: { name: "Gallery clip", url: "https://gallery.test/clip.mp4" }, onClearStyle: () => cleared++ });
    for (const tile of h.all(tree, node => node.type === "ImagePreview")) {
      assert.equal(tile.props.disabled, true);
      tile.props.onRemove();
    }
    assert.deepEqual(h.changes, []);
    assert.equal(cleared, 0);
    resolve?.({ kind: "video", asset: { url: "https://owned.test/new.mp4" } }); await flush();
  }
});

test("audio guidance stays distinct from video and receives the selected model's upload limits", async () => {
  const ready = { kind: "audio", asset: { id: "voice", url: "https://owned.test/voice.mp3", title: "Voice" } };
  const h = harness(async () => ready);
  const tree = h.render({ audioInputEnabled: true, maxVideoDuration: 15, maxAudioDuration: 15, preserveVideoTiming: false });
  h.all(tree, node => node.type === "input" && node.props["aria-label"] === "Choose optional audio reference")[0].props.onChange({ currentTarget: { files: [new File(["audio"], "voice.mp3", { type: "audio/mpeg" })], value: "selected" } });
  await flush();
  assert.equal(h.calls[0][1], "audio"); assert.equal(h.calls[0][3], "expected-owner");
  assert.equal(h.calls[0][4].maxAudioDurationSeconds, 15); assert.equal(h.calls[0][4].requireVideoReferenceRatio, false);
  assert.deepEqual(h.selectionChanges, [{ value: ready, kind: "audio" }]);
  const retained = h.render({ audioSelection: ready, audioInputEnabled: false });
  const input = h.all(retained, node => node.type === "input" && node.props["aria-label"] === "Choose optional audio reference")[0];
  assert.equal(input.props.disabled, true, "Unsupported model changes keep the selected audio available to remove");
  const preview = h.all(retained, node => node.type === "ImagePreview" && node.props.kind === "voice")[0];
  preview.props.onRemove(); assert.deepEqual(h.selectionChanges.at(-1), { value: null, kind: "audio" });
});

test("adding image references retains three ordered image/video/audio slots; hidden inputs retain their existing slots", () => {
  const h = harness(async () => {});
  for (const count of [0, 1, 2, 6]) {
    const images = Array.from({ length: count }, (_, index) => ({ kind: "image", asset: savedImage(`reference-${index}`) }));
    const tree = h.render({ selection: null, imageSelections: images, audioInputEnabled: true, onImagesChange() {} });
    const grid = h.all(tree, node => node.props?.["data-workflow-reference-grid"])[0];
    assert.equal(grid.props["data-reference-columns"], 3);
    const slots = h.all(grid, node => node.type === "input");
    assert.deepEqual(slots.map(node => node.props["aria-label"]), ["Choose optional image reference", "Choose optional video reference", "Choose optional audio reference"]);
  }
  const two = h.render({ selection: null, videoInputEnabled: true, audioInputEnabled: false });
  assert.equal(h.all(two, node => node.props?.["data-workflow-reference-grid"])[0].props["data-reference-columns"], 2);
  const retained = h.render({ selection: null, audioInputEnabled: false, audioSelection: { kind: "audio", asset: { id: "voice", url: "https://owned.test/voice.mp3" } } });
  assert.equal(h.all(retained, node => node.props?.["data-workflow-reference-grid"])[0].props["data-reference-columns"], 3);
});

test("WAN timed-reference image limits reject an oversized saved image without clearing the current selection", async () => {
  const h = harness(async () => {}, { images: [savedImage()], fetchSaved: async () => ({ ...savedImage(), fileSizeBytes: 17 * 1024 ** 2 }) });
  const tree = h.render({ maxImageBytes: 16 * 1024 ** 2 });
  h.all(tree, node => node.type === "Button" && node.props["aria-label"] === "Use your image my-reference.png")[0].props.onClick(); await flush();
  assert.equal(h.changes.length, 0); assert.match(h.errors.at(-1), /16 MB/);
});

test("image picker keeps multiple saved/catalogue selections open with toggles and a capacity count", async () => {
  const assets = ["one", "two", "three"].map(id => ({ ...savedImage(id), fileName: `${id}.png` }));
  const h = harness(async () => ({ kind: "image", asset: { ...savedImage("catalog"), fileName: "creator-reference-01.png", projectId: "explore-catalog-reference" } }), { images: assets, fetchSaved: async id => assets.find(asset => asset.id === id) });
  let selected = [];
  const render = () => h.render({ selection: null, imageSelections: selected, maxImages: 2,
    onChange: value => { selected = [...selected, value]; }, onImagesChange: images => { selected = images; } });
  const button = label => h.all(render(), node => node.type === "Button" && node.props["aria-label"] === label)[0];
  const popover = () => h.all(render(), node => node.type === "Dialog")[0];
  const count = () => h.all(render(), node => node.props?.role === "status").find(node => typeof node.props.children === "string" && node.props.children.endsWith(" images selected"));

  popover().props.onOpenChange(true);
  assert.ok(h.all(button("Use your image one.png"), node => node.type === "span" && node.props.className?.includes("border-2")).length, "Every thumbnail has a visible checkbox");
  button("Use your image one.png").props.onClick(); await flush();
  assert.equal(popover().props.open, true);
  assert.equal(button("Use your image one.png").props["aria-pressed"], true);
  assert.equal(h.all(button("Use your image one.png"), node => node.type === "Check").length, 1);
  button("Use creator 1").props.onClick(); await flush();
  assert.equal(popover().props.open, true);
  assert.deepEqual(selected.map(image => image.asset.id), ["one", "catalog"]);
  assert.equal(button("Use creator 1").props["aria-pressed"], true);
  assert.equal(button("Use your image two.png").props.disabled, true);
  assert.equal(button("Use your image one.png").props.disabled, false);
  assert.equal(count().props.children, "2 of 2 images selected");

  button("Use creator 1").props.onClick(); await flush();
  assert.deepEqual(Array.from(selected, image => image.asset.id), ["one"]);
  assert.equal(button("Use creator 1").props["aria-pressed"], false);
  button("Use your image two.png").props.onClick(); await flush();
  button("Use your image one.png").props.onClick(); await flush();
  assert.deepEqual(Array.from(selected, image => image.asset.id), ["two"]);
  assert.equal(h.savedReads.length, 2, "Deselecting must not upload or fetch again");
  h.all(render(), node => node.type === "Button" && node.props.children === "Done")[0].props.onClick();
  assert.equal(popover().props.open, false);
  popover().props.onOpenChange(true);
  assert.equal(button("Use your image two.png").props["aria-pressed"], true);
});

test("one file-picker action uploads multiple images, preserves input order and existing selections after a partial failure", async () => {
  const original={kind:"image",asset:savedImage("original")};
  const h=harness(async file=>{
    if(file.name==='bad.png')throw Error('Upload failed');
    return {kind:'image',asset:{...savedImage(file.name),fileName:file.name}};
  });
  const selections=[];
  const tree=h.render({selection:null,imageSelections:[original],maxImages:5,onImagesChange:items=>selections.push(items)});
  const input=h.all(tree,node=>node.type==='input'&&node.props['aria-label']==='Choose optional image reference')[0];
  assert.equal(input.props.multiple,true);
  input.props.onChange({currentTarget:{files:['one.png','bad.png','two.png'].map(name=>new File(['image'],name,{type:'image/png'})),value:'selected'}});
  await flush();await flush();
  assert.equal(h.calls.length,3);assert.equal(selections.length,1);
  assert.deepEqual(Array.from(selections[0],image=>image.asset.id),['original','one.png','two.png']);
  assert.match(h.errors.at(-1),/2 added.*bad.png.*Upload failed/);
  assert.deepEqual(h.pending,[true,false]);
});

test("over-limit multiple files are rejected before uploading, and single-image callers keep a single-file chooser", async()=>{
  const h=harness(async()=>{throw Error('Must not upload');});
  const tree=h.render({selection:null,imageSelections:[{kind:'image',asset:savedImage()}],maxImages:2,onImagesChange(){}});
  const input=h.all(tree,node=>node.type==='input'&&node.props['aria-label']==='Choose optional image reference')[0];
  input.props.onChange({currentTarget:{files:['one.png','two.png'].map(name=>new File(['image'],name,{type:'image/png'})),value:'selected'}});
  await flush();assert.equal(h.calls.length,0);assert.match(h.errors.at(-1),/1 more image/);
  const single=h.all(h.render(),node=>node.type==='input'&&node.props['aria-label']==='Choose optional image reference')[0];
  assert.equal(single.props.multiple,false);
});

test("the first picker page is bounded and does not start catalogue images while saved images load",()=>{
  const assets=Array.from({length:100},(_,i)=>({...savedImage(String(i)),fileName:`${i}.png`}));
  const h=harness(async()=>{}, {images:assets});
  const tree=h.openImage();
  assert.equal(h.all(tree,node=>node.type==='Button'&&node.props['aria-label']?.startsWith('Use your image ')).length,24);
  const more=h.all(tree,node=>node.type==='Button'&&node.props.children==='Load more images')[0];assert.ok(more);
  more.props.onClick();
  assert.equal(h.all(h.render(),node=>node.type==='Button'&&node.props['aria-label']?.startsWith('Use your image ')).length,48);
  h.openImage();
  assert.equal(h.all(h.render(),node=>node.type==='Button'&&node.props['aria-label']?.startsWith('Use your image ')).length,24);
  assert.equal(h.queries.filter(q => q.queryKey[0] === "explore-reference-images").at(-1).staleTime,60_000);
  const empty=harness(async()=>{}, {queryPending:true});empty.openImage();
  assert.equal(empty.all(empty.render(),node=>node.type==='TabsRoot')[0].props.value,'user');
});

test("an image batch cannot append late uploads or start queued files after its owner unmounts",async()=>{
  const completions=[];
  const h=harness(file=>new Promise(resolve=>completions.push(()=>resolve({kind:'image',asset:savedImage(file.name)}))));
  const appended=[];
  const tree=h.render({selection:null,imageSelections:[],maxImages:5,onImagesChange:items=>appended.push(items)});
  const input=h.all(tree,node=>node.type==='input'&&node.props['aria-label']==='Choose optional image reference')[0];
  const event=()=>({currentTarget:{files:['one.png','two.png','three.png'].map(name=>new File(['image'],name,{type:'image/png'})),value:'selected'}});
  input.props.onChange(event());
  input.props.onChange(event());
  assert.equal(h.calls.length,2,'Two simultaneous uploads; a second click cannot launch another batch');
  h.cleanup();completions.forEach(complete=>complete());await flush();await flush();
  assert.equal(h.calls.length,2);assert.deepEqual(appended,[]);assert.deepEqual(h.pending,[true,false]);
  assert.equal(h.cancellations.length,0,'Late records must not enter the next owner’s cache');
});


test("starting frame chooser opens recent scenes and selects the verified frame without adding person photos", async () => {
  const frames = [1, 2].map(n => ({ ownerId: "expected-owner", assetId: `asset-${n}`, jobId: `job-${n}`, url: `https://owned.test/frame-${n}.png`, width: 720, height: 1280 }));
  const reads = [], chosen = [];
  const h = harness(async () => assert.fail("No uploads"), { frames, fetchFrame: async (frame, owner) => { reads.push([frame, owner]); return { ...frame, motionInstructions: "Verified motion" }; } });
  const props = { selection: null, startingFrame: frames[0], onSelectStartingFrame: frame => chosen.push(frame), videoInputEnabled: false };
  let tree = h.render(props);
  assert.equal(h.all(tree, node => node.props?.style?.["--starting-frame-ratio"])[0].props.style["--starting-frame-ratio"], 9 / 16);
  assert.equal(h.all(tree, node => node.props?.["data-starting-frame"] === true).length, 1);
  assert.equal(h.all(tree, n => n.type === "DialogTrigger")[0].props.render.props["aria-label"], "Change starting frame");
  h.all(tree, n => n.type === "Dialog")[0].props.onOpenChange(true); tree = h.render(props);
  assert.equal(h.all(tree, n => n.type === "TabsRoot")[0].props.value, "starting");
  assert.equal(h.queries.filter(q => q.queryKey[0] === "hook-starting-frames").at(-1).enabled, true);
  h.all(tree, n => n.props?.["aria-label"] === "Use saved starting frame 2")[0].props.onClick(); await flush();
  assert.equal(reads[0][1], "expected-owner"); assert.equal(chosen[0].assetId, "asset-2");
  assert.equal(chosen[0].motionInstructions, "Verified motion"); assert.equal(h.changes.length, 0);
  assert.equal(h.all(h.render(props), n => n.type === "Dialog")[0].props.open, false);
});

test("failed or late starting frame reads retain the selected image", async () => {
  const frame = { assetId: "old", jobId: "job", url: "https://owned.test/old.png" };
  for (const unmount of [false, true]) {
    let finish; const chosen = [];
    const h = harness(async () => {}, { frames: [frame], fetchFrame: () => new Promise((resolve, reject) => { finish = unmount ? () => resolve(frame) : () => reject(new Error("Frame deleted")); }) });
    const props = { startingFrame: frame, onSelectStartingFrame: value => chosen.push(value) };
    let tree = h.render(props); h.all(tree, n => n.type === "Dialog")[0].props.onOpenChange(true); tree = h.render(props);
    h.all(tree, n => n.props?.["aria-label"] === "Use saved starting frame 1")[0].props.onClick();
    if (unmount) h.cleanup(); finish(); await flush(); assert.equal(chosen.length, 0); assert.equal(h.changes.length, 0);
    if (!unmount) assert.ok(h.errors.includes("Frame deleted"));
  }
});
