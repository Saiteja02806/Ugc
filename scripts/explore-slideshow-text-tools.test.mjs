import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { EMPTY_SLIDE_TEXT, parseSlideText } from "../lib/explore/slideshow-text.ts";

const element = (type, props) => ({ type, props });
const exports = {};
const code = ts.transpileModule(readFileSync(new URL("../components/explore/format-slideshow-text-tools.tsx", import.meta.url), "utf8"), {
  fileName: "format-slideshow-text-tools.tsx",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, { exports, require: name => {
  if (name === "react") return { useId: () => "slide-text" };
  if (name === "react/jsx-runtime") return { jsx: element, jsxs: element, Fragment: "fragment" };
  if (name === "@/components/ui/button") return { Button: "Button" };
  if (name === "@/lib/explore/slideshow-text") return { EMPTY_SLIDE_TEXT };
  if (name === "./slideshow-editor.module.css") return { default: {} };
  throw new Error(`Unexpected dependency ${name}`);
} });

function nodes(tree) {
  return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
}
function text(tree) {
  return Array.isArray(tree) ? tree.map(text).join("") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : "";
}
function tools(initial = { ...EMPTY_SLIDE_TEXT, heading: "Original heading", body: "Original body" }) {
  let design = parseSlideText(initial), disabled = false;
  const patches = [];
  const render = () => exports.FormatSlideshowTextTools({ design, disabled, onChange: patch => {
    patches.push({ ...patch }); design = parseSlideText({ ...design, ...patch });
  } });
  const field = label => {
    const tree = nodes(render());
    const name = tree.find(node => node.type === "label" && text(node).startsWith(label));
    assert.ok(name, `Accessible label ${label} must remain available`);
    return tree.find(node => node.props?.id === name.props.htmlFor);
  };
  return { render, field, patches, design: () => design, disable: value => { disabled = value; }, replace: value => { design = parseSlideText(value); } };
}

test("heading and body stay directly editable while appearance settings are disclosed separately", () => {
  const h = tools(), tree = nodes(h.render());
  const disclosure = tree.find(node => node.type === "details");
  assert.ok(disclosure); assert.notEqual(disclosure.props.open, true);
  assert.ok(nodes(disclosure).some(node => node.type === "summary" && text(node).startsWith("Text appearance")));
  assert.equal(nodes(disclosure).some(node => node.type === "textarea"), false);
  assert.equal(h.field("Heading").props.maxLength, 180); assert.equal(h.field("Body text").props.maxLength, 600);
  h.field("Heading").props.onChange({ target: { value: "My exact heading\nSecond line" } });
  h.field("Body text").props.onChange({ target: { value: "First paragraph\n\nSecond paragraph" } });
  assert.equal(h.field("Heading").props.value, "My exact heading\nSecond line");
  assert.equal(h.field("Body text").props.value, "First paragraph\n\nSecond paragraph");
  assert.equal(h.design().font, EMPTY_SLIDE_TEXT.font); assert.equal(h.design().position, EMPTY_SLIDE_TEXT.position);
});

test("every appearance field forwards its typed patch without changing text or neighboring settings", () => {
  const h = tools();
  for (const [label, key, value, expected] of [
    ["Font", "font", "serif", "serif"],
    ["Text size", "size", "64", 64],
    ["Alignment", "align", "right", "right"],
    ["Position", "position", "bottom", "bottom"],
    ["Text color", "color", "#ff683b", "#ff683b"],
    ["Background shape", "background", "rounded", "rounded"],
    ["Background color", "backgroundColor", "#223344", "#223344"],
    ["Opacity", "opacity", "35", .35],
  ]) {
    const before = h.design();
    h.field(label).props.onChange({ target: { value } });
    assert.deepEqual(h.patches.at(-1), { [key]: expected });
    assert.deepEqual(h.design(), { ...before, [key]: expected });
    assert.equal(h.field(label).props.value, key === "opacity" ? 35 : expected);
  }
  h.field("Background shape").props.onChange({ target: { value: "none" } });
  assert.equal(h.design().backgroundColor, "#223344"); assert.equal(h.design().opacity, .35);
  h.field("Background shape").props.onChange({ target: { value: "pill" } });
  assert.equal(h.field("Background color").props.value, "#223344"); assert.equal(h.field("Opacity").props.value, 35);
});

test("switching slides refreshes controlled text and hidden appearance values without creating edits", () => {
  const h = tools();
  h.render();
  const next = { ...EMPTY_SLIDE_TEXT, heading: "Another slide", body: "Its own message", font: "mono", position: "top", background: "solid", backgroundColor: "#445566", opacity: .6 };
  h.replace(next); h.render();
  assert.equal(h.patches.length, 0);
  assert.equal(h.field("Heading").props.value, next.heading); assert.equal(h.field("Body text").props.value, next.body);
  assert.equal(h.field("Font").props.value, next.font); assert.equal(h.field("Position").props.value, next.position);
  assert.equal(h.field("Background color").props.value, next.backgroundColor); assert.equal(h.field("Opacity").props.value, 60);
});

test("save and generation locks disable all text fields, while clear restores the complete empty design", () => {
  const h = tools({ ...EMPTY_SLIDE_TEXT, heading: "Added heading", background: "rounded", font: "serif", size: 80, position: "bottom", opacity: .3 });
  const clear = () => nodes(h.render()).find(node => node.type === "Button" && text(node) === "Clear added text");
  h.disable(true);
  const fields = nodes(h.render()).filter(node => ["textarea", "select", "input"].includes(node.type));
  assert.equal(fields.length, 10); assert.ok(fields.every(node => node.props.disabled === true));
  assert.equal(clear().props.disabled, true); assert.equal(h.patches.length, 0);
  h.disable(false); assert.equal(clear().props.disabled, false); clear().props.onClick();
  assert.deepEqual(h.design(), EMPTY_SLIDE_TEXT); assert.equal(clear().props.disabled, true);
});
