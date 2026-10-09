import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as styles from "../worker/dist/subtitles/styles.js";

function harness() {
  let cursor = 0, videoProps; const slots = [], effects = [], listeners = new Map();
  const player = {src:null,paused:true,ended:false,currentTime:0,plays:0,loads:0,
    getAttribute: () => player.src, setAttribute: (_name,value) => {player.src=value;}, removeAttribute: () => {player.src=null;},
    pause() {player.paused=true; videoProps.onPause();}, load() {player.loads++;},
    async play() {player.plays++; if (!player.src) throw new Error("no source"); player.paused=false; videoProps.onPlaying();},
  };
  const react = {
    useRef() {return slots[cursor++] ??= {current:player};},
    useState(initial) {const i=cursor++; if (!(i in slots)) slots[i]=initial; return [slots[i],value=>{slots[i]=typeof value === "function" ? value(slots[i]) : value;}];},
    useEffect(setup) {effects.push(setup);},
  };
  const element = (type,props) => {
    if (typeof type === "function") return type(props);
    if (type === "video") videoProps=props;
    return {type,props};
  };
  const document = {hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  let observe;
  const imports = {react,"@/components/ui/button":{Button:"button"},"@/worker/src/subtitles/styles":styles,"react/jsx-runtime":{jsx:element,jsxs:element}};
  const exported={};
  const code=ts.transpileModule(readFileSync(new URL("../components/explore/workflow-subtitle-preview.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports:exported,require:name=>{assert.ok(name in imports);return imports[name];},document,
    IntersectionObserver:class {constructor(callback){observe=callback;} observe(){} disconnect(){}}});
  return {player,document,listeners,render() {cursor=0;effects.length=0;const tree=exported.WorkflowSubtitlePreview({style:"karaoke"});return {tree,setup:effects[0],videoProps};}, leaveViewport() {observe([{isIntersecting:false}]);}};
}
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === "object" ? [value,...nodes(value.props?.children)] : [];
const button = tree => nodes(tree).find(node=>node.type === "button");

test("effect replay keeps the example playable without autoplay and hidden previews pause", async () => {
  const h=harness(), first=h.render();
  assert.equal(first.videoProps.preload,"none"); assert.equal(first.videoProps.autoPlay,undefined);
  const cleanup=first.setup();cleanup();const finalCleanup=first.setup();
  assert.equal(h.player.src,"/subtitle-previews/v1/karaoke.mp4"); assert.equal(h.player.plays,0);
  await button(h.render().tree).props.onClick();
  assert.equal(h.player.paused,false);assert.equal(button(h.render().tree).props.children,"Pause example");
  h.document.hidden=true;h.listeners.get("visibilitychange")();assert.equal(h.player.paused,true);
  await button(h.render().tree).props.onClick();h.leaveViewport();assert.equal(h.player.paused,true);
  finalCleanup();assert.equal(h.player.src,null);assert.equal(h.listeners.size,0);
});

test("failed preview playback exposes an accessible retry and reuses the selected asset", async () => {
  const h=harness(), first=h.render(), cleanup=first.setup();
  const play=h.player.play;h.player.play=async()=>{throw new Error("offline");};
  button(h.render().tree).props.onClick();await new Promise(setImmediate);
  const failed=h.render().tree;
  assert.equal(button(failed).props.children,"Retry example");assert.ok(nodes(failed).some(node=>node.props?.role === "alert"));
  h.player.play=play;button(failed).props.onClick();await new Promise(setImmediate);
  assert.equal(h.player.src,"/subtitle-previews/v1/karaoke.mp4");assert.equal(h.player.paused,false);assert.ok(h.player.loads>0);cleanup();
});
