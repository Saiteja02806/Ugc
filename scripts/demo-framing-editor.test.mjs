import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as contract from "../worker/dist/lib/explore-finishing-contract.js";
const jsx=(type,props)=>({type,props});
const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==="object"?[value,...nodes(value.props?.children)]:[];
const text=value=>Array.isArray(value)?value.map(text).join(""):value&&typeof value==="object"?text(value.props?.children):typeof value==="string"?value:"";
function load(file,imports) {
  const exported={};
  const code=ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports:exported,require:name=>{assert.ok(name in imports,name);return imports[name];},Error,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
  return exported;
}
const recording=load("components/explore/demo-framing-recording.ts",{"@/worker/src/lib/explore-finishing-contract":contract});
function harness({duration=14,width=960,height=540}={}) {
  let cursor=0,rejectPlay;
  const slots=[],saved=[];
  const attrs=new Map(),player={duration,videoWidth:width,videoHeight:height,currentTime:0,readyState:2,paused:true,
    getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),load(){},pause(){this.paused=true;},
    play(){this.paused=false;return new Promise((_,reject)=>{rejectPlay=reject;});}};
  const react={useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useState(initial){const i=cursor++;slots[i]??={value:initial};return[slots[i].value,next=>{slots[i].value=typeof next==="function"?next(slots[i].value):next;}];},useCallback:fn=>fn,useEffect(){}};
  const controls=load("components/explore/workflow-demo-controls.tsx",{
    react,"react/jsx-runtime":{jsx,jsxs:jsx,Fragment:"fragment"},
    "lucide-react":Object.fromEntries(["SlidersHorizontal","RotateCcw","Circle","Square","Play","Pause"].map(name=>[name,name])),
    "@/components/ui/button":{Button:"button"},"@/components/ui/dialog":{Dialog:"dialog",DialogContent:"dialog-content",DialogTitle:"title",DialogDescription:"description",DialogTrigger:"trigger"},
    "@/components/explore/demo-framing-recording":recording,"@/worker/src/lib/explore-finishing-contract":contract,
  });
  function render(){cursor=0;return controls.DemoFramingEditor({asset:{url:"blob:fixture",duration,name:"fixture"},value:null,outputAspect:9/16,onSave:frame=>saved.push(frame),onCancel(){}});}
  let tree=render();
  const video=nodes(tree).find(node=>node.type==="video");
  const detach=video.props.ref(player);
  nodes(tree).find(node=>node.type==="canvas").props.ref.current={width:0,height:0,getContext:()=>({drawImage(){}})};
  video.props.onLoadedMetadata();video.props.onLoadedData();tree=render();
  return {player,render,saved,detach,rejectPlay:error=>rejectPlay(error),button(label){return nodes(render()).find(node=>node.type==="button"&&text(node)===label);}};
}

test("Stop before play resolves keeps the completed path when the old play promise rejects",async()=>{
  const h=harness();h.button("Record movement").props.onClick();
  h.player.currentTime=.2;h.button("Stop recording").props.onClick();
  h.rejectPlay(new Error("Playback interrupted by pause"));await new Promise(setImmediate);
  assert.equal(h.button("Save framing").props.disabled,false);
  assert.equal(nodes(h.render()).some(node=>node.props?.role==="alert"),false);
  h.button("Save framing").props.onClick();assert.equal(h.saved.length,1);assert.equal(h.saved[0].points.at(-1)[0],14000);
});

test("closing the editor invalidates a pending playback promise",async()=>{
  const h=harness();h.button("Record movement").props.onClick();h.detach();
  h.rejectPlay(new Error("Playback interrupted by close"));await new Promise(setImmediate);
  assert.equal(nodes(h.render()).some(node=>node.props?.role==="alert"),false);
  assert.equal(h.player.paused,true);assert.equal(h.player.getAttribute("src"),undefined);
});

test("overlong or unsupported dimensions never enable recording or saving after loadeddata",()=>{
  for(const options of [{duration:121},{width:64,height:32},{width:4098,height:64}]){
    const h=harness(options);
    assert.equal(h.button("Record movement").props.disabled,true);
    assert.equal(h.button("Save framing").props.disabled,true);
    assert.equal(nodes(h.render()).some(node=>node.props?.role==="alert"),true);
  }
});
