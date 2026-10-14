import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function harness(disabled = false) {
  let cursor = 0;
  const uploads = [], clicks = [], slots = [], ref = { current: { click: () => clicks.push("upload") } }, exports = {};
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/workflow-clip-source-actions.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => name === "react" ? { useRef: () => ref, useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => slots[i] = value]; } } : name === "react/jsx-runtime" ? jsx
    : name === "lucide-react" ? { Upload: "upload-icon", FolderOpen: "folder-icon", Check: "check-icon", ChevronDown: "chevron", Sparkles: "generate-icon" }
    : name === "@/components/ui/popover" ? { Popover: "popover", PopoverContent: "content", PopoverTitle: "title", PopoverTrigger: "trigger" } : { Button: "button" } });
  const render = () => { cursor = 0; return exports.WorkflowClipSourceActions({ label: "hook video", disabled,
    onUpload: async file => uploads.push(file), onChooseAssets: () => clicks.push("assets"), onGenerate: () => clicks.push("generate") }); };
  return { uploads, clicks, render, input: () => nodes(render()).find(n => n.type === "input"),
    option: label => nodes(render()).find(n => n.type === "button" && n.props["aria-label"] === label) };
}

test("one hover trigger exposes source choices and upload preserves the native gesture and cancel behavior", () => {
  const h = harness(), tree = h.render(), trigger = nodes(tree).find(n => n.type === "trigger");
  assert.equal(nodes(tree).filter(n => n.type === "trigger").length, 1); assert.equal(trigger.props.openOnHover, true);
  h.option("Upload hook video").props.onClick(); assert.deepEqual(h.clicks, ["upload"]);
  const empty = { files: [], value: "" }; h.input().props.onChange({ currentTarget: empty }); assert.deepEqual(h.uploads, []);
  const file = { name: "opening.mp4" }, selected = { files: [file], value: "opening.mp4" };
  h.input().props.onChange({ currentTarget: selected }); assert.equal(h.uploads[0], file); assert.equal(selected.value, "");
  h.option("Choose hook video from Creative Assets").props.onClick(); assert.deepEqual(h.clicks, ["upload", "assets"]);
  assert.equal(h.option("Choose hook video from Creative Assets").props["aria-pressed"], true); assert.equal(h.option("Upload hook video").props["aria-pressed"], false);
  h.option("Generate hook video").props.onClick(); assert.deepEqual(h.clicks, ["upload", "assets", "generate"]);
  assert.equal(h.option("Generate hook video").props["aria-pressed"], true);
});
test("pending inputs disable both choices and reject late file events", () => {
  const h = harness(true); assert.equal(h.input().props.disabled, true); assert.equal(nodes(h.render()).find(n => n.type === "trigger").props.render.props.disabled, true);
  h.option("Upload hook video").props.onClick(); h.option("Choose hook video from Creative Assets").props.onClick(); assert.deepEqual(h.clicks, []);
  h.input().props.onChange({ currentTarget: { files: [{ name: "opening.mp4" }], value: "opening.mp4" } }); assert.deepEqual(h.uploads, []);
});
