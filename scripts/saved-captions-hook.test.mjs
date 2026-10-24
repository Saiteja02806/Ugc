import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("a save finishing on an inactive workflow cannot leave its controls stuck or populate another account", async () => {
  const slots=[], effects=[], cache=new Map(), requests=[];
  const library={revision:1,captions:[],defaultId:null};
  cache.set(JSON.stringify(["saved-post-captions","owner-a"]),library);
  cache.set(JSON.stringify(["saved-post-captions","owner-b"]),{...library,revision:7});
  let cursor=0, finish;
  const effect=(fn,deps)=>{const i=cursor++,prior=slots[i];if(!prior||deps.some((value,n)=>value!==prior.deps[n])){slots[i]={deps};effects.push(()=>{prior?.cleanup?.();slots[i].cleanup=fn();});}};
  const react={useRef(value){const i=cursor++;return slots[i]??={current:value};},useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==="function"?value(slots[i]):value;}];},useEffect:effect,useLayoutEffect:effect};
  const client={getQueryData:key=>cache.get(JSON.stringify(key)),setQueryData:(key,value)=>cache.set(JSON.stringify(key),value),invalidateQueries:async()=>{}};
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL("../components/scheduling/use-saved-captions.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require(name){
    if(name==="react")return react;
    if(name==="@tanstack/react-query")return{useQueryClient:()=>client,useQuery:({queryKey})=>({data:client.getQueryData(queryKey),isError:false,isPending:false,refetch:async()=>({data:client.getQueryData(queryKey)})})};
    if(name==="@/lib/scheduling/saved-captions-client")return{requestSavedCaptions:(owner,input)=>{requests.push({owner,input});return new Promise(resolve=>{finish=()=>resolve({...input,revision:input.revision+1});});}};
    throw new Error(name);
  }});
  const render=(owner="owner-a",enabled=true)=>{cursor=0;const result=exports.useSavedCaptions(owner,enabled);effects.splice(0).forEach(fn=>fn());return result;};
  let state=render();const operation=state.change(current=>({...current,defaultId:null}));
  state=render();assert.equal(state.pending,true);
  render("owner-a",false);finish();await operation;
  state=render();assert.equal(state.pending,false);assert.equal(state.available,true);
  const second=state.change(current=>({...current}));render("owner-b");finish();await second;
  assert.equal(client.getQueryData(["saved-post-captions","owner-b"]).revision,7);
  assert.equal(render("owner-a").pending,false);
  assert.ok(requests.every(request=>request.owner==="owner-a"));
});
