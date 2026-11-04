import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as selection from '../lib/explore/starting-frame-photo-selection.ts';
import { startingFrameAnimationInput } from '../lib/explore/starting-frame-animation-input.ts';
const photo='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
const frame={ownerId:'owner',jobId:'33333333-3333-4333-8333-333333333333',assetId:'44444444-4444-4444-8444-444444444444',identityAssetIds:[photo,second]};
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
function harness(load=async id=>({id,status:'ready',collection:'influencer',mimeType:'image/png',url:`https://owned.test/${id}`}),values=new Map(),{tabScoped=false,tabValues=new Map()}={}){
 const slots=[],effects=[],applied=[],reads=[];let cursor=0,currentFrame=frame,model='google_omni',enabled=true;
 const react={useRef(v){const i=cursor++;return slots[i]??={current:v};},useState(v){const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],n=>slots[i]=typeof n==='function'?n(slots[i]):n];},useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){const next={deps};slots[i]=next;effects.push(()=>{old?.cleanup?.();next.cleanup=run();});}}};
 const installStores=()=>{
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  globalThis.sessionStorage={getItem:k=>tabValues.get(k)??null,setItem:(k,v)=>tabValues.set(k,v)};
 };
 installStores();
 const code=ts.transpileModule(readFileSync(new URL('../components/explore/use-starting-frame-photos.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{
  if(name==='react')return react;
  if(name.endsWith('/media-client'))return{fetchAIStudioMediaAsset:async(id,token,options)=>{reads.push({id,token,signal:options.signal});return load(id);}};
  if(name.endsWith('/firebase/auth'))return{getCurrentUserIdToken:async owner=>`token-${owner}`};
  if(name.endsWith('/starting-frame-photo-selection'))return selection;
  throw Error(name);
 },exports);
 return{values,tabValues,reads,applied,render(patch={}){installStores();if('frame'in patch)currentFrame=patch.frame;if(patch.model)model=patch.model;if('enabled'in patch)enabled=patch.enabled;cursor=0;const result=exports.useStartingFramePhotos(currentFrame,model,enabled,p=>applied.push(p),tabScoped);while(effects.length)effects.shift()();return result;}};
}
test('empty photo choice is explicit and owner/frame scoped; no URL is stored',()=>{
 const raw=selection.serializeStartingFramePhotos([],frame);assert.deepEqual(selection.readStartingFramePhotos(raw,frame),[]);assert.equal(selection.readStartingFramePhotos(null,frame),null);
 assert.throws(()=>selection.readStartingFramePhotos(raw,{...frame,ownerId:'other'}));assert.throws(()=>selection.serializeStartingFramePhotos([photo,photo],frame));assert.throws(()=>selection.serializeStartingFramePhotos([frame.assetId],frame));
 assert.doesNotMatch(raw,/https/);
});
test('all three models restore the ordered raw photos even when their frame route does not accept extra inputs',async()=>{
 for(const model of ['google_omni','seedance_2_5','wan_3_0']){
  const h=harness();assert.equal(h.render({model}).pending,true);await settle();
  assert.deepEqual(h.reads.map(r=>r.id),frame.identityAssetIds);
  assert.deepEqual(h.applied.at(-1).map(p=>p.asset.id),frame.identityAssetIds);
  assert.equal(h.render().pending,false);
 }
});

test('disabled preview does not fetch photos, while enabled selection restores them',async()=>{
 const h=harness();h.render({enabled:false});await settle();assert.equal(h.reads.length,0);
 h.render({enabled:true});await settle();assert.equal(h.reads.length,2);
});

test('missing owned photos show a recoverable error instead of silently submitting a frame alone',async()=>{
 const h=harness(async id=>({id,status:'failed',collection:'image',mimeType:'image/png'}));h.render();await settle();
 assert.match(h.render().error,/unavailable/);assert.equal(h.applied.length,0);
});

test('the approved frame and every restored raw photo remain separate ordered request inputs',async()=>{
 const h=harness();h.render();await settle();
 const input=startingFrameAnimationInput({...frame,referenceId:'source',url:'https://owned.test/generated-frame.png'},h.applied.at(-1));
 assert.equal(input.startingFrameAssetId,frame.assetId);
 assert.deepEqual(input.referenceImageUrls,frame.identityAssetIds.map(id=>`https://owned.test/${id}`));
 assert.equal(input.imageReferencePurpose,'person');
});

test('explicit removal stays empty after a model change and reload',async()=>{
 const h=harness();h.render();await settle();h.render().remember([]);
 h.render({model:'seedance_2_5'});await settle();assert.deepEqual(h.applied.at(-1),[]);
 const reads=h.reads.length;h.render({model:'wan_3_0'});await settle();assert.equal(h.reads.length,reads);
 assert.deepEqual(h.applied.at(-1),[]);
});

test('a late restoration cannot overwrite an explicit photo change',async()=>{
 let resolve;const h=harness(id=>new Promise(done=>{if(id===photo)resolve=done;else done({id,status:'ready',collection:'image',mimeType:'image/png'});}));
 h.render();await settle();h.render().remember([]);resolve({id:photo,status:'ready',collection:'image',mimeType:'image/png'});await settle();
 assert.equal(h.applied.length,0);assert.equal(h.render().pending,false);
});

test('a fresh page restores edited raw-photo IDs instead of reinserting removed originals',async()=>{
 const first=harness();first.render();await settle();
 first.render().remember([{asset:{id:second}}]);
 const reloaded=harness(undefined,first.values);reloaded.render();await settle();
 assert.deepEqual(reloaded.reads.map(r=>r.id),[second]);
 assert.deepEqual(reloaded.applied.at(-1).map(p=>p.asset.id),[second]);
 reloaded.render().remember([]);
 const emptyReload=harness(undefined,reloaded.values);emptyReload.render();await settle();
 assert.equal(emptyReload.reads.length,0);assert.deepEqual(emptyReload.applied.at(-1),[]);
});

test('all five preparation photos restore without counting the approved frame as a person photo',async()=>{
 const ids=Array.from({length:5},(_,i)=>`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
 const h=harness();h.render({frame:{...frame,identityAssetIds:ids}});await settle();
 assert.deepEqual(h.reads.map(r=>r.id),ids);assert.equal(h.applied.at(-1).length,5);
 assert.equal(h.render().error,null);
});

test('Hook tab-scoped edits survive reload without altering Wall/Talking Head shared choices',async()=>{
 const shared=new Map([[selection.startingFramePhotoKey(frame),selection.serializeStartingFramePhotos([photo],frame)]]);
 const hook=harness(undefined,shared,{tabScoped:true});hook.render();await settle();
 assert.deepEqual(hook.applied.at(-1).map(p=>p.asset.id),[photo]);
 hook.render().remember([{asset:{id:second}}]);
 assert.deepEqual(selection.readStartingFramePhotos(shared.get(selection.startingFramePhotoKey(frame)),frame),[photo]);
 const reload=harness(undefined,shared,{tabScoped:true,tabValues:hook.tabValues});reload.render();await settle();
 assert.deepEqual(reload.applied.at(-1).map(p=>p.asset.id),[second]);
 const sharedWorkflow=harness(undefined,shared);sharedWorkflow.render();await settle();
 assert.deepEqual(sharedWorkflow.applied.at(-1).map(p=>p.asset.id),[photo]);
});

test('an explicit empty Hook tab selection never inherits shared photos on model change or reload',async()=>{
 const shared=new Map([[selection.startingFramePhotoKey(frame),selection.serializeStartingFramePhotos([photo,second],frame)]]);
 const tabValues=new Map([[selection.startingFramePhotoKey(frame),selection.serializeStartingFramePhotos([],frame)]]);
 const hook=harness(undefined,shared,{tabScoped:true,tabValues});hook.render();await settle();
 assert.deepEqual(hook.applied.at(-1),[]);assert.equal(hook.reads.length,0);
 hook.render({model:'wan_3_0'});await settle();assert.deepEqual(hook.applied.at(-1),[]);
 const reload=harness(undefined,shared,{tabScoped:true,tabValues});reload.render();await settle();
 assert.deepEqual(reload.applied.at(-1),[]);assert.equal(reload.reads.length,0);
});

test('switching starting frames restores only the new frame photos and ignores a late previous-frame fetch',async()=>{
 let complete;
 const h=harness(id=>id===photo?new Promise(resolve=>{complete=resolve;}):Promise.resolve({id,status:'ready',collection:'image',mimeType:'image/png'}));
 h.render();await settle();
 h.render({frame:{...frame,assetId:'55555555-5555-4555-8555-555555555555',identityAssetIds:[second]}});await settle();
 assert.deepEqual(h.applied.at(-1).map(p=>p.asset.id),[second]);
 complete({id:photo,status:'ready',collection:'image',mimeType:'image/png'});await settle();
 assert.equal(h.applied.length,1);assert.deepEqual(h.applied.at(-1).map(p=>p.asset.id),[second]);
});
