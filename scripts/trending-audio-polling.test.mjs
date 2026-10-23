import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { withReadDeadline } from "../lib/http/read-deadline.ts";

const settle = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
const compile = source => ts.transpileModule(source, { compilerOptions: { target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX } }).outputText;
const source = file => readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
function environment() {
  let now=0, key=0;
  const timers=new Map(), page=new EventTarget(), events=new EventTarget(), navigator={onLine:true};
  page.visibilityState="visible";
  const globals={document:page,window:events,navigator,AbortController,Error,withReadDeadline,
    setTimeout(fn,ms){const id=++key;timers.set(id,{fn,at:now+ms});return id;}, clearTimeout:id=>timers.delete(id)};
  const polling={};vm.runInNewContext(compile(source("lib/http/foreground-polling.ts")),{exports:polling,...globals});
  return {globals,polling,page,events,navigator,timers,
    async advance(ms){const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await settle();}now=end;},
    hidden(value){page.visibilityState=value?"hidden":"visible";page.dispatchEvent(new Event("visibilitychange"));},
    online(value){navigator.onLine=value;events.dispatchEvent(new Event(value?"online":"offline"));}};
}
function effect(file, globals, contains = "pollInForeground") {
  const ast=ts.createSourceFile(file,source(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let callback;
  function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==="useEffect"&&node.arguments[0]?.getText(ast).includes(contains))callback=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}
  visit(ast);assert.ok(callback);
  return vm.runInNewContext(compile(`const run=${callback};run();`),globals);
}
function reaction(env, transport) {
  const calls=[],updates=[],texts=[],errors=[],identity={current:null};
  const cleanup=effect("components/trending/reaction-text-editor.tsx",{...env.globals,...env.polling,
    assignmentId:"assignment",creativeId:"creative",initializedIdentity:identity,updatedRef:{current:value=>updates.push(value)},
    setEdit(){},setText:value=>texts.push(value),setError:value=>errors.push(value),
    fetchReactionTextEdit:async(item,body,signal)=>{calls.push({item,body,signal});return transport(calls.length);}});
  return {calls,updates,texts,errors,cleanup};
}
test("Reaction: no hidden/offline reads, one return read, terminal stops and draft text survives",async()=>{
  const env=environment();env.hidden(true);
  const h=reaction(env,n=>({state:n<3?"preparing":"ready",text:n===1?"Initial words":"Server words"}));
  await env.advance(30*60_000);assert.equal(h.calls.length,0);
  env.hidden(false);await settle();assert.equal(h.calls.length,1);
  await env.advance(2500);assert.equal(h.calls.length,2);
  env.online(false);await env.advance(30*60_000);assert.equal(h.calls.length,2);
  env.online(true);await settle();assert.equal(h.calls.length,3);
  assert.deepEqual(h.texts,["Initial words"]);assert.equal(h.updates.at(-1).state,"ready");
  await env.advance(60_000);env.hidden(true);env.hidden(false);await settle();assert.equal(h.calls.length,3);
  assert.ok(h.calls.every(call=>call.body===undefined));h.cleanup();assert.ok(h.calls[0].signal.aborted);
});
test("Reaction: read failures back off to 20s, resume immediately, success restores 2.5s",async()=>{
  const env=environment();let failing=true;
  const h=reaction(env,()=>{if(failing)throw Error("Read unavailable");return {state:"preparing",text:"Keep draft"};});await settle();
  for(const interval of [5000,10000,20000,20000]){const before=h.calls.length;await env.advance(interval-1);assert.equal(h.calls.length,before);await env.advance(1);assert.equal(h.calls.length,before+1);}
  failing=false;env.hidden(true);env.hidden(false);await settle();const count=h.calls.length;
  await env.advance(2500);assert.equal(h.calls.length,count+1);assert.equal(h.errors.at(-1),null);h.cleanup();
});
test("Reaction: unmount prevents a late response from updating another item",async()=>{
  const env=environment();let resolve;const h=reaction(env,()=>new Promise(done=>{resolve=done;}));
  env.events.dispatchEvent(new Event("online"));assert.equal(h.calls.length,1);
  h.cleanup();resolve({state:"preparing",text:"Old item"});await settle();
  assert.equal(h.updates.length,0);assert.equal(env.timers.size,0);
});
function audio(env,transport,{saved=true,restored=true,blocked=false}={}) {
  const calls=[],selected=[],live=[],reconciled=[],errors=[],loads=[];
  let data={requests:[{id:"job",status:"running"},{id:"other",status:"running"}],assets:[]};
  let freshness;
  const cleanup=effect("components/audio/audio-generation-workspace.tsx",{...env.globals,...env.polling,
    hasActive:true,hasOtherActiveJobs:false,restored,recoveryBlocked:blocked,submission:{current:saved?{key:"same key"}:null},uid:"owner",liveId:"job",TERMINAL:new Set(["completed","failed","uncertain","cancelled"]),
    api:async(path,init)=>{calls.push({path,init});return transport(calls.length);},
    queryClient:{getQueryState:()=>({dataUpdatedAt:123}),setQueryData(key,update,options){assert.deepEqual([...key],["audio-library","owner"]);data=update(data);freshness=options.updatedAt;}},
    setSelectedAssetId:id=>selected.push(id),setLiveId:id=>live.push(id),reconcileSubmission:value=>reconciled.push(value),
    setError:value=>errors.push(value),load:async value=>loads.push(value)});
  return {calls,selected,live,reconciled,errors,loads,cleanup:cleanup??(()=>{}),get data(){return data;},get freshness(){return freshness;}};
}
test("Audio: reconnect reads the same saved request, preserves other jobs and cache freshness",async()=>{
  const env=environment();const h=audio(env,()=>({requests:[{id:"job",status:"completed",outputAssetId:"output"}],assets:[{id:"output"}]}));
  env.online(false);await env.advance(30*60_000);assert.equal(h.calls.length,0);
  env.online(true);await settle();assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].path,"/api/audio/history?requestKey=same%20key");
  assert.equal(h.data.requests.length,2);assert.equal(h.data.requests[1].id,"other");assert.equal(h.freshness,123);
  assert.deepEqual(h.selected,["output"]);assert.deepEqual(h.live,[null]);assert.equal(h.reconciled.length,1);assert.deepEqual(h.loads,[true]);
  h.cleanup();await env.advance(60000);assert.equal(h.calls.length,1);assert.ok(h.calls[0].init.signal.aborted);
});
test("Audio: hidden time is quiet; repeated failures back off; in-flight reads never overlap",async()=>{
  const env=environment();let fail=true,release;
  const h=audio(env,()=>{if(fail)throw Error("Temporary");return new Promise(resolve=>{release=resolve;});},{saved:false});
  for(const delay of [1600,3200,6400,12800,25600,25600]){const count=h.calls.length;await env.advance(delay);assert.equal(h.calls.length,count+1);}
  env.hidden(true);await env.advance(30*60_000);const count=h.calls.length;
  fail=false;env.hidden(false);assert.equal(h.calls.length,count+1);env.events.dispatchEvent(new Event("online"));assert.equal(h.calls.length,count+1);
  h.cleanup();release({requests:[],assets:[]});await settle();assert.equal(h.reconciled.length,0);assert.equal(env.timers.size,0);
  assert.ok(h.calls.every(call=>call.path==="/api/audio/history"&&call.init.method===undefined));
});

test("Reaction: a save with a lost response recovers its revision and polls without replaying PATCH",async()=>{
  const env=environment(), slots=[], effects=[], calls=[];let cursor=0, reads=0, tree;
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:initial};return [slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value;}];},
    useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
    useEffect(fn,deps){const i=cursor++,prior=slots[i];if(!prior||deps.some((d,j)=>!Object.is(d,prior.deps[j]))){slots[i]={deps};effects.push(()=>{prior?.cleanup?.();slots[i].cleanup=fn();});}}
  };
  const element=(type,props)=>({type,props});
  const imports={react,'react/jsx-runtime':{jsx:element,jsxs:element},'@/lib/http/foreground-polling':env.polling,'@/lib/http/read-deadline':{withReadDeadline},
    '@/lib/trending/reaction-edit-contract':{ReactionTextEditRequestSchema:{safeParse:input=>({success:true,data:input})}},
    '@/lib/trending/reaction-edit-client':{fetchReactionTextEdit:async(item,body)=>{calls.push({body});if(body)throw Error('Lost save response');reads++;return {state:reads===2?'preparing':'ready',text:'Server text has five whole words',expectedUpdatedAt:reads>1?'new-revision':'old-revision'};}}};
  const exports={};vm.runInNewContext(compile(source('components/trending/reaction-text-editor.tsx')),{exports,...env.globals,require:name=>imports[name]??new Proxy({},{get:(_,key)=>key})});
  const props={item:{assignmentId:'assignment',creativeId:'creative'},onUpdated(){},onClose(){}};
  function nodes(node){return Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];}
  const render=()=>{cursor=0;tree=exports.ReactionTextEditor(props);while(effects.length)effects.shift()();};
  render();await settle();render();assert.equal(reads,1,'Preparing/ready state changes must not duplicate the initial read');
  nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'Keep my exact unsaved draft words'}});render();
  nodes(tree).find(n=>n.type==='Button'&&n.props.variant!=='outline').props.onClick();await settle();render();await settle();render();
  assert.equal(calls.filter(call=>call.body).length,1);
  assert.equal(reads,3,'Initial read, save recovery and one restarted status read; no state-change duplicates');
  assert.equal(calls.find(call=>call.body).body.expectedUpdatedAt,'old-revision');
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'Keep my exact unsaved draft words');
  assert.equal(nodes(tree).find(n=>n.type==='Button'&&n.props.variant!=='outline').props.disabled,false);
  env.hidden(true);env.hidden(false);await env.advance(60000);assert.equal(calls.filter(call=>call.body).length,1,'Return never resubmits save');
  for(const slot of slots)slot?.cleanup?.();
});

test("Audio: unresolved saved receipts poll even without an acknowledged job id; uncertainty stays blocked",()=>{
  const text=source('components/audio/audio-generation-workspace.tsx');
  const expression=text.match(/const hasActive = ([^;]+);/)[1];
  for(const [active,saved,blocked,expected] of [[[],{},false,true],[[],{},true,false],[[],null,false,false],[[{status:'running'}],null,false,true]]){
    assert.equal(vm.runInNewContext(expression,{activeRequests:active,savedSubmission:saved,recoveryBlocked:blocked}),expected);
  }
});

test("Trending active Reaction: hidden/offline reads pause, completion stops, editor owns its own polling",async()=>{
  for(const editing of [false,true]){
    const env=environment();env.hidden(true);let calls=0;const updates=[];
    const cleanup=effect('components/trending/trending-workspace.tsx',{...env.globals,...env.polling,
      activeReactionCreativeId:'creative',activeReactionAssignmentId:'assignment',editorCandidate:editing?{format:'reaction'}:null,
      fetchReactionTextEdit:async()=>{calls++;return {creativeId:'creative',state:calls<2?'preparing':'ready'};},
      setReactionEdits:update=>updates.push(update({}))},'if (!activeReactionCreativeId');
    await env.advance(30*60000);assert.equal(calls,0);env.hidden(false);await settle();
    if(editing){assert.equal(calls,0);continue;}
    assert.equal(calls,1);env.online(false);await env.advance(30*60000);assert.equal(calls,1);
    env.online(true);await settle();assert.equal(calls,2);assert.equal(updates.at(-1).creative.state,'ready');
    await env.advance(60000);assert.equal(calls,2);cleanup();
  }
});

test("Reaction client: cancellation while auth is pending never sends a status request",async()=>{
  let release,calls=0;const exports={};
  vm.runInNewContext(compile(source('lib/trending/reaction-edit-client.ts')),{exports,Error,
    require:()=>({getCurrentUserIdToken:()=>new Promise(resolve=>{release=resolve;})}),
    fetch:async()=>{calls++;throw Error('Unexpected fetch');}});
  const controller=new AbortController();
  const pending=exports.fetchReactionTextEdit({creativeId:'creative',assignmentId:'assignment'},undefined,controller.signal);
  controller.abort();release('restored-token');await assert.rejects(pending);assert.equal(calls,0);
});

test("Audio: status polling waits until the initial saved-receipt lookup settles",async()=>{
  const env=environment();const h=audio(env,()=>({requests:[],assets:[]}),{restored:false});
  await env.advance(60000);env.hidden(true);env.hidden(false);await settle();assert.equal(h.calls.length,0);h.cleanup();
});

test("Audio: absent saved receipts slow to 30s while return still checks immediately",async()=>{
  const env=environment();const h=audio(env,()=>({requests:[],assets:[]}));
  await env.advance(1600);assert.equal(h.calls.length,1);
  await env.advance(29999);assert.equal(h.calls.length,1);
  await env.advance(1);assert.equal(h.calls.length,2);
  env.hidden(true);env.hidden(false);await settle();assert.equal(h.calls.length,3);h.cleanup();
});

test("Audio: an uncertain saved receipt does not hide other jobs from history polling",async()=>{
  const env=environment();const h=audio(env,()=>({requests:[],assets:[]}),{blocked:true});
  await env.advance(1600);assert.equal(h.calls[0].path,'/api/audio/history');h.cleanup();
});

test("Audio restoration: failed lookup unlocks recovery, but unmounted lookups cannot restore a session",async()=>{
  for(const unmount of [false,true]){
    const env=environment(),session={current:0},restored=[];let reject,signal;
    const cleanup=effect('components/audio/audio-generation-workspace.tsx',{...env.globals,
      session,preview:{current:null},submission:{current:null},uid:'owner',
      localStorage:{getItem:()=>'{saved receipt}'},audioSubmissionStorageKey:()=> 'key',readAudioSubmission:()=>({key:'same key'}),
      withReadDeadline:(read,abort)=>read(abort),
      api:async(path,init)=>{assert.equal(path,'/api/audio/history?requestKey=same%20key');signal=init.signal;return new Promise((_,fail)=>{reject=fail;});},
      setSavedSubmission(){},setRestored:value=>restored.push(value),setError(){},reconcileSubmission(){}
    },'const current = ++session.current');
    await settle();assert.deepEqual(restored,[],'Pending initial lookup must keep polling locked');
    if(unmount)cleanup();reject(Error('Temporary lookup failure'));await settle();
    assert.deepEqual(restored,unmount?[]:[true]);
    if(!unmount)cleanup();assert.ok(signal.aborted);
  }
});
