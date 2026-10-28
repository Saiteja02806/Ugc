import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
const text = value => Array.isArray(value) ? value.map(text).join("") : value && typeof value === "object" ? text(value.props?.children) : value == null ? "" : String(value);
function component(file, name, props) {
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react: { useState: initial => [initial, () => {}], useRef: current => ({ current }), useEffect() {} },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" } }) },
    "@tanstack/react-query": { useQuery: () => ({ data: [] }) },
    "@/lib/explore/slideshow-generation-groups": { slideshowGenerationGroups: () => [] },
  };
  const code = ts.transpileModule(readFileSync(new URL(`../components/explore/${file}`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => imports[name] ?? new Proxy({ default: {} }, { get: (obj, key) => key in obj ? obj[key] : String(key) }) });
  return exports[name](props);
}
test("Select all chooses every reference slide in order without generating or importing", () => {
  const selections = [];
  const props = { reference: { title: "Example", slides: [{ id: "a", url: "/a.png" }, { id: "b", url: "/b.png" }, { id: "c", url: "/c.png" }] }, slideIndex: 0, selectedSlideIds: ["a"], disabled: false, localPreview: false,
    onSelectionChange: ids => selections.push(Array.from(ids)), onUpload: () => assert.fail("No upload"), onBusy: () => assert.fail("No generation") };
  const tree = component("slideshow-reference-picker.tsx", "SlideshowReferencePicker", props);
  nodes(tree).find(n => n.type === "Button" && text(n) === "Select all").props.onClick();
  assert.deepEqual(selections, [["a", "b", "c"]]);
  const all = component("slideshow-reference-picker.tsx", "SlideshowReferencePicker", { ...props, selectedSlideIds: ["a", "b", "c"] });
  assert.equal(nodes(all).find(n => n.type === "Button" && text(n) === "Select all").props.disabled, true);
});
test("Create retains reference upload without a duplicate finished-slide action", () => {
  let reference = 0;
  const tree = component("slideshow-reference-picker.tsx", "SlideshowReferencePicker", { reference: null, selectedSlideIds: [], disabled: false });
  nodes(tree).find(n => n.type === "input").props.ref.current = { click: () => reference++ };
  nodes(tree).find(n => n.type === "Button" && text(n) === "Upload reference slides").props.onClick();
  assert.equal(nodes(tree).some(n => n.type === "Button" && text(n) === "Use my finished slides"), false);
  assert.equal(reference, 1);
});
test("finished-slide upload inside Add slides opens the picker immediately", () => {
  let opened = 0;
  const tree = component("slideshow-add-slides.tsx", "SlideshowAddSlides", { owner: "owner", reference: null, existing: [], slideCount: 0, disabled: false, localPreview: false, onUpload: () => opened++ });
  nodes(tree).find(n => n.type === "button" && text(n) === "Use my finished slides").props.onClick();
  assert.equal(opened, 1);
});
