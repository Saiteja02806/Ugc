import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("cards.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ReferenceCard").getText(ast);
const code = ts.transpileModule(declaration, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {}, jsx = (type, props) => ({ type, props });
vm.runInNewContext(code, { exports, require: () => ({ jsx, jsxs: jsx }), studio: { mediaFrame: "mediaFrame" }, cn: (...values) => values.filter(Boolean).join(" "),
  getReferenceSource: reference => reference.source ?? null, referenceSourceLabel: () => "Original post",
  ReferenceMedia: "ReferenceMedia", ReferenceSourceAction: "ReferenceSourceAction", Button: "Button", Check: "Check", RotateCcw: "RotateCcw" });
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
function card(format, title, props = {}) { return exports.ReferenceCard({ reference: { id: "ref", format, title }, compact: true, showActionLabel: true, isSelected: false, onPreview() {}, onRecreate() {}, ...props }); }
test("all slideshow card names stay hidden while reference identities and actions remain", () => {
  for (const title of ["Slideshow 1", "Slideshow 2", "Fitness", "Marketing", "Custom title"]) {
    let clicks = 0, previews = 0;
    const tree = card("slideshow", title, { onRecreate: () => clicks++, onPreview: () => previews++ });
    assert.equal(nodes(tree).some(node => node.type === "p" && node.props.children === title), false);
    const action = nodes(tree).find(node => node.props?.["data-reference-recreate"] !== undefined);
    assert.equal(action.props["aria-label"], `Recreate ${title}`); assert.match(action.props.className, /rounded-full/);
    action.props.onClick(); nodes(tree).find(node => node.type === "ReferenceMedia").props.onPreview();
    assert.equal(clicks, 1); assert.equal(previews, 1);
  }
});
test("titleless slideshow cards retain source links and selected feedback", () => {
  const tree = card("slideshow", "Fitness", { isSelected: true, reference: { id: "fitness", format: "slideshow", title: "Fitness", source: { url: "https://example.test/original" } } });
  assert.equal(nodes(tree).find(node => node.type === "ReferenceSourceAction").props.source.url, "https://example.test/original");
  assert.equal(nodes(tree).some(node => node.type === "span" && node.props.children === "Selected"), true);
  assert.equal(nodes(tree).some(node => node.type === "p"), false);
});
test("Hook and Wall captions and button corners keep their existing presentation", () => {
  for (const format of ["hook", "wall_text"]) {
    const tree = card(format, "Keep this caption");
    assert.equal(nodes(tree).some(node => node.type === "p" && node.props.children === "Keep this caption"), true);
    assert.doesNotMatch(nodes(tree).find(node => node.type === "Button").props.className, /rounded-full/);
  }
});
