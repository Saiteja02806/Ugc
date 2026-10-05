import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const transpile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const element = (type, props) => ({ type, props });

// Execute the real splitter and width helper with isolated browser/hook mocks.
// This covers its event/state behavior, not rendered browser geometry.
function mountSplit(containerWidth = 1200) {
  const slots = [], frames = new Map(), listeners = new Map(), effects = [];
  let cursor = 0, frameId = 0, resize, cleanup;
  const hook = create => { const index = cursor++; if (!(index in slots)) slots[index] = create(); return index; };
  const react = {
    useId: () => `test-${hook(() => null)}`,
    useRef: value => slots[hook(() => ({ current: value }))],
    useState: initial => {
      const index = hook(() => initial);
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useCallback: fn => slots[hook(() => fn)],
    useEffect: effect => { hook(() => { effects.push(effect); return true; }); },
  };
  const helper = {};
  vm.runInNewContext(transpile(read("lib/explore/recreate-pane-size.ts")), { exports: helper });
  const imported = {
    react, "react/jsx-runtime": { jsx: element, jsxs: element }, "lucide-react": { GripVertical: "grip" },
    "@/lib/explore/recreate-pane-size": helper,
    "@/components/explore/recreate-layout.module.css": { default: { split: "split", editor: "editor", divider: "divider", grip: "grip" } },
  };
  const exported = {};
  vm.runInNewContext(transpile(read("components/explore/recreate-split-pane.tsx")), {
    exports: exported,
    require: name => { assert.ok(name in imported, `Unexpected import ${name}`); return imported[name]; },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class {
      constructor(fn) { resize = fn; }
      observe() { resize([{ contentRect: { width: containerWidth } }]); }
      disconnect() {}
    },
    window: { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
      addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
  });
  const children = [{ type: "editor-with-draft" }, { type: "gallery-with-reference" }];
  const render = () => {
    cursor = 0;
    return exported.RecreateSplitPane({ children });
  };
  const initial = render();
  initial.props.ref.current = { getBoundingClientRect: () => ({ width: containerWidth }) };
  for (const effect of effects) cleanup = effect();
  const captured = new Set();
  const handle = { focus() {}, setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id), releasePointerCapture: id => captured.delete(id) };
  const pointer = (clientX, extra = {}) => ({ clientX, currentTarget: handle, pointerId: 1, button: 0, isPrimary: true, preventDefault() {}, ...extra });
  return {
    children, render, captured, pointer, listeners,
    divider: () => render().props.children[1],
    flush: () => { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(); },
    pendingFrames: () => frames.size,
    resize: width => { containerWidth = width; resize([{ contentRect: { width } }]); },
    cleanup: () => cleanup(),
  };
}

test("dragging left/right updates the real pane width without remounting either child", () => {
  const actual = mountSplit();
  assert.equal(actual.divider().props["aria-valuenow"], 384);
  actual.divider().props.onPointerDown(actual.pointer(400));
  actual.divider().props.onPointerMove(actual.pointer(540));
  actual.flush();
  assert.equal(actual.render().props.style["--recreate-editor-width"], "524px");
  assert.equal(actual.render().props.children[0].props.children, actual.children[0]);
  assert.equal(actual.render().props.children[2], actual.children[1]);
  actual.divider().props.onPointerMove(actual.pointer(300));
  actual.flush();
  assert.equal(actual.render().props.style["--recreate-editor-width"], "284px");
  actual.divider().props.onPointerUp(actual.pointer(320));
  assert.equal(actual.render().props.style["--recreate-editor-width"], "304px");
  assert.equal(actual.render().props["data-resizing"], undefined);
  assert.equal(actual.captured.size, 0);
  actual.cleanup();
});

test("cancelling restores the starting layout and keyboard resizing/reset remain functional", () => {
  const actual = mountSplit();
  actual.divider().props.onPointerDown(actual.pointer(400));
  actual.divider().props.onPointerMove(actual.pointer(550));
  actual.listeners.get("keydown")({ key: "Escape", preventDefault() {} });
  actual.flush();
  assert.equal(actual.render().props.style, undefined);
  assert.equal(actual.pendingFrames(), 0);
  const key = value => actual.divider().props.onKeyDown({ key: value, shiftKey: false, preventDefault() {} });
  key("ArrowRight");
  assert.equal(actual.render().props.style["--recreate-editor-width"], "400px");
  key("End");
  assert.equal(actual.divider().props["aria-valuenow"], 560);
  actual.resize(800);
  assert.equal(actual.divider().props["aria-valuenow"], 464);
  key("Home");
  assert.equal(actual.divider().props["aria-valuenow"], 220);
  key("Enter");
  assert.equal(actual.render().props.style, undefined);
  assert.equal(actual.divider().props["aria-valuenow"], 320);
  actual.cleanup();
});
