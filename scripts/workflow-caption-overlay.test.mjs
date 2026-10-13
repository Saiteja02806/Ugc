import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as captions from "../worker/dist/subtitles/captions.js";
import * as phrases from "../worker/dist/subtitles/phrases.js";
import * as contracts from "../worker/dist/subtitles/contracts.js";
import * as corrections from "../worker/dist/subtitles/corrections.js";
import * as styles from "../worker/dist/subtitles/styles.js";

const tick = () => new Promise(setImmediate);
const nodes = tree => tree && typeof tree === "object" ? [tree, ...[tree.props?.children].flat(2).flatMap(nodes)] : [];
const text = tree => nodes(tree).filter(node => node.type === "tspan").map(node => [node.props.children].flat().join("")).join("");
function harness() {
  let cursor = 0, measures = 0; const slots = [], effects = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((value, index) => !Object.is(value, slots[i].deps[index]))) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((value, index) => !Object.is(value, prior.deps[index]))) effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const element = (type, props) => ({ type, props }), exports = {};
  const imports = { react, "react/jsx-runtime": { jsx: element, jsxs: element }, "@/worker/src/subtitles/captions": captions,
    "@/worker/src/subtitles/phrases": phrases, "@/worker/src/subtitles/contracts": contracts, "@/worker/src/subtitles/corrections": corrections, "@/worker/src/subtitles/styles": styles };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/workflow-caption-overlay.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, document: { createElement: () => ({ getContext: () => ({ measureText(value) { measures++; return { width: value.length * 25 }; } }) }) },
    require(name) { assert.ok(name in imports, name); return imports[name]; } });
  const transcript = { schemaVersion: 1, provider: "elevenlabs", model: "scribe_v2", language: "en", durationMs: 10000,
    words: [{ text: "personally", startMs: 100, endMs: 700 }, { text: "outreach", startMs: 1100, endMs: 1600 }, { text: "demo", startMs: 5100, endMs: 5800 }] };
  const props = { captions: { transcript, style: "clean", placement: "bottom" }, timeMs: 300, width: 1080, height: 1920 };
  return { props, get measures() { return measures; }, render() { cursor = 0; const tree = exports.WorkflowCaptionOverlay(props); while (effects.length) effects.shift()(); return tree; }, cleanup() { for (const slot of slots) slot?.cleanup?.(); } };
}

test("preview captions share the combined clock across seeking and the demo cut; clock updates do not repeat layout", async () => {
  const h = harness(); h.render(); await tick();
  assert.match(text(h.render()), /personally/); const measured = h.measures;
  h.props.timeMs = 5200; assert.equal(text(h.render()), "demo");
  h.props.timeMs = 3000; assert.equal(h.render(), null);
  h.props.timeMs = 300; assert.match(text(h.render()), /personally/);
  assert.equal(h.measures, measured, "Only text/style/dimension changes should recompute line layout"); h.cleanup();
});

test("word corrections and style/placement changes update preview without changing the original speech", async () => {
  const h = harness(); h.render(); await tick();
  h.props.captions = { ...h.props.captions, style: "karaoke", placement: "top", corrections: [{ index: 0, text: "personalized" }] };
  h.render(); await tick(); const tree = h.render();
  assert.match(text(tree), /personalized/); assert.equal(tree.props["data-style"], "karaoke");
  assert.ok(nodes(tree).find(node => node.type === "text").props.y < h.props.height / 2);
  assert.equal(h.props.captions.transcript.words[0].text, "personally");
  assert.deepEqual(h.props.captions.transcript.words.map(word => [word.startMs, word.endMs]), [[100, 700], [1100, 1600], [5100, 5800]]); h.cleanup();
});

test("invalid or unfit corrections show a review error instead of crashing or silently hiding captions", async () => {
  for (const replacement of [[{ index: 9, text: "wrong transcript" }], [{ index: 0, text: "x".repeat(120) }]]) {
    const h = harness(); h.props.captions = { ...h.props.captions, corrections: replacement }; h.render(); await tick();
    const tree = h.render(); assert.equal(tree.props.role, "alert"); assert.match(tree.props.children, /Review your corrections/); h.cleanup();
  }
});
