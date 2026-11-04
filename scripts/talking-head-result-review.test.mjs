import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const element = (type, props = {}) => typeof type === "function" ? type(props) : { type, props };
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join(" ") : node && typeof node === "object" ? text(node.props?.children) : typeof node === "string" || typeof node === "number" ? String(node) : "";
function load(path, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(path), { fileName:path, compilerOptions:{ module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const metadata = load("lib/ai-studio/media-results.ts", {
  "../explore/remix-source.ts": { readRemixSource: () => null },
  "../../worker/src/lib/slideshow-generation-batch.ts": { readSlideshowGenerationSlot: () => null },
});
const css = {default:new Proxy({}, {get:(_,key)=>key})};
const {TalkingHeadResultReview} = load("components/explore/talking-head-result-review.tsx", {
  "react/jsx-runtime": {jsx:element,jsxs:element,Fragment:"fragment"},
  "lucide-react": {ArrowRight:"arrow"},
  "@/components/ui/button": {Button:"button"},
  "@/components/generation/ai-studio-copy-button": {AiStudioCopyButton:"copy"},
  "@/lib/ai-studio/media-results": metadata,
  "./hook-workflow-media-controls": {WorkflowMediaPlayer:"player",formatMediaSeconds:value=>`${Math.round(value*10)/10}s`},
  "./workflow-preview-canvas": {WorkflowPreviewCanvas:"legacy-canvas"},
  "./talking-head-result-review.module.css":css,
});
const asset = (id="one",patch={}) => ({id,collection:"video",status:"ready",sourceType:"generated_video",title:`Video ${id}`,url:`https://owned.invalid/${id}.mp4`,durationSeconds:3,width:720,height:1280,ratio:"9:16",metadata:{model:"wan_3_0",resolution:"720p",prompt:`Exact prompt for ${id}\nKeep these words.`},...patch});
function harness(results=[asset()],selected=results[0]) {
  const calls=[];
  const generation={results,selected,busy:false,error:null,message:"Generating another version…",refreshStatus:()=>calls.push("refresh"),selectResult:id=>{calls.push(id);generation.selected=results.find(a=>a.id===id);},onGenerate:()=>{throw Error("Must not generate");}};
  return {generation,calls,render:()=>TalkingHeadResultReview({generation,onContinue:()=>calls.push(`demo:${generation.selected?.id}`)})};
}
const button = (tree,label) => nodes(tree).find(node=>node.type==="button"&&text(node).replace(/\s+/g," ").trim()===label);

test("approved single review has one next-step action without removed headings or selected summary",()=>{
  const h=harness(),tree=h.render();
  assert.doesNotMatch(text(tree),/Your talking-head clip|Review the expression|Video \d+ selected|Use video 1/);
  assert.equal(nodes(tree).filter(n=>n.type==="button").length,1);
  assert.equal(button(tree,"Continue to Demo").props.disabled,false);
  button(tree,"Continue to Demo").props.onClick();
  assert.deepEqual(h.calls,["demo:one"]);
  const player=nodes(tree).find(n=>n.type==="player");
  assert.equal(player.props.asset.url,h.generation.selected.url);
  assert.equal(player.props.asset.width,720);assert.equal(player.props.asset.height,1280);
  assert.ok(!player.props.autoPlay);
  const details=nodes(tree).find(n=>n.type==="details");
  assert.ok(!details.props.open);
  assert.equal(nodes(tree).find(n=>n.type==="copy").props.value,h.generation.selected.metadata.prompt);
  assert.match(text(tree),/WAN 3.0.*3s.*720p.*9:16/);
});

test("multiple versions keep review mounted and carry exact selected asset and prompt to Demo",()=>{
  const h=harness([asset("one"),asset("two",{ratio:"16:9",width:1280,height:720})]);
  button(h.render(),"Video 2").props.onClick();
  const tree=h.render();
  assert.equal(button(tree,"Video 2").props["aria-pressed"],true);
  assert.equal(button(tree,"Video 1").props["aria-pressed"],false);
  assert.equal(nodes(tree).find(n=>n.type==="player").props.asset.url,"https://owned.invalid/two.mp4");
  assert.equal(nodes(tree).find(n=>n.type==="copy").props.value,h.generation.results[1].metadata.prompt);
  button(tree,"Continue to Demo").props.onClick();
  assert.deepEqual(h.calls,["two","demo:two"]);
});

test("cleared or missing saved selection never silently selects the first candidate",()=>{
  for(const selected of [null,asset("missing"),asset("one",{status:"failed"})]){
    const h=harness([asset()],selected),tree=h.render();
    assert.equal(button(tree,"Continue to Demo").props.disabled,true);
    button(tree,"Continue to Demo").props.onClick();assert.deepEqual(h.calls,[]);
    button(tree,"Use this video").props.onClick();
    assert.equal(button(h.render(),"Continue to Demo").props.disabled,false);
  }
});

test("failed, missing-URL and pending-only results retain existing fallback and recovery",()=>{
  for(const patch of [{status:"failed"},{url:""},{collection:"image"}]){
    const h=harness([asset("bad",patch)]),tree=h.render();
    const fallback=nodes(tree).find(n=>n.type==="legacy-canvas");
    assert.equal(fallback.props.generation.results.length,0);
    assert.match(fallback.props.generation.error,/unavailable/);
    assert.ok(!button(tree,"Continue to Demo"));
    button(tree,"Refresh status").props.onClick();assert.deepEqual(h.calls,["refresh"]);
  }
  const h=harness([],null);h.generation.busy=true;h.generation.pendingCount=2;
  const fallback=nodes(h.render()).find(n=>n.type==="legacy-canvas");
  assert.equal(fallback.props.generation,h.generation);
});

test("ready clip remains usable with another pending or failed generation; feedback stays visible",()=>{
  const h=harness();h.generation.busy=true;h.generation.error="Another version failed.";
  const tree=h.render();assert.equal(button(tree,"Continue to Demo").props.disabled,false);
  assert.match(text(nodes(tree).find(n=>n.props.role==="status")),/Generating another/);
  assert.match(text(nodes(tree).find(n=>n.props.role==="alert")),/Another version failed/);
});

test("missing saved output metadata is omitted instead of borrowing current form values",()=>{
  const h=harness([asset("one",{metadata:{},durationSeconds:NaN,ratio:"other"})]);
  const tree=h.render();assert.ok(!nodes(tree).some(n=>n.props["aria-label"]==="Generated video details"));
  assert.ok(!nodes(tree).some(n=>n.type==="details"));assert.ok(!nodes(tree).some(n=>n.type==="copy"));
});

test("Talking Head wires review to Demo once; other media modes and Phone keep existing paths",()=>{
  const source=read("components/explore/hook-workflow-preview.tsx");
  assert.match(source,/<TalkingHeadResultReview generation=\{generationView \?\? undefined\} onContinue=\{\(\) => changeSection\("edit"\)\}/);
  assert.match(source,/const showTalkingHeadReview = selection.mode === "generate"/);
  assert.match(source,/source && !showTalkingHeadReview/);
  assert.doesNotMatch(source,/selectResult:.*setShowGenerationResults\(false\)/);
  assert.match(source,/library="generation_history" workflow="talking_head"/);
  assert.match(read("components/explore/phone-workflow-preview.tsx"),/<WorkflowPreviewCanvas kind="phone"/);
});
