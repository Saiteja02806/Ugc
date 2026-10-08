import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function harness(upload) {
  const states = [], refs = [], effects = [], changes = [], pending = [], calls = [];
  let cursor = 0;
  const imports = {
    react: { useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
      useRef: initial => { const index = cursor++; return refs[index] ??= { current: initial }; }, useEffect: effect => { effects.push(effect); } },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "lucide-react": new Proxy({}, { get: (_, key) => String(key) }),
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "@/lib/ai-studio/creator-references": { CREATOR_REFERENCES: [] },
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
  vm.runInNewContext(code, { exports: exported, Error, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  function all(node, condition) {
    if (!node || typeof node !== "object") return [];
    return [...(condition(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => all(child, condition))];
  }
  const render = () => { cursor = 0; return exported.FormatGenerationReferences({ ownerId: "expected-owner", preview: false, disabled: false,
    selection: { kind: "image", asset: { url: "https://owned.test/original.png", title: "Original" } },
    onChange: value => changes.push(value), onPendingChange: value => pending.push(value),
  }); };
  const tree = render();
  const cleanups = effects.map(effect => effect()).filter(Boolean);
  return { calls, changes, pending, render, all, cleanup: () => cleanups.forEach(cleanup => cleanup()),
    choose(kind) { all(tree, node => node.type === "input" && node.props["aria-label"] === `Choose optional ${kind} reference`)[0].props.onChange({ currentTarget: { files: [{ name: "reference.mp4" }], value: "selected" } }); },
  };
}
const flush = async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); };

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
