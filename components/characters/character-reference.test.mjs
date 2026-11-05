import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { getReferenceImageFileError } from "../../lib/generation/reference-image.ts";

import * as registry from "../../lib/characters/influencer-registry.ts";
import * as compiler from "../../lib/characters/master-prompt-compiler.ts";
import * as references from "../../lib/characters/studio-references.ts";

const assetId = "55555555-5555-4555-8555-555555555555";
const image = { kind: "image", asset: { id: assetId, url: "https://owned.test/style.png" } };
const all = (node, match) => !node || typeof node !== "object" ? [] : [
  ...(match(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, match)),
];

function runtime(file, imports, globals = {}) {
  const values = [], effects = [];
  let cursor = 0;
  const exported = {};
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], value => { values[index] = typeof value === "function" ? value(values[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return values[index] ??= { current: initial }; },
    useCallback: fn => fn,
    useEffect: fn => { effects.push(fn); },
  };
  const modules = {
    react, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "lucide-react": new Proxy({}, { get: (_, name) => name }),
    "@/components/ui/button": { Button: "Button" }, ...imports,
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: exported, crypto, URL, Array, Error, ...globals,
    require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; },
  });
  return { exported, effects, render: fn => { cursor = 0; return fn(); } };
}

// The trait studio replaced the old free-prompt composer. Exercise its current
// admission/reference boundary; shared upload tests below remain unchanged.
function characterHarness(owner = "owner") {
  const submitted = [], prepared = [], saves = [], opened = [], pending = [];
  let fail = false;
  const builder = {
    access: { data: { access: { affordableImageCount: 3 } } },
    characters: { data: { characters: [] } }, generate: { isPending: false, reset() {}, mutateAsync: async request => submitted.push(request) },
    select: { isPending: false, mutate: id => saves.push(id) }, sessionResetVersion: 0,
    session: { pendingRequest: null },
    visibleJobs: [], visibleStatuses: [], history: { data: { pages: [] }, refetch() {}, fetchNextPage() {} },
    touchSession() {}, openHistoryImage: image => opened.push(image), returnToSession() {},
  };
  const h = runtime("./character-workspace.tsx", {
    "next/link": { default: "Link" },
    "@/contexts/auth-context": { useAuth: () => ({ user: owner ? { uid: owner } : null, loading: false }) },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async () => ({ asset: { id: "uploaded-face" } }) },
    "@/lib/characters/image-models": { CHARACTER_STUDIO_IMAGE_MODEL: "gemini_3_pro", getCharacterPromptLimit: () => 32000 },
    "@/lib/characters/influencer-registry": registry,
    "@/lib/characters/master-prompt-compiler": compiler,
    "@/lib/characters/studio-references": references,
    "@/lib/characters/studio-preparation-client": { prepareStudioReferenceAssets: async (id, traits) => { prepared.push({ id, traits }); if (fail) throw Error("Preparation failed"); return traits.map((_, index) => `owned-${index}`); } },
    "./use-character-builder": { useCharacterBuilder: () => builder },
    "./influencer-customizer-dock": { InfluencerCustomizerDock: "Dock" },
    "./influencer-canvas": { InfluencerCanvas: "Canvas" },
    "./character-history": { CharacterHistory: "CharacterHistory" },
    "./influencer-studio.module.css": { default: {} },
  });
  const render = () => h.render(() => { let root = h.exported.CharacterWorkspace({}); while (typeof root.type === "function") root = root.type(root.props); return root; });
  const props = type => all(render(), node => node.type === type)[0].props;
  return { builder, submitted, prepared, saves, opened, pending, render, dock: () => props("Dock"), canvas: () => props("Canvas"), history: () => props("CharacterHistory"), fail: value => { fail = value; } };
}

test("stock references are prepared for the signed-in owner and only ordered owned IDs enter admission", async () => {
  const h = characterHarness(); h.dock().onGenerate(); await flush();
  assert.equal(h.submitted.length, 1); assert.equal(h.prepared[0].id, "owner");
  assert.ok(h.prepared[0].traits.length > 0);
  assert.deepEqual(Array.from(h.submitted[0].referenceImageAssetIds), h.prepared[0].traits.map((_, index) => `owned-${index}`));
  assert.equal(h.submitted[0].referenceImageUrls, undefined);
  assert.ok(h.submitted[0].prompt.length > 100);
  assert.equal(h.submitted[0].model, "gemini_3_pro");
});
test("preparation failure cannot admit a generation and explicit retry recovers", async () => {
  const h = characterHarness(); h.fail(true); h.dock().onGenerate(); await flush();
  assert.equal(h.submitted.length, 0); assert.match(JSON.stringify(h.render()), /Preparation failed/);
  h.fail(false); h.dock().onGenerate(); await flush(); assert.equal(h.submitted.length, 1);
});
test("signed-out generation never prepares references or submits", async () => {
  const h = characterHarness(null); h.dock().onGenerate(); await flush();
  assert.equal(h.prepared.length, 0); assert.equal(h.submitted.length, 0); assert.match(JSON.stringify(h.render()), /Please sign in/);
});
test("batch choice reaches admission while affordability controls the existing button", async () => {
  const h = characterHarness(); h.dock().onBatchSizeChange(3); h.dock().onGenerate(); await flush();
  assert.equal(h.submitted[0].imageCount, 3);
  h.builder.access.data.access.affordableImageCount = 1;
  assert.equal(h.dock().generateDisabled, true);
});
test("the studio retries the saved batch after reload even with changed traits and no available credits", async () => {
  const h = characterHarness();
  const previous = {
    mode: "custom", model: "gemini_3_pro", prompt: "Previous full-body batch", imageCount: 3,
    selection: { ...registry.DEFAULT_INFLUENCER_SELECTION, framing: "full" },
    referenceImageAssetIds: ["earlier-face", "earlier-outfit"],
    idempotencyKey: "previous-character-batch",
  };
  h.builder.session.pendingRequest = previous;
  h.builder.access.data.access.affordableImageCount = 0;
  h.dock().onSelectionChange({ framing: "half" });
  h.fail(true);

  const dock = h.dock();
  assert.equal(dock.selection.framing, "half");
  assert.equal(dock.generateDisabled, false);
  assert.equal(dock.generateLabel, "Retry previous request");
  dock.onGenerate();
  await flush();
  assert.deepEqual(h.submitted, [previous]);
  assert.deepEqual(h.prepared, []);
});
test("pending, restoring and uncertain generation keep trait controls disabled", () => {
  const h = characterHarness();
  for (const flag of ["inProgress", "restoring"]) { h.builder[flag] = true; assert.equal(h.dock().disabled, true); h.builder[flag] = false; }
  h.builder.generate.isPending = true; assert.equal(h.dock().disabled, true);
});
test("history selection preserves the owned receipt and save remains explicit", () => {
  const h = characterHarness(), saved = { jobId: "history-job", url: "https://owned.test/image.png" };
  h.history().onSelect(saved); assert.equal(h.opened[0], saved);
  assert.equal(h.saves.length, 0); h.canvas().onSaveCharacter("history-job"); assert.deepEqual(h.saves, ["history-job"]);
});
test("canvas shows this visit's jobs while history entries remain in the history drawer", () => {
  const h = characterHarness(); h.builder.visibleJobs = [{ jobId: "current" }];
  h.builder.visibleStatuses = [{ id: "current" }, { id: "other" }];
  assert.deepEqual(Array.from(h.canvas().activeJobs, job => job.id), ["current"]);
  const image = { jobId: "saved" }; h.builder.history.data.pages = [{ images: [image] }];
  assert.equal(h.history().images[0], image);
});

function uploadHarness(upload, options = {}) {
  const changes = [], pending = [], errors = [], calls = [], events = new Map();
  const h = runtime("../generation/reference-media-upload.tsx", {
    "@/components/generation/reference-upload-preview": { ReferenceUploadPreview: "Preview" },
    "@/lib/generation/reference-image": { getReferenceImageFileError },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: (...args) => { calls.push(args); return upload(...args); } },
  });
  const render = () => h.render(() => h.exported.ReferenceMediaUpload({ allowedKinds: ["image"], expectedUserId: "owner",
    selection: null, onChange: value => changes.push(value), onPendingChange: value => pending.push(value), onErrorChange: value => errors.push(value), ...options }));
  const tree = render();
  all(tree, node => node.type === "input")[0].props.ref.current = { closest: () => ({
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name),
  }) };
  const cleanup = h.effects.map(effect => effect()).filter(Boolean);
  return { changes, pending, errors, calls, events, render, cleanup: () => cleanup.forEach(fn => fn()),
    choose: file => all(tree, node => node.type === "input")[0].props.onChange({ currentTarget: { files: [file], value: "chosen" } }),
  };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const file = () => new File(["fixture"], "style.png", { type: "image/png" });

test("append mode queues rapid pastes, keeps one pending lock and respects remaining capacity", async () => {
  const finishes = [], h = uploadHarness(() => new Promise(resolve => finishes.push(resolve)), { append: true, referenceCount: 8, maxReferences: 10 });
  const paste = files => h.events.get("paste")({ clipboardData: { files }, preventDefault() {} });
  const first = file(), second = file();
  paste([first]); paste([second]); paste([file()]);
  assert.equal(h.calls.length, 1); assert.match(h.errors.at(-1), /up to 10/);
  finishes[0](image); await flush();
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1][0], second);
  assert.deepEqual(h.pending, [true]);
  finishes[1]({ ...image, asset: { ...image.asset, id: "second" } }); await flush();
  assert.deepEqual(h.changes.map(r => r.asset.id), [assetId, "second"]);
  assert.deepEqual(h.pending, [true, false]); h.cleanup();
});

test("a failed later append retains success and unmount stops queued files and late changes", async () => {
  let calls = 0;
  const failed = uploadHarness(async () => { if (++calls === 2) throw Error("Second image failed"); return image; }, { append: true });
  failed.events.get("drop")({ dataTransfer: { files: [file(), file()] }, preventDefault() {} }); await flush();
  assert.deepEqual(failed.changes, [image]); assert.equal(failed.errors.at(-1), "Second image failed"); failed.cleanup();
  let finish;
  const late = uploadHarness(() => new Promise(resolve => { finish = resolve; }), { append: true });
  late.events.get("paste")({ clipboardData: { files: [file(), file()] }, preventDefault() {} });
  late.cleanup(); finish(image); await flush(); assert.equal(late.calls.length, 1); assert.deepEqual(late.changes, []);
});

test("choosing, pasting and dropping an image upload the file for the original owner and expose pending state", async () => {
  for (const input of ["choose", "paste", "drop"]) {
    let resolve;
    const h = uploadHarness(() => new Promise(done => { resolve = done; }));
    const attached = file(); let prevented = false;
    if (input === "choose") h.choose(attached);
    else h.events.get(input)({ ...(input === "paste" ? { clipboardData: { files: [attached] } } : { dataTransfer: { files: [attached] } }), preventDefault() { prevented = true; } });
    assert.equal(h.calls[0][0], attached); assert.equal(h.calls[0][3], "owner");
    assert.deepEqual(h.pending, [true]); assert.deepEqual(h.changes, []);
    if (input !== "choose") assert.equal(prevented, true);
    resolve(image); await flush();
    assert.deepEqual(h.changes, [image]); assert.deepEqual(h.pending, [true, false]); h.cleanup();
  }
});

test("upload failure remains explicit, invalid files never upload, and late results from an unmounted composer are ignored", async () => {
  const failed = uploadHarness(async () => { throw new Error("Storage failed"); });
  failed.choose(file()); await flush();
  assert.equal(failed.errors.at(-1), "Storage failed"); assert.deepEqual(failed.changes, []);
  all(failed.render(), node => node.type === "Button" && node.props.children === "Remove failed reference")[0].props.onClick();
  assert.equal(failed.errors.at(-1), null); failed.cleanup();
  const invalid = uploadHarness(async () => { throw new Error("Must not upload"); });
  invalid.choose(new File(["svg"], "invalid.svg", { type: "image/svg+xml" }));
  assert.equal(invalid.calls.length, 0); assert.match(invalid.errors.at(-1), /JPG, PNG, or WebP/); invalid.cleanup();
  let resolve;
  const late = uploadHarness(() => new Promise(done => { resolve = done; }));
  late.choose(file()); late.cleanup(); resolve(image); await flush();
  assert.deepEqual(late.changes, []);
});
