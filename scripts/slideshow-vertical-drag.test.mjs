import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// In-memory source execution; no application/fixture build or browser required.
function harness(vertical = true) {
  const slots = [], effects = [], frames = new Map(), moves = [];
  let cursor = 0, frameId = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useCallback: fn => fn,
    useEffect(fn, deps) { const i = cursor++; if (!(i in slots) || deps.some((value, index) => value !== slots[i][index])) { slots[i] = deps; effects.push(fn); } },
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("components/explore/use-slideshow-slide-drag.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: exported, require: () => react, getComputedStyle: () => ({ flexDirection: vertical ? "column" : "row" }),
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); },
  });
  const props = { ids: ["a", "b", "c", "d"], disabled: false, onMove: (...args) => moves.push(args) };
  const rail = { scrollTop: 0, scrollLeft: 0, getBoundingClientRect: () => ({ left: 0, top: 0, right: 120, bottom: 120 }), querySelectorAll: () => props.ids.map((_, i) => ({ getBoundingClientRect: () => {
    const start = i * 45 - (vertical ? rail.scrollTop : rail.scrollLeft);
    return vertical ? { left: 0, right: 60, top: start, bottom: start + 40, width: 60, height: 40 } : { left: start, right: start + 40, top: 0, bottom: 60, width: 40, height: 60 };
  } })) };
  const render = () => { cursor = 0; const value = exported.useSlideshowSlideDrag(props); value.railRef.current = rail; for (const effect of effects.splice(0)) effect(); return value; };
  let captured = false;
  const handle = { focus() {}, setPointerCapture() { captured = true; }, hasPointerCapture() { return captured; }, releasePointerCapture() { captured = false; } };
  const event = (x, y) => ({ isPrimary: true, button: 0, pointerId: 1, currentTarget: handle, clientX: x, clientY: y, preventDefault() {} });
  return { render, props, rail, moves, event, tick() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); } };
}
for (const vertical of [true, false]) test(`${vertical ? "vertical" : "horizontal"} pointer reorder uses matching axis and cancels without committing`, () => {
  const h = harness(vertical), handles = h.render().handleProps("a");
  handles.onPointerDown(h.event(20, 20)); handles.onPointerMove(h.event(vertical ? 20 : 70, vertical ? 70 : 20));
  handles.onPointerUp(h.event(vertical ? 20 : 70, vertical ? 70 : 20)); assert.deepEqual(h.moves, [["a", "b"]]);
  handles.onPointerDown(h.event(20, 20)); handles.onPointerMove(h.event(70, 70)); handles.onPointerCancel(h.event(70, 70)); assert.equal(h.moves.length, 1);
});
test("vertical edge scrolling and keyboard Up/Down/Home/End retain explicit order and disabled protection", () => {
  const h = harness(), handles = h.render().handleProps("a");
  handles.onPointerDown(h.event(20, 20)); handles.onPointerMove(h.event(20, 115)); h.render(); h.tick();
  assert.equal(h.rail.scrollTop, 12); assert.equal(h.rail.scrollLeft, 0);
  handles.onKeyDown({ key: "Escape", preventDefault() {} });
  for (const [id, key] of [["a", "ArrowDown"], ["b", "ArrowUp"], ["b", "Home"], ["a", "End"]]) h.render().handleProps(id).onKeyDown({ key, preventDefault() {} });
  assert.deepEqual(h.moves, [["a", "b"], ["b", "a"], ["b", "a"], ["a", "d"]]);
  h.props.disabled = true; h.render().handleProps("a").onKeyDown({ key: "ArrowDown", preventDefault() {} }); assert.equal(h.moves.length, 4);
});
