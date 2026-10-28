import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as selection from '../lib/explore/starting-frame-photo-selection.ts';
const photo='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
const frame={ownerId:'owner',jobId:'33333333-3333-4333-8333-333333333333',assetId:'44444444-4444-4444-8444-444444444444',identityAssetIds:[photo,second]};
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
function harness(load=async id=>({id,status:'ready',collection:'influencer',mimeType:'image/png',url:`https://owned.test/${id}`})){
 const slots=[],effects=[],applied=[],reads=[],values=new Map();let cursor=0,currentFrame=frame,model='google_omni',enabled=true;
 const react={useRef(v){const i=cursor++;return slots[i]??={current:v};},useState(v){const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],n=>slots[i]=typeof n==='function'?n(slots[i]):n];},useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){const next={deps};slots[i]=next;effects.push(()=>{old?.cleanup?.();next.cleanup=run();});}}};
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const code=ts.transpileModule(readFileSync(new URL('../components/explore/use-starting-frame-photos.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{
  if(name==='react')return react;
  if(name.endsWith('/media-client'))return{fetchAIStudioMediaAsset:async(id,token,options)=>{reads.push({id,token,signal:options.signal});return load(id);}};
  if(name.endsWith('/firebase/auth'))return{getCurrentUserIdToken:async owner=>`token-${owner}`};
  if(name.endsWith('/hook-starting-frame-video'))return{hookStartingFrameFaceReferenceLimit:m=>m==='google_omni'?5:0};
  if(name.endsWith('/starting-frame-photo-selection'))return selection;
  throw Error(name);
 },exports);
 return{values,reads,applied,render(patch={}){if('frame'in patch)currentFrame=patch.frame;if(patch.model)model=patch.model;if('enabled'in patch)enabled=patch.enabled;cursor=0;const result=exports.useStartingFramePhotos(currentFrame,model,enabled,p=>applied.push(p));while(effects.length)effects.shift()();return result;}};
}
test('empty photo choice is explicit and owner/frame scoped; no URL is stored',()=>{
 const raw=selection.serializeStartingFramePhotos([],frame);assert.deepEqual(selection.readStartingFramePhotos(raw,frame),[]);assert.equal(selection.readStartingFramePhotos(null,frame),null);
 assert.throws(()=>selection.readStartingFramePhotos(raw,{...frame,ownerId:'other'}));assert.throws(()=>selection.serializeStartingFramePhotos([photo,photo],frame));assert.throws(()=>selection.serializeStartingFramePhotos([frame.assetId],frame));
 assert.doesNotMatch(raw,/https/);
});
test('same ordered preparation photos load through owned GET; removal and replacement survive reload',async()=>{
 const h=harness();assert.equal(h.render().pending,true);await settle();assert.equal(h.render().pending,false);assert.deepEqual(h.reads.map(r=>r.id),[photo,second]);assert.deepEqual(h.applied[0].map(p=>p.asset.id),[photo,second]);
 h.render().remember([]);assert.deepEqual(selection.readStartingFramePhotos(h.values.get(selection.startingFramePhotoKey(frame)),frame),[]);
 h.render({model:'wan_3_0'});await settle();const before=h.reads.length;assert.equal(h.render().pending,false);h.render({model:'google_omni'});await settle();assert.equal(h.reads.length,before);assert.deepEqual(h.applied.at(-1),[]);
 h.render().remember([{asset:{id:second}}]);h.render({model:'seedance_2_5'});h.render({model:'google_omni'});await settle();assert.deepEqual(h.applied.at(-1).map(p=>p.asset.id),[second]);
});
test('unsupported routes and disabled preview do not load photos; stale frame reads cannot replace selection',async()=>{
 let release;const h=harness(()=>new Promise(resolve=>release=resolve));h.render({model:'wan_3_0'});await settle();assert.equal(h.reads.length,0);
 h.render({model:'google_omni',enabled:false});await settle();assert.equal(h.reads.length,0);
 h.render({enabled:true,frame:{...frame,identityAssetIds:[photo]}});await settle();assert.equal(h.reads.length,1);
 h.render({frame:undefined});release({id:photo,status:'ready',collection:'image',mimeType:'image/png'});await settle();assert.equal(h.applied.length,0);assert.equal(h.reads[0].signal.aborted,true);
});
test('missing/deleted photo and malformed saved choice fail closed without submitting or reinserting',async()=>{
 const h=harness(async id=>({id,status:'failed',collection:'image',mimeType:'image/png'}));h.render();await settle();assert.match(h.render().error,/unavailable/);assert.equal(h.applied.length,0);
 h.render().remember([]);assert.equal(h.render().error,null);await settle();assert.equal(h.applied.length,0);
});
