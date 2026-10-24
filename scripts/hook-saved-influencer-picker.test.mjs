import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const element = (type, props) => ({ type, props });
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : "";
function compile(source, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, ...globals, require(name) {
    if (name === "react/jsx-runtime") return { jsx: element, jsxs: element, Fragment: "fragment" };
    if (name.endsWith(".css")) return { default: {} };
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error(`Unexpected module ${name}`);
  } });
  return exports;
}
const { SavedInfluencerPicker } = compile(readFileSync(new URL("../components/explore/saved-influencer-picker.tsx", import.meta.url), "utf8"));
const images = Array.from({ length: 6 }, (_, i) => ({ jobId: `job-${i}`, mediaAssetId: `owned-${i}`, url: `/owned-${i}.png`, prompt: "A very long private generation prompt that does not belong in a picker" }));
function picker(overrides = {}) {
  return SavedInfluencerPicker({ images, selectedAssetId: null, open: false, onOpenChange() {}, onSelect() {}, loading: false,
    error: null, selectionError: null, onRetry() {}, hasMore: false, loadingMore: false, onLoadMore() {}, disabled: false, selecting: false, ...overrides });
}
function recent(tree) { return nodes(tree).find(n => n.props?.["aria-label"] === "Saved influencers"); }

test("main screen has one chooser box and no influencer photo gallery", () => {
  const tree = picker();
  const launcher = recent(tree);
  assert.equal(nodes(launcher).filter(n => n.type === "img").length, 0);
  const choices = nodes(launcher).filter(n => n.type === "Button");
  assert.equal(choices.length, 1);
  assert.equal(text(choices[0]).trim(), "Choose influencer");
  assert.equal(choices[0].props["aria-haspopup"], "dialog");
  assert.equal(text(tree).includes(images[0].prompt), false);
  assert.equal(text(tree).includes("Influencer image history"), false);
});

test("chooser opens for any library size and its photos select by owned asset ID", () => {
  let opened = false, selected;
  const tree = picker({ selectedAssetId: "owned-2", onOpenChange: value => { opened = value; }, onSelect: value => { selected = value; } });
  nodes(recent(tree)).find(n => n.type === "Button").props.onClick();
  assert.equal(opened, true);
  const dialog = nodes(tree).find(n => n.type === "Dialog");
  const chosen = nodes(dialog).filter(n => n.type === "button" && n.props["aria-pressed"]);
  assert.equal(chosen.length, 1);
  assert.equal(nodes(chosen[0]).find(n => n.type === "img").props.src, "/owned-2.png");
  assert.equal(nodes(dialog).filter(n => n.type === "button").length, 6);
  chosen[0].props.onClick();
  assert.equal(selected.mediaAssetId, "owned-2");
  for (const items of [[], images.slice(0, 1)]) {
    opened = false;
    nodes(recent(picker({ images: items, onOpenChange: value => { opened = value; } }))).find(n => n.type === "Button").props.onClick();
    assert.equal(opened, true);
  }
});

test("empty/loading/error states and older-page retry remain actionable", () => {
  assert.match(text(picker({ images: [], loading: true })), /Loading your influencers/);
  assert.match(text(picker({ images: [] })), /Choose photos below/);
  let retried = 0, paged = 0;
  const tree = picker({ error: new Error("Read interrupted"), hasMore: true, onRetry: () => retried++, onLoadMore: () => paged++ });
  const dialog = nodes(tree).find(n => n.type === "Dialog");
  nodes(dialog).find(n => n.type === "Button" && /Retry/.test(text(n))).props.onClick();
  nodes(dialog).find(n => n.type === "Button" && /Load more influencers/.test(text(n))).props.onClick();
  assert.equal(retried, 1); assert.equal(paged, 1);
  assert.equal(nodes(picker({ disabled: true })).filter(n => n.type === "button").every(n => n.props.disabled), true);
});

const workspace = readFileSync(new URL("../components/explore/recreate-workspace.tsx", import.meta.url), "utf8");
const { ReferenceCard } = compile(workspace.slice(workspace.indexOf("export function ReferenceCard("), workspace.indexOf("export function ReferenceSourceAction(")), {
  getReferenceSource: () => null, referenceSourceLabel: () => "", cn: (...parts) => parts.filter(Boolean).join(" "), studio: {},
  ReferenceMedia: "ReferenceMedia", ReferenceSourceAction: "ReferenceSourceAction", RotateCcw: "RotateCcw", Check: "Check", Button: "Button",
});
test("selected Hook keeps its repeatable Recreate action after returning to the gallery", () => {
  let opened = 0;
  for (const isSelected of [false, true, true]) {
    const tree = ReferenceCard({ reference: { id: "hook", title: "Hook", format: "hook" }, isSelected, overlayActions: true,
      onPreview() {}, onRecreate: () => opened++ });
    const action = nodes(tree).find(n => n.props?.["data-reference-recreate-overlay"] !== undefined);
    assert.equal(action.props.title, "Recreate this reference");
    assert.equal(action.props["aria-pressed"], undefined);
    assert.equal(nodes(action).some(n => n.type === "RotateCcw"), true);
    assert.equal(nodes(action).some(n => n.type === "Check"), false);
    action.props.onClick();
  }
  assert.equal(opened, 3);
});
