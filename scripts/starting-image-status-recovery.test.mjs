import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { QueryClient, QueryObserver, environmentManager, focusManager, onlineManager, timeoutManager } from "@tanstack/query-core";
import { HookStartingImageReadError, startingImageStatusPolling } from "../lib/explore/hook-starting-image-polling.ts";
import { verifiedHookKeyframeJob } from "../lib/explore/hook-keyframe-client.ts";
import { withReadDeadline } from "../lib/http/read-deadline.ts";

const ast=ts.createSourceFile('component.tsx',readFileSync(new URL('../components/explore/hook-starting-frame-workspace.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let optionsSource,readSource;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='imageJobQueries')optionsSource=node.initializer.getText(ast);if(ts.isFunctionDeclaration(node)&&node.name?.text==='keyframeRead')readSource=node.getText(ast);ts.forEachChild(node,visit);}visit(ast);
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const scope={ownerId:'owner',draftId:'draft',referenceId:'reference',sourceSha256:'source'};
const checkpoint={version:1,scope,inputKey:'stable-input',requestKey:'00000000-0000-4000-8000-000000000001',jobId:'00000000-0000-4000-8000-000000000002'};
const job=(status='processing',patch={})=>({id:checkpoint.jobId,status,isTerminal:status==='completed',error:null,receipt:{version:1,...scope,purpose:'hook_starting_frame',inputKey:checkpoint.inputKey},output:status==='completed'?{mediaAssetId:'00000000-0000-4000-8000-000000000003',url:'https://media.example.test/output.png',width:720,height:1280}:null,...patch});
const intervals=new Map();let timerId=0;
environmentManager.setIsServer(()=>false);
timeoutManager.setTimeoutProvider({setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref?.();return t;},clearTimeout,
  setInterval:(fn,ms)=>{const id=++timerId;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id)});
const settle=()=>new Promise(setImmediate);
function fixture(transport, checkpoints=[checkpoint]){
  focusManager.setFocused(true);onlineManager.setOnline(true);
  const reads=[];
  const context={startingImageStatusPolling,HookStartingImageReadError,verifiedHookKeyframeJob,withReadDeadline,
    readableEntries:checkpoints.map(checkpoint=>({checkpoint})),scope,checkpointRestored:true,previewRuntime:undefined,
    getCurrentUserIdToken:async()=> 'owner-token',useQueries:({queries})=>queries,
    fetch:async(url,init)=>{assert.equal(init.method??'GET','GET');reads.push({url,init});return transport(reads.length,url);}};
  const queryOptions=vm.runInNewContext(compile(readSource+'\nconst result='+optionsSource+';result;'),context);
  const client=new QueryClient({defaultOptions:{queries:{gcTime:3600000,staleTime:1800000,refetchOnReconnect:true,refetchOnWindowFocus:false}}});client.mount();
  const observers=queryOptions.map(options=>new QueryObserver(client,options));const stops=observers.map(observer=>observer.subscribe(()=>{}));
  return {reads,observer:observers[0],observers,options:queryOptions[0],observeAgain(){return new QueryObserver(client,queryOptions[0]).subscribe(()=>{});},close(){stops.forEach(stop=>stop());client.unmount();client.clear();},async cycle(ms){for(const timer of [...intervals.values()].filter(t=>t.ms===ms))timer.fn();await settle();}};
}
const response=value=>Response.json({ok:true,job:value});

test('actual starting-image query recovers transient failures, pauses hidden/offline, then stops at verified completion',async()=>{
  const h=fixture(n=>{if(n===2)return Response.json({ok:false,message:'Busy'},{status:503});return response(job(n===4?'completed':'processing'));});
  try{
    await settle();await h.cycle(3000);assert.equal(h.reads.length,2);assert.ok(h.observer.getCurrentResult().error instanceof HookStartingImageReadError);
    assert.deepEqual([...intervals.values()].map(t=>t.ms),[15000]);
    focusManager.setFocused(false);await h.cycle(15000);assert.equal(h.reads.length,2);
    onlineManager.setOnline(false);focusManager.setFocused(true);await settle();assert.equal(h.reads.length,2);
    onlineManager.setOnline(true);await settle();assert.equal(h.reads.length,3);assert.equal(h.observer.getCurrentResult().error,null);
    await h.cycle(3000);assert.equal(h.reads.length,4);assert.equal(h.observer.getCurrentResult().data.output.mediaAssetId,job('completed').output.mediaAssetId);
    assert.equal(intervals.size,0);focusManager.setFocused(false);focusManager.setFocused(true);onlineManager.setOnline(false);onlineManager.setOnline(true);await settle();assert.equal(h.reads.length,4);
    const stopAdditional=h.observeAgain();await settle();stopAdditional();assert.equal(h.reads.length,4,'Remounting a cached terminal image must not add another status read');
    assert.ok(h.reads.every(r=>r.url.endsWith('?jobId='+checkpoint.jobId)&&r.init.headers.Authorization==='Bearer owner-token'));
  }finally{h.close();}
});

test('repeated transient reads stay at the slower cadence and focus promptly retries the same receipt',async()=>{
  const h=fixture(()=>{throw new TypeError('Network unavailable');});
  try{await settle();for(let i=0;i<5;i++){assert.deepEqual([...intervals.values()].map(t=>t.ms),[15000]);await h.cycle(15000);}assert.equal(h.reads.length,6);
    focusManager.setFocused(false);focusManager.setFocused(true);await settle();assert.equal(h.reads.length,7);assert.ok(h.reads.every(r=>r.url===h.reads[0].url));
  }finally{h.close();}
});

test('auth, missing receipt and validation failures stop automatically; explicit checking retains the exact job',async()=>{
  for(const failure of [401,403,404,'receipt']){
    const h=fixture(n=>n>1?response(job()):failure==='receipt'?response(job('processing',{receipt:{...job().receipt,ownerId:'another-owner'}})):Response.json({ok:false,message:'Cannot confirm saved job'},{status:failure}));
    try{await settle();assert.ok(h.observer.getCurrentResult().isError);assert.equal(intervals.size,0);
      focusManager.setFocused(false);focusManager.setFocused(true);onlineManager.setOnline(false);onlineManager.setOnline(true);await settle();assert.equal(h.reads.length,1);
      await h.observer.refetch();assert.equal(h.reads.length,2);assert.equal(h.reads[0].url,h.reads[1].url);assert.equal(h.observer.getCurrentResult().data.id,checkpoint.jobId);
    }finally{h.close();}
  }
});

test('read timeout, collection delay and rate limit recover; malformed data never bypasses receipt verification',()=>{
  for(const error of [new HookStartingImageReadError('Delay',408),new HookStartingImageReadError('Collecting',409),new HookStartingImageReadError('Wait',429),new Error('Loading took too long. Try again.'),new TypeError('Offline')]){
    assert.equal(startingImageStatusPolling.refetchInterval({state:{error}}),15000);
  }
  assert.equal(startingImageStatusPolling.refetchInterval({state:{error:new SyntaxError('Invalid response')}}),false);
  assert.equal(startingImageStatusPolling.refetchInterval({state:{error:null,data:job('completed')}}),false);
});

test('HTML gateway errors retain their HTTP classification instead of permanently stopping recovery',async()=>{
  for(const status of [502,401]){
    const h=fixture(()=>new Response('<html>Gateway response</html>',{status,headers:{'Content-Type':'text/html'}}));
    try{await settle();assert.equal(h.observer.getCurrentResult().error.status,status);assert.equal(intervals.size,status===502?1:0);}
    finally{h.close();}
  }
});

test('one variation can recover while another is already complete, without mixing outputs',async()=>{
  const other={...checkpoint,jobId:'00000000-0000-4000-8000-000000000005',requestKey:'00000000-0000-4000-8000-000000000006'};
  let firstReads=0;
  const h=fixture((_,url)=>{
    if(url.endsWith(checkpoint.jobId)&&++firstReads===1)return Response.json({ok:false,message:'Wait'},{status:429});
    const id=url.endsWith(other.jobId)?other.jobId:checkpoint.jobId;
    return response(job('completed',{id,output:{...job('completed').output,mediaAssetId:id}}));
  },[checkpoint,other]);
  try{await settle();assert.equal(h.observers[1].getCurrentResult().data.id,other.jobId);assert.equal(h.observers[0].getCurrentResult().isError,true);
    await h.cycle(15000);assert.equal(h.observers[0].getCurrentResult().data.id,checkpoint.jobId);assert.equal(h.observers[1].getCurrentResult().data.output.mediaAssetId,other.jobId);assert.equal(h.reads.length,3);assert.equal(intervals.size,0);
  }finally{h.close();}
});
