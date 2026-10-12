import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { getReferenceImageFileError } from "../../lib/generation/reference-image.ts";

const assetId = "55555555-5555-4555-8555-555555555555";
const image = { kind: "image", asset: { id: assetId, url: "https://owned.test/style.png" } };
const all = (node, match) => !node || typeof node !== "object" ? [] : [
  ...(match(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, match)),
];

function runtime(file, imports) {
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
    exports: exported, crypto, URL, Array, Error,
    require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; },
  });
  return { exported, effects, render: fn => { cursor = 0; return fn(); } };
}

function characterHarness() {
  const submitted = [];
  const builder = {
    access: { data: { access: { affordableImageCount: 3, imageCreditCost: 1, creditsRemaining: 10, isPaid: true } } },
    characters: { data: { characters: [] }, refetch() {} },
    generate: { isPending: false, mutate: request => submitted.push(request) },
    select: { isPending: false }, session: { pendingRequest: null }, selected: null,
    visibleJobs: [], historyImages: [], jobs: {}, history: {},
    chooseCharacter(id) { builder.selected = id ? { id, url: "https://owned.test/saved.png", name: "Saved" } : null; },
  };
  const h = runtime("./character-workspace.tsx", {
    "next/image": { default: "Image" }, "next/link": { default: "Link" },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" }, loading: false }) },
    "@/components/generation/ai-studio-composer": { AiStudioComposer: "Composer", AiStudioSetting: "Setting", AiStudioSettingSelect: "SettingSelect" },
    "@/components/generation/reference-media-upload": { ReferenceMediaUpload: "Upload" },
    "@/lib/characters/image-models": { CHARACTER_IMAGE_MODEL_OPTIONS: [], getCharacterPromptLimit: () => 32000 },
    "./use-character-builder": { useCharacterBuilder: () => builder }, "./character-history": { CharacterHistory: "History" },
    "./character-workspace.module.css": { default: {} },
    "@/components/ui/dialog": { Dialog: "Dialog", DialogContent: "DialogContent", DialogDescription: "DialogDescription", DialogHeader: "DialogHeader", DialogTitle: "DialogTitle" },
  });
  const render = () => h.render(() => { const root = h.exported.CharacterWorkspace({}); return root.type(root.props); });
  const composer = () => all(render(), node => node.type === "Composer")[0].props;
  const upload = () => composer().leadingControl.props;
  composer().onPromptChange("Generate an influencer in a similar style to this.");
  return { builder, submitted, composer, upload, render };
}

test("the character composer submits the attached asset ID with the prompt and never a browser or signed URL", () => {
  const h = characterHarness();
  assert.equal(h.upload().expectedUserId, "owner");
  assert.deepEqual(Array.from(h.upload().allowedKinds), ["image"]);
  h.upload().onChange(image);
  assert.equal(h.composer().generateDisabled, false);
  h.composer().onSubmit();
  assert.equal(h.submitted.length, 1);
  assert.equal(h.submitted[0].referenceImageAssetId, assetId);
  assert.equal(h.submitted[0].prompt, "Generate an influencer in a similar style to this.");
  assert.equal(h.submitted[0].referenceImageUrl, undefined);
  assert.equal(h.submitted[0].referenceCharacterId, undefined);
});

test("upload pending and failed states block button, Enter and stale submit callbacks until explicitly cleared", () => {
  const h = characterHarness();
  const beforeUpload = h.composer();
  h.upload().onPendingChange(true);
  beforeUpload.onSubmit();
  assert.equal(h.composer().generateDisabled, true);
  h.composer().onTextareaKeyDown({ key: "Enter", shiftKey: false, nativeEvent: {}, preventDefault() {} });
  assert.equal(h.submitted.length, 0);
  h.upload().onErrorChange("Upload failed"); h.upload().onPendingChange(false);
  beforeUpload.onSubmit(); h.composer().onSubmit();
  assert.equal(h.composer().generateDisabled, true);
  assert.equal(h.submitted.length, 0);
  h.upload().onErrorChange(null);
  assert.equal(h.composer().generateDisabled, false);
  h.composer().onSubmit();
  assert.equal(h.submitted.length, 1);
});

test("uploading a style image does not require saving an influencer, and removing it permits a prompt-only request", () => {
  const h = characterHarness();
  h.builder.chooseCharacter("44444444-4444-4444-8444-444444444444");
  h.upload().onChange(image);
  assert.equal(h.builder.selected, null);
  assert.equal(h.composer().contextBanner, undefined);
  h.upload().onChange(null); h.composer().onSubmit();
  assert.equal(h.submitted[0].referenceImageAssetId, undefined);
  assert.equal(h.submitted[0].referenceCharacterId, undefined);
});

test("uncertain admissions freeze attachment changes and retry the original request", () => {
  const h = characterHarness();
  h.builder.session.pendingRequest = { mode: "custom", model: "gpt_image", prompt: "Same style", referenceImageAssetId: assetId, idempotencyKey: "original-key" };
  assert.equal(h.upload().disabled, true);
  assert.equal(h.composer().generateDisabled, true);
  h.composer().onSubmit(); assert.equal(h.submitted.length, 0);
  all(h.render(), node => node.type === "Button" && node.props.children === "Retry request")[0].props.onClick();
  assert.equal(h.submitted[0], h.builder.session.pendingRequest);
});

test("a saved reference cannot unmount an active upload or change during an uncertain admission", () => {
  const h = characterHarness();
  h.builder.chooseCharacter("44444444-4444-4444-8444-444444444444");
  const remove = () => all(h.composer().contextBanner, node => node.type === "Button")[0].props;
  assert.equal(remove().disabled, false);
  h.upload().onPendingChange(true);
  assert.equal(remove().disabled, true);
  h.upload().onPendingChange(false);
  h.builder.session.pendingRequest = { mode: "custom", referenceCharacterId: h.builder.selected.id };
  assert.equal(remove().disabled, true);
});

function uploadHarness(upload) {
  const changes = [], pending = [], errors = [], calls = [], events = new Map();
  const h = runtime("../generation/reference-media-upload.tsx", {
    "@/components/generation/reference-upload-preview": { ReferenceUploadPreview: "Preview" },
    "@/lib/generation/reference-image": { getReferenceImageFileError },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: (...args) => { calls.push(args); return upload(...args); } },
  });
  const render = () => h.render(() => h.exported.ReferenceMediaUpload({ allowedKinds: ["image"], expectedUserId: "owner",
    selection: null, onChange: value => changes.push(value), onPendingChange: value => pending.push(value), onErrorChange: value => errors.push(value) }));
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
