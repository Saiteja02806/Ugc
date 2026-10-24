import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as referenceFiles from "../lib/ai-studio/reference-files.ts";

function harness(upload, overrides = {}) {
  const states = [], refs = [], effects = [], calls = [], changes = [], errors = [], pending = [];
  let cursor = 0;
  const onPendingChange = value => pending.push(value);
  const source = readFileSync(new URL("../components/video/reference-files-upload.tsx", import.meta.url), "utf8");
  const imports = {
    react: {
      useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; },
      useRef(initial) { const index = cursor++; return refs[index] ??= { current: initial }; },
      useEffect(effect) { effects.push(effect); }, useCallback: callback => callback,
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "lucide-react": { Plus: "Plus", Loader2: "Loader2" },
    "@/components/generation/reference-upload-preview": { ReferenceUploadPreview: "ReferenceUploadPreview" },
    "@/components/ui/button": { Button: "Button" },
    "@/lib/ai-studio/reference-files": referenceFiles,
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia(...args) { calls.push(args); return upload(...args); } },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports: exported, URL, Error, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  const props = { active: false, disabled: false, expectedUserId: "audit-owner", allowedKinds: ["image", "video", "audio"], maxFiles: 6, maxVideoDurationSeconds: 15, maxAudioDurationSeconds: 15,
    maxImageBytes: 20 * 1024 ** 2, maxTimedImageBytes: 16 * 1024 ** 2, maxVideoBytes: 32 * 1024 ** 2, maxAudioBytes: 25 * 1024 ** 2,
    selections: [], onPendingChange, onErrorChange: value => errors.push(value), onChange: value => { changes.push(value); props.selections = value; }, ...overrides };
  const render = () => { cursor = 0; return exported.ReferenceFilesUpload(props); };
  function all(node, predicate) { if (!node || typeof node !== "object") return []; return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, predicate))]; }
  const tree = render();
  const cleanup = effects.splice(0).map(effect => effect()).filter(Boolean);
  return { calls, changes, errors, pending, all, render, unmount() { for (const fn of cleanup) fn(); },
    choose(files) { all(tree, node => node.type === "input")[0].props.onChange({ currentTarget: { files, value: "selected" } }); } };
}
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
const file = (kind, suffix = "") => new File(["audit"], `${kind}${suffix}.${kind === "image" ? "png" : kind === "video" ? "mp4" : "mp3"}`, { type: kind === "image" ? "image/png" : kind === "video" ? "video/mp4" : "audio/mpeg" });
const ready = (file, kind) => ({ kind, asset: { id: file.name, url: `https://owned.test/${file.name}`, title: file.name } });

test("mixed reference uploads use the exact owner and timed limits without forcing source framing", async () => {
  const h = harness(async (file, kind) => ready(file, kind));
  h.choose([file("image"), file("video"), file("audio")]); await flush();
  assert.equal(h.calls.length, 3); assert.equal(h.changes.at(-1).length, 3);
  for (const call of h.calls) {
    assert.equal(call[2], 15); assert.equal(call[3], "audit-owner");
    assert.equal(call[4].maxAudioDurationSeconds, 15); assert.equal(call[4].requireVideoReferenceRatio, false);
  }
  assert.deepEqual(h.pending, [true, false]); assert.deepEqual(h.errors, [null]);
});

test("an incomplete upload batch keeps accepted inputs but tells the generator to block", async () => {
  const old = ready(file("image", "old"), "image");
  const h = harness(async (file, kind) => { if (kind === "audio") throw new Error("The audio could not be saved"); return ready(file, kind); }, { selections: [old] });
  h.choose([file("video"), file("audio")]); await flush();
  assert.equal(h.changes.at(-1).length, 2); assert.equal(h.changes.at(-1)[0], old);
  assert.equal(h.errors.at(-1), "The audio could not be saved"); assert.deepEqual(h.pending, [true, false]);
  const cancel = h.all(h.render(), node => node.type === "Button" && node.props.children === "Cancel reference change")[0];
  cancel.props.onClick(); assert.equal(h.errors.at(-1), null); assert.equal(h.changes.at(-1).length, 2);
});

test("the picker rejects a second audio and oversized mixed images before any upload", async () => {
  const duplicate = harness(async () => { throw new Error("Must not upload"); });
  duplicate.choose([file("audio"), file("audio", "2")]); await flush();
  assert.equal(duplicate.calls.length, 0); assert.match(duplicate.errors.at(-1), /one audio/);
  const largeImage = new File([new Uint8Array(17 * 1024 ** 2)], "large.png", { type: "image/png" });
  const mixed = harness(async () => { throw new Error("Must not upload"); });
  mixed.choose([largeImage, file("video")]); await flush();
  assert.equal(mixed.calls.length, 0); assert.match(mixed.errors.at(-1), /16 MB/);
  const imageOnly = harness(async (file, kind) => ready(file, kind));
  imageOnly.choose([largeImage]); await flush();
  assert.equal(imageOnly.calls.length, 1, "The larger image remains valid without timed references");
});

test("an owner's late upload cannot select an asset after the picker unmounts", async () => {
  let resolve;
  const h = harness(() => new Promise(done => { resolve = done; }));
  const selected = file("video"); h.choose([selected]); h.unmount();
  resolve(ready(selected, "video")); await flush();
  assert.equal(h.changes.length, 0); assert.deepEqual(h.pending, [true, false]);
});
