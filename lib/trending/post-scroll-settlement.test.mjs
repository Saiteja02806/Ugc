import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { shouldSkipScrolledPost } from "./post-interaction.ts";

// Execute the feed's real settlement code with deterministic browser timing.
const source = readFileSync(new URL("../../components/trending/post-interaction-feed.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("feed.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["restingTop", "scheduleScrollSettlement", "armScroll", "settleScroll"];
const declarations = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) declarations.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(declarations.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ top = 0, disabled = false, accepted = true, nativeScrollEnd = true } = {}) {
  let previous = 0;
  let skips = 0;
  let pendingTimer = null;
  const snapped = [];
  const viewport = { clientHeight: 500, scrollTop: top, scrollTo({ top }) { this.scrollTop = top; } };
  if (nativeScrollEnd) viewport.onscrollend = null;
  const touchScrolling = { current: false };
  const userScroll = { current: true };
  const callbacks = { current: { hasPrevious: true, disabled,
    onPrevious: () => { previous++; return accepted; }, onSkip: () => { skips++; return accepted; } } };
  const scope = {
    viewportRef: { current: viewport }, callbacks, touchScrolling, userScroll,
    committingScroll: { current: false }, mouseDrag: { current: null }, snapFrame: { current: null },
    previousTap: { current: null }, scrollTimer: { current: null },
    shouldSkipScrolledPost, cancelSnap() {}, snapToPost: top => snapped.push(top),
    setTimeout: fn => { pendingTimer = fn; return 1; }, clearTimeout: () => { pendingTimer = null; },
  };
  const api = new Function(...Object.keys(scope), `${code}\nreturn { ${names.join(", ")} };`)(...Object.values(scope));
  return { api, touchScrolling, callbacks, viewport, snapped,
    counts: () => ({ previous, skips }),
    flush: () => { const timer = pendingTimer; pendingTimer = null; timer?.(); } };
}

test("a backward touch settles on release when native scrollend already fired while held", () => {
  const f = fixture();
  f.touchScrolling.current = true;
  f.api.settleScroll();
  f.api.scheduleScrollSettlement();
  f.flush();
  assert.deepEqual(f.counts(), { previous: 0, skips: 0 });
  f.touchScrolling.current = false;
  f.api.scheduleScrollSettlement();
  f.flush();
  assert.deepEqual(f.counts(), { previous: 1, skips: 0 });
});

test("a reversing wheel at an existing boundary settles even without another scroll event", () => {
  const f = fixture();
  f.api.armScroll();
  f.flush();
  assert.deepEqual(f.counts(), { previous: 1, skips: 0 });
});

test("native scrollend and its fallback cannot commit the same post twice in either direction", () => {
  for (const top of [0, 1000]) {
    const f = fixture({ top });
    f.api.armScroll();
    f.api.settleScroll();
    f.flush();
    f.api.armScroll();
    f.flush();
    assert.deepEqual(f.counts(), top === 0 ? { previous: 1, skips: 0 } : { previous: 0, skips: 1 });
  }
});

test("short, returned and disabled gestures never retire or revisit a post", () => {
  for (const options of [{ top: 400 }, { top: 500 }, { top: 600 }, { disabled: true }]) {
    const f = fixture(options);
    f.api.armScroll();
    f.flush();
    assert.deepEqual(f.counts(), { previous: 0, skips: 0 });
  }
});

test("a rejected transition returns to the active post and allows a later retry", () => {
  const f = fixture({ accepted: false });
  f.api.armScroll();
  f.flush();
  assert.deepEqual(f.snapped, [500]);
  f.api.armScroll();
  f.flush();
  assert.deepEqual(f.counts(), { previous: 2, skips: 0 });
});

test("browsers without native scrollend retain the same settlement fallback", () => {
  const f = fixture({ nativeScrollEnd: false, top: 1000 });
  f.api.armScroll();
  f.flush();
  assert.deepEqual(f.counts(), { previous: 0, skips: 1 });
});
