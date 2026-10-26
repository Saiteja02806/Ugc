import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as format from "../worker/src/lib/explore-format-edit.ts";
import * as draft from "../lib/explore/format-edit-draft.ts";
import * as timing from "../lib/explore/hook-text-timing.ts";
import * as wall from "../lib/explore/wall-text-editor.ts";
import * as source from "../lib/explore/hook-remix-source.ts";
import * as previewTime from "../lib/explore/clip-preview-time.ts";
import { automaticHookEdit } from "../worker/src/lib/automatic-hook-text.ts";
const assetId="11111111-1111-4111-8111-111111111111";
const editing=automaticHookEdit({blocks:["Your next video is already drafted"],heading:"",body:""},{source:{blocks:[{text:"Your next video is already drafted",startMs:0,endMs:4000}]}},5,"9:16");
const content={version:1,sourceAssetId:assetId,editing,backgroundAssetId:null,backgroundPlayback:"once"};
const nodes=value=>!value?[]:Array.isArray(value)?value.flatMap(nodes):typeof value==="object"?[value,...nodes(value.props?.children)]:[];
const text=value=>!value?"":Array.isArray(value)?value.map(text).join(""):typeof value==="object"?text(value.props?.children):String(value);

// Executes the production editor and handlers, isolating portals and network hooks.
// Browser font loading, drag geometry and hosted account acceptance remain separate.
function fixture({storage=new Map(),status="ready",saved=content}={}) {
  let cursor=0,tree,saveOptions,preview,clipState,finishOptions;
  const slots=[],effects=[];
  const react={useState(value){const i=cursor++;if(!(i in slots))slots[i]=typeof value==="function"?value():value;return[slots[i],next=>{slots[i]=typeof next==="function"?next(slots[i]):next;}];},
    useRef(value){const i=cursor++;return slots[i]??={current:value};},useCallback(fn){cursor++;return fn;},
    useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,n)=>!Object.is(v,slots[i][n]))){slots[i]=deps;effects.push(fn);}}};
  const db={saved:saved?{revision:1,content:saved}:null,loaded:true,busy:false,dirty:false,error:null,reload(){},async save(){db.saved={revision:(db.saved?.revision??0)+1,content:structuredClone(saveOptions.content)};return db.saved;}};
  const imports={react,"react/jsx-runtime":{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},"react-dom":{createPortal:node=>node},
    "@tanstack/react-query":{useQuery:opts=>({data:opts.queryKey[0]==="explore-edit-source"?{id:assetId,url:"https://fixture.test/video.mp4",metadata:{automaticHookText:{version:1,status}},width:1080,height:1920}:null,isError:false,isFetching:false})},
    "@/contexts/auth-context":{useAuth:()=>({user:{uid:"owner"}})},
    "@/components/explore/use-local-workflow-media":{useLocalWorkflowMedia:()=>({asset:null,loading:false,error:null})},
    "@/components/explore/use-clip-draft-save":{useClipDraftSave:opts=>{saveOptions=opts;return db;}},
    "@/components/explore/use-workflow-finishing":{DEFAULT_FINISHING_OPTIONS:{},useWorkflowFinishing:opts=>{finishOptions=opts;return{output:null,action:{busy:false,error:null,message:"",disabled:false}};}},
    "@/worker/src/lib/explore-format-edit":format,"@/lib/explore/format-edit-draft":draft,"@/lib/explore/hook-text-timing":timing,"@/lib/explore/wall-text-editor":wall,
    "@/lib/explore/hook-remix-source":source,"@/lib/explore/clip-preview-time":previewTime,
    "@/lib/explore/reference-audio-preview":{getReferenceAudioPreview:()=>null},"@/lib/explore/unchanged-hook-source":{canReuseUnchangedHookSource:()=>false},
    "@/worker/src/lib/explore-finishing-contract":{isExploreUuid:v=>typeof v==="string"&&/^[a-f0-9-]{36}$/.test(v)},
  };
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../components/explore/format-video-editor.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
    {exports,require:name=>imports[name]??new Proxy({__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})},{get:(obj,key)=>key in obj?obj[key]:String(key)}),
      window:{},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},console});
  const props={format:"hook",video:{id:assetId,mediaAssetId:assetId,durationSeconds:5,ratio:"9:16",url:"https://fixture.test/video.mp4",title:"Generated hook"},active:true,controlsTarget:{},resultsTarget:{},actionsTarget:{},enabled:true,
    fullDurationHookText:true,allowRemix:false,showSoundControls:false,onDirty(){},onSaved(){},onContinue(){},onPreviewChange:v=>{preview=v;},onClipStateChange:v=>{clipState=v;}};
  const h={storage,db,props,render(){cursor=0;tree=exports.FormatVideoEditor(props);effects.splice(0).forEach(fn=>fn());return tree;},
    restore(value=content,explicit=false){saveOptions.onRestore(value,explicit);h.render();},
    find:type=>nodes(tree).find(n=>n.type===type),button:label=>nodes(tree).find(n=>n.type==="Button"&&text(n)===label),
    preview:()=>preview,state:()=>clipState,finish:()=>finishOptions};
  h.render();h.render();return h;
}
test("Save and return navigates only after a confirmed save, while Save edits stays in the editor", async () => {
  const h = fixture(); h.restore(); let returned = 0;
  h.props.onBackToPreview = () => returned++; h.render();
  h.button("Edits saved").props.onClick(); await new Promise(setImmediate);
  assert.equal(returned, 0);
  h.button("Save & return").props.onClick(); await new Promise(setImmediate);
  assert.equal(returned, 1);
  h.db.save = async () => undefined;
  h.render(); h.button("Save & return").props.onClick(); await new Promise(setImmediate);
  assert.equal(returned, 1, "a failed save never navigates");
});

test("late clip save cannot navigate away from newer edits", async () => {
  const h = fixture(); h.restore(); let returned = 0, finish;
  h.props.onBackToPreview = () => returned++;
  h.db.save = () => new Promise(resolve => { finish = resolve; });
  h.render(); h.button("Save & return").props.onClick();
  const overlay = h.find("FormatVideoTextOverlay"); overlay.props.onChange({ ...overlay.props.text, value: "Newer edit" }); h.render();
  finish({ content }); await new Promise(setImmediate);
  assert.equal(returned, 0);
});

test("Wall Save and review opens review after saving without publishing", async () => {
  const h = fixture({ saved: null }); let reviewed = 0, backed = 0;
  h.props.format = "wall_text"; h.props.onContinue = () => reviewed++; h.props.onBackToPreview = () => backed++; h.render();
  h.button("Save & review post").props.onClick(); await new Promise(setImmediate);
  assert.equal(reviewed, 1); assert.equal(backed, 0);
  h.db.save = async () => undefined; h.render();
  h.button("Save & review post").props.onClick(); await new Promise(setImmediate);
  assert.equal(reviewed, 1);
});

test("the generated draft appears on the main video automatically and remains editable",()=>{
  const h=fixture();h.restore();
  const overlay=h.find("FormatVideoTextOverlay");assert.equal(overlay.props.text.value,editing.textOverlays[0].value);assert.equal(typeof overlay.props.onChange,"function");
  assert.deepEqual(h.preview().segment.editing.textOverlays[0].value,editing.textOverlays[0].value);
  overlay.props.onChange({...overlay.props.text,value:"My exact words",y:.35});h.render();
  assert.equal(h.find("FormatVideoTextOverlay").props.text.value,"My exact words");assert.equal(h.finish().editing.textOverlays[0].value,"My exact words");
  h.restore();assert.equal(h.find("FormatVideoTextOverlay").props.text.value,"My exact words","late server restore preserves the user's edit");
  const reopened=fixture({storage:h.storage});reopened.restore();assert.equal(reopened.find("FormatVideoTextOverlay").props.text.value,"My exact words");
});
test("text removed by the user stays removed after late restore and reopening",()=>{
  const h=fixture();h.restore();
  const fields=h.find("FormatVideoTextFields");fields.props.onChange({...fields.props.editing,text:null,textOverlays:[]});h.render();h.restore();
  assert.equal(h.find("FormatVideoTextOverlay"),undefined);
  const reopened=fixture({storage:h.storage});reopened.restore();assert.equal(reopened.find("FormatVideoTextOverlay"),undefined);
  assert.equal(reopened.finish().editing.textOverlays.length,0);
});
test("a user edit made before the saved automatic text arrives is never replaced",()=>{
  const h=fixture();const fields=h.find("FormatVideoTextFields");fields.props.onChange({...editing,textOverlays:[{...editing.textOverlays[0],value:"Typed before loading"}]});h.render();h.restore();
  assert.equal(h.find("FormatVideoTextOverlay").props.text.value,"Typed before loading");
});
test("text failure requires review or explicit continuation and saves the user's decision",async()=>{
  const h=fixture({status:"needs_review",saved:null});assert.match(h.state().draftError,/automatic text needs review/);
  assert.equal(h.button("Save edits").props.disabled,true);
  h.button("Continue without text").props.onClick();await new Promise(setImmediate);h.render();
  assert.equal(h.state().draftError,null);assert.equal(h.db.saved.content.editing.text,null);
  const reopened=fixture({status:"needs_review",saved:h.db.saved.content});reopened.restore(h.db.saved.content);assert.equal(reopened.state().draftError,null);
});
