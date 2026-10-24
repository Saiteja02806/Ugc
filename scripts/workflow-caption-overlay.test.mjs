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
import * as serifPolicy from "../worker/dist/subtitles/serif-box-policy.js";
import * as editorial from "../worker/dist/subtitles/editorial.js";

const tick = () => new Promise(setImmediate);
const nodes = tree => tree && typeof tree === "object" ? [tree, ...[tree.props?.children].flat(2).flatMap(nodes)] : [];
const text = tree => nodes(tree).filter(node => node.type === "tspan").map(node => [node.props.children].flat().join("")).join("");
function harness() {
  let cursor = 0, measures = 0; const slots = [], effects = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((value, index) => !Object.is(value, slots[i].deps[index]))) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useId() { cursor++; return 'fixture-id'; },
    useEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((value, index) => !Object.is(value, prior.deps[index]))) effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const element = (type, props) => ({ type, props }), exports = {};
  const document = { fonts: { add() {} }, createElement: () => ({ getContext: () => ({ measureText(value) { measures++; return { width: value.length * 25, actualBoundingBoxLeft: 0, actualBoundingBoxRight: value.length * 25, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 5 }; } }) }) };
  const preview = {};
  const layoutImports = { '../../worker/src/subtitles/captions.ts': captions, '../../worker/src/subtitles/phrases.ts': phrases,
    '../../worker/src/subtitles/serif-box-policy.ts': serifPolicy, '../../worker/src/subtitles/editorial.ts': editorial,
    '../../worker/src/subtitles/contracts.ts': contracts, '../../worker/src/subtitles/corrections.ts': corrections };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/explore/subtitle-preview-layout.ts',import.meta.url),'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText, {exports:preview,document,DataView,Uint8Array,FontFace:class {async load(){return this;}},fetch:async url=>({ok:true,arrayBuffer:async()=>{const file=readFileSync(new URL('../public'+url,import.meta.url));return file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);}}),require(name){assert.ok(name in layoutImports,name);return layoutImports[name];}});
  const imports = { react, "react/jsx-runtime": { jsx: element, jsxs: element }, '@/lib/explore/subtitle-preview-layout': preview, "@/worker/src/subtitles/captions": captions,
    "@/worker/src/subtitles/phrases": phrases, "@/worker/src/subtitles/contracts": contracts, "@/worker/src/subtitles/corrections": corrections, "@/worker/src/subtitles/styles": styles };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/workflow-caption-overlay.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, document,
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

test("serif preview uses the shared one-line policy, Instrument Serif, compact box and whole-word eased fade", async () => {
  const h=harness();h.props.captions={...h.props.captions,style:'serif-box'};
  h.props.captions.transcript.words=[{text:'Most',startMs:100,endMs:400},{text:'mobile',startMs:450,endMs:750},{text:'apps',startMs:800,endMs:1000}];
  h.props.timeMs=500;h.render();await tick();const tree=h.render();
  assert.equal(tree.props['data-lines'],1);
  const content=nodes(tree),labels=content.filter(node=>node.type==='text');
  assert.ok(labels.every(node=>node.props.fontFamily==='Instrument Serif'));
  assert.ok(labels.every(node=>node.props.y===h.props.height*.75));
  assert.equal(labels[0].props.fill,'rgb(255,255,255)');
  assert.equal(labels[2].props.fill,'rgb(85,85,85)');
  const box=content.find(node=>node.type==='rect');assert.ok(box.props.width<h.props.width*.6);assert.ok(box.props.rx>0);
  h.cleanup();
});

test("karaoke shows a progressive word clip and marker highlights its active word rather than recoloring text", async () => {
  for(const style of ['karaoke','marker-highlight']) {
    const h=harness();h.props.captions={...h.props.captions,style};h.render();await tick();let tree=h.render();
    if(style==='karaoke') {
      const clip=nodes(tree).find(node=>node.type==='clipPath');const early=clip.props.children.props.width;
      h.props.timeMs=500;tree=h.render();const later=nodes(tree).find(node=>node.type==='clipPath').props.children.props.width;
      assert.ok(early>0&&later>early);assert.ok(nodes(tree).some(node=>node.props?.['data-caption-fill']));
    } else { const marker=nodes(tree).find(node=>node.props?.['data-caption-marker']);assert.equal(marker.props.fill,'#6a48a3'); }
    h.cleanup();
  }
});
