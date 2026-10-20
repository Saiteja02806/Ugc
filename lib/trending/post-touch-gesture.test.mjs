import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { getPostDragScrollTop, getPostTouchSnapTop, isPostDoubleTap, isPostTap, POST_TAP_MOVEMENT_PX } from "./post-interaction.ts";

const source = readFileSync(new URL("../../components/trending/post-interaction-feed.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("feed.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["startTouch", "moveTouch", "finishTouch", "startPointer", "finishPointer"];
const declarations = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) declarations.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(declarations.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ disabled = false, control = false, tutorial = false, hasPrevious = true } = {}) {
  const snapped = [], ref = current => ({ current });
  const viewport = { scrollTop: 510, clientHeight: 510, dataset: {} };
  let likes = 0, starts = 0;
  const scope = { touchScrolling: ref(false), touchDrag: ref(null), previousTap: ref(null), pointerStart: ref(null),
    userScroll: ref(false), ignoreDragClick: ref(false), mouseDrag: ref(null), viewportRef: ref(viewport),
    callbacks: ref({ disabled, hasPrevious, onLike: () => likes++, onStart: () => { starts++; return tutorial; } }),
    currentId: "reel-2", CONTROL_SELECTOR: "button", POST_TAP_MOVEMENT_PX, getPostDragScrollTop, getPostTouchSnapTop,
    isPostTap, isPostDoubleTap, cancelSnap() {}, clearMouseDrag() {}, scheduleScrollSettlement() {},
    restingTop: () => 510, snapToPost: top => snapped.push(top),
  };
  const api = new Function(...Object.keys(scope), `${code}\nreturn { ${names.join(",")} };`)(...Object.values(scope));
  const touch = (x, y) => ({ identifier: 1, clientX: x, clientY: y });
  function event(x, y, time = 100, touches = [touch(x, y)]) {
    return { currentTarget: viewport, target: { closest: selector => selector === "button" ? control : true },
      touches, timeStamp: time, clientX: x, clientY: y, pointerType: "touch", isPrimary: true, button: 0, pointerId: 1 };
  }
  return { ...scope, api, viewport, event, touch, snapped, likes: () => likes, starts: () => starts };
}

test("finger-up/down choose one adjacent reel only on release", () => {
  for (const dy of [-120, 120]) {
    const f = fixture();
    f.api.startTouch(f.event(100, 200));
    f.api.moveTouch(f.event(100, 200 + dy, 300));
    assert.deepEqual(f.snapped, []);
    assert.equal(f.viewport.dataset.postTouchDragging, "true");
    f.api.finishTouch(f.event(100, 200 + dy, 350, []));
    assert.deepEqual(f.snapped, [dy < 0 ? 1020 : 0]);
    assert.equal(f.viewport.dataset.postTouchDragging, undefined);
    assert.equal(f.userScroll.current, true);
    assert.equal(f.likes(), 0);
  }
});

test("touch jitter and a horizontal swipe do not select another reel", () => {
  for (const [x, y] of [[100, 207], [240, 210]]) {
    const f = fixture(); f.api.startTouch(f.event(100, 200)); f.api.moveTouch(f.event(x, y, 130));
    f.api.finishTouch(f.event(x, y, 150, []));
    assert.deepEqual(f.snapped, []);
    assert.equal(f.viewport.dataset.postTouchDragging, undefined);
  }
});

test("a reversed finger drag and a held small flick return to the current reel", () => {
  for (const hold of [false, true]) {
    const f = fixture();f.api.startTouch(f.event(100, 200));
    if (!hold) f.api.moveTouch(f.event(100, 380, 200));
    f.api.moveTouch(f.event(100, 250, 230));
    f.api.finishTouch(f.event(100, 250, hold ? 500 : 260, []));
    assert.deepEqual(f.snapped, [510]);
    assert.equal(f.userScroll.current, false);
  }
});

test("multitouch, buttons, tutorial acknowledgement and disabled feeds cannot select history", () => {
  for (const options of [{ disabled: true }, { control: true }, { tutorial: true }, {}]) {
    const f = fixture(options);f.api.startTouch(f.event(100, 200));
    f.api.moveTouch(f.event(100, 350, 200, [f.touch(100, 350), { ...f.touch(200, 350), identifier: 2 }]));
    f.api.finishTouch(f.event(100, 350, 230, []));
    assert.deepEqual(f.snapped, []);
    assert.equal(f.userScroll.current, false);
  }
});

test("a disabled transition or unavailable previous post cancels a downward touch", () => {
  for (const missingHistory of [false, true]) {
    const f = fixture({ hasPrevious: !missingHistory });f.api.startTouch(f.event(100, 200));f.api.moveTouch(f.event(100, 380, 200));
    if (!missingHistory) f.callbacks.current.disabled = true;
    f.api.finishTouch(f.event(100, 380, 230, []));
    assert.deepEqual(f.snapped, [510]);assert.equal(f.userScroll.current, false);
  }
});

test("two native finger taps still like exactly once and start/tutorial logic runs once per tap", () => {
  const f = fixture();
  for (const time of [100, 220]) {
    f.api.startPointer(f.event(100, 200, time));f.api.startTouch(f.event(100, 200, time));
    f.api.finishPointer(f.event(100, 200, time + 20));f.api.finishTouch(f.event(100, 200, time + 20, []));
  }
  assert.equal(f.likes(), 1);assert.equal(f.starts(), 2);assert.deepEqual(f.snapped, []);
});
