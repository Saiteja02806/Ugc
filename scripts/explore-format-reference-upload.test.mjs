import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const savedImage = (id = "saved-image") => ({ id, collection: "image", status: "ready", sourceType: "upload", mimeType: "image/png", projectId: "explore-reference", fileName: "my-reference.png", title: "My reference", url: `https://owned.test/${id}.png` });

function harness(upload, { images = [], queryError = false, fetchSaved = async id => savedImage(id), preview = false, disabled = false, ownerId = "expected-owner" } = {}) {
  const states = [], refs = [], effects = [], changes = [], pending = [], calls = [], queries = [], savedReads = [], cancellations = [];
  const imageCache = new Map([[JSON.stringify(["explore-reference-images", ownerId ?? "signed-out"]), images]]);
  let cursor = 0;
  const imports = {
    react: { useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
      useRef: initial => { const index = cursor++; return refs[index] ??= { current: initial }; }, useEffect: effect => { effects.push(effect); } },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "lucide-react": new Proxy({}, { get: (_, key) => String(key) }),
    "@base-ui/react/tabs": { Tabs: { Root: "TabsRoot", List: "TabsList", Tab: "TabsTab", Panel: "TabsPanel" } },
    "@tanstack/react-query": {
      useQuery: options => { queries.push(options); const data = imageCache.get(JSON.stringify(options.queryKey)); return { data, isPending: data === undefined, isError: queryError, refetch: async () => {} }; },
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
    "@/components/explore/hook-workflow-media-controls": { WorkflowMediaPlayer: "WorkflowMediaPlayer" },
    "@/components/explore/workflow-creation-form": { ReferenceVideoThumbnail: "ReferenceVideoThumbnail" },
    "@/components/explore/workflow-creation.module.css": { default: {} },
    "@/components/explore/workflow-studio.module.css": { default: {} },
    "@/components/explore/use-local-workflow-media": { useLocalWorkflowMedia: () => ({ asset: null, error: null, remove() {} }) },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: (...args) => { calls.push(args); return upload(...args); } },
  };
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/explore/format-generation-references.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports: exported, Error, File, fetch: async () => ({ ok: true, blob: async () => new Blob(["catalog"], { type: "image/png" }) }), require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  function all(node, condition) {
    if (!node || typeof node !== "object") return [];
    return [...(condition(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, condition))];
  }
  const render = () => { cursor = 0; return exported.FormatGenerationReferences({ ownerId, preview, disabled,
    selection: { kind: "image", asset: { url: "https://owned.test/original.png", title: "Original" } },
    onChange: value => changes.push(value), onPendingChange: value => pending.push(value),
  }); };
  const tree = render();
  const cleanups = effects.map(effect => effect()).filter(Boolean);
  return { calls, changes, pending, queries, savedReads, imageCache, cancellations, render, all, cleanup: () => cleanups.forEach(cleanup => cleanup()),
    button(label) { return all(render(), node => node.type === "Button" && node.props["aria-label"] === label)[0]; },
    openImage() { all(render(), node => node.type === "Popover")[0].props.onOpenChange(true); return render(); },
    choose(kind) { all(tree, node => node.type === "input" && node.props["aria-label"] === `Choose optional ${kind} reference`)[0].props.onChange({ currentTarget: { files: [{ name: "reference.mp4" }], value: "selected" } }); },
  };
}
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

test("optional guidance blocks generation while pending and binds the upload to the original owner", async () => {
  let resolve;
  const h = harness(() => new Promise(done => { resolve = done; }));
  h.choose("video");
  assert.deepEqual(h.pending, [true]); assert.deepEqual(h.changes, []);
  assert.equal(h.calls[0][1], "video"); assert.equal(h.calls[0][2], 3); assert.equal(h.calls[0][3], "expected-owner");
  const ready = { kind: "video", asset: { url: "https://owned.test/new.mp4" } };
  resolve(ready); await flush();
  assert.deepEqual(h.changes, [ready]); assert.deepEqual(h.pending, [true, false]);
});
test("failed guidance retains the previous selection and releases the pending state", async () => {
  const h = harness(async () => { throw new Error("Upload failed"); });
  h.choose("video"); await flush();
  assert.deepEqual(h.changes, []); assert.deepEqual(h.pending, [true, false]);
  assert.equal(h.all(h.render(), node => node.props?.role === "alert")[0].props.children, "Upload failed");
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
  assert.equal(h.queries.at(-1).enabled, false);
  const opened = h.openImage();
  assert.equal(h.queries.at(-1).enabled, true);
  assert.equal(JSON.stringify(h.queries.at(-1).queryKey), JSON.stringify(["explore-reference-images", "expected-owner"]));
  assert.equal(h.all(opened, node => node.type === "TabsPanel" && node.props["aria-label"] === "Your images").length, 1);
  assert.equal(h.all(opened, node => node.type === "TabsPanel" && node.props["aria-label"] === "UGC Pilot images").length, 1);
  for (const options of [{ preview: true }, { ownerId: null }]) {
    const isolated = harness(async () => {}, options); isolated.openImage();
    assert.equal(isolated.queries.at(-1).enabled, false);
  }
});

test("new user image uploads are saved immediately, deduplicated, and survive reopening the picker", async () => {
  const ready = { kind: "image", asset: savedImage("new-image") };
  const h = harness(async () => ready, { images: [ready.asset, savedImage("older-image")] });
  h.choose("image"); await flush();
  assert.equal(h.calls[0][3], "expected-owner");
  assert.equal(h.calls[0][4].purpose, "explore-reference");
  assert.equal(h.cancellations.length, 1);
  assert.equal(JSON.stringify(h.cancellations[0].queryKey), JSON.stringify(["explore-reference-images", "expected-owner"]));
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

test("the image picker defaults to saved uploads, otherwise the catalogue, while manual tab changes survive data refresh", () => {
  const root = h => h.all(h.render(), node => node.type === "TabsRoot")[0];
  const saved = harness(async () => {}, { images: [savedImage()] });
  saved.openImage(); assert.equal(root(saved).props.value, "user");
  root(saved).props.onValueChange("catalog"); assert.equal(root(saved).props.value, "catalog");
  saved.openImage(); assert.equal(root(saved).props.value, "user");
  const empty = harness(async () => {}); empty.openImage(); assert.equal(root(empty).props.value, "catalog");
  empty.imageCache.set(JSON.stringify(["explore-reference-images", "expected-owner"]), [savedImage()]);
  assert.equal(root(empty).props.value, "user");
  const manuallyChosen = harness(async () => {}); manuallyChosen.openImage(); root(manuallyChosen).props.onValueChange("catalog");
  manuallyChosen.imageCache.set(JSON.stringify(["explore-reference-images", "expected-owner"]), [savedImage()]);
  assert.equal(root(manuallyChosen).props.value, "catalog");
});

test("a first successful upload switches the open picker to Your images", async () => {
  const h = harness(async () => ({ kind: "image", asset: savedImage() }));
  h.openImage();
  const root = () => h.all(h.render(), node => node.type === "TabsRoot")[0];
  assert.equal(root().props.value, "catalog");
  h.choose("image"); await flush();
  assert.equal(root().props.value, "user");
});
