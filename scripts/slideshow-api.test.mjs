import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const key = id(50), owner = "owner-a";
const reference = {id:"catalogue-twelve",format:"slideshow",title:"Long design guide",slides:Array.from({length:12},(_,n) => ({id:`guide-${n}`,url:`https://trusted.test/guide-${n}`}))};
const oldReference = {...reference,id:"catalogue-two",slides:reference.slides.slice(0,2)};
class AuthError extends Error {constructor(message,status=401){super(message);this.status=status;}}
function harness(options={}) {
  const calls=[],writes=[],seen=new Map(); let active=0,maxConcurrent=0;
  const env = {EXPLORE_SLIDESHOW_SAVING_ENABLED:"true",SUPABASE_URL:"https://db.test",SUPABASE_SERVICE_ROLE_KEY:"fixture",...options.env};
  const imports = {
    "server-only":{},"node:crypto":{createHash},
    "@/lib/ai-studio/server-access":{requireAIStudioProUser:async()=>{calls.push("auth");if(options.authError)throw options.authError;return{uid:owner};}},
    "@/lib/firebase/server-auth":{FirebaseAuthRequestError:AuthError},
    "@/lib/explore/recreate-catalog":{getRecreateReferences:()=>[reference,oldReference]},
    "@/lib/storage/storage":{isTrustedStorageUrl:url=>url.startsWith("https://trusted.test/")},
    "@/worker/src/lib/explore-finishing-contract":{isExploreUuid:value=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)},
    "./slideshow-draft":{MIN_SLIDESHOW_SLIDES:2,MAX_SLIDESHOW_SLIDES:10},
    "@/lib/media/media-storage":{getMediaAssetForOwner:async args=>{calls.push(args);assert.equal(args.userId,owner);active++;maxConcurrent=Math.max(active,maxConcurrent);await new Promise(resolve=>setTimeout(resolve,5));active--;return options.asset?options.asset(args.assetId):{id:args.assetId,collection:"image",status:"ready",url:`https://trusted.test/${args.assetId}`,storage_key:`owned/${args.assetId}`};}},
    "@supabase/supabase-js":{createClient:()=>({rpc:async(name,args)=>{assert.equal(name,"explore_save_slideshow");writes.push(args);if(options.rpcError)return{error:{message:"provider-secret"}};const prior=seen.get(args.p_request_key);if(prior&&prior!==args.p_fingerprint)return{error:{message:"conflict"}};seen.set(args.p_request_key,args.p_fingerprint);return{data:id(60)};}})},
  };
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/explore/slideshow-api.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Response,Request,process:{env},require:name=>{assert.ok(name in imports,`Unexpected import ${name}`);return imports[name];}});
  const base={version:2,requestKey:key,referenceId:null,slides:[1,2].map(n=>({referenceSlideId:`position-${n}`,mediaAssetId:id(n)}))};
  const post=(body=base,headers={})=>exports.handleSlideshowSave(new Request("https://www.getugcpilot.com/api/explore/slideshows",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key,...headers},body:typeof body==="string"?body:JSON.stringify(body)}));
  return{post,base,calls,writes,seen,get maxConcurrent(){return maxConcurrent;}};
}
test("an owned output sequence saves in chosen order without a catalogue reference; independent checks run concurrently",async()=>{
  const h=harness(),response=await h.post(),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.ok,true);assert.equal(body.kind,"library_item");assert.equal(response.headers.get("Cache-Control"),"no-store");assert.equal(response.headers.get("Vary"),"Authorization");
  assert.equal(h.maxConcurrent,2);assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0].p_slides.map(s=>s.mediaAssetId))),[id(1),id(2)]);assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0].p_slides.map(s=>s.slideNumber))),[1,2]);assert.equal(h.writes[0].p_user_id,owner);
  const again=await h.post();assert.equal((await again.json()).id,body.id);assert.equal(h.seen.size,1);
});
test("a 12-slide catalogue is only guidance and cannot silently populate or change a two-image output list",async()=>{
  const h=harness();const response=await h.post({...h.base,referenceId:reference.id});assert.equal(response.status,200);assert.equal(h.writes[0].p_slides.length,2);assert.ok(h.writes[0].p_slides.every(s=>s.mediaAssetId));
  const invalid=await h.post({...h.base,referenceId:reference.id,slides:h.base.slides.map(s=>({...s,mediaAssetId:null}))});assert.equal(invalid.status,400);assert.equal((await invalid.json()).outcome,"rejected");assert.equal(h.writes.length,1);
});
test("pre-write validation rejects wrong owners, unready media, unsafe URLs and invalid sequences",async()=>{
  for(const asset of [()=>null,id=>({id,collection:"video",status:"ready",url:"https://trusted.test/a"}),id=>({id,collection:"image",status:"processing",url:"https://trusted.test/a"}),id=>({id,collection:"image",status:"ready",url:"https://attacker.test/image"})]){const h=harness({asset});const response=await h.post();assert.equal(response.status,400);assert.equal((await response.json()).outcome,"rejected");assert.equal(h.writes.length,0);}
  const h=harness();for(const body of [null,[],"invalid-json",{...h.base,slides:[h.base.slides[0]]},{...h.base,slides:Array.from({length:11},(_,n)=>({referenceSlideId:`position-${n}`,mediaAssetId:id(n+1)}))},{...h.base,slides:[h.base.slides[0],h.base.slides[0]]},{...h.base,version:3}])assert.equal((await h.post(body)).status,400);
  assert.equal((await h.post(h.base,{"Idempotency-Key":id(99)})).status,400);assert.equal(h.writes.length,0);
});
test("a changed save keeps the same request identity but conflicts; uncertain database replies never release the durable request",async()=>{
  const h=harness();await h.post();const conflict=await h.post({...h.base,slides:[...h.base.slides].reverse()});assert.equal(conflict.status,503);const result=await conflict.json();assert.equal(result.outcome,undefined);assert.doesNotMatch(JSON.stringify(result),/provider-secret|conflict/);
  const uncertain=harness({rpcError:true});const response=await uncertain.post();assert.equal(response.status,503);assert.equal((await response.json()).outcome,undefined);
});
test("legacy saves retain their original reference-order fingerprint for recovery",async()=>{
  const h=harness(),body={requestKey:key,referenceId:oldReference.id,slides:oldReference.slides.map(s=>({referenceSlideId:s.id,mediaAssetId:null}))};
  assert.equal((await h.post(body)).status,200);assert.ok(h.writes[0].p_slides.every(s=>s.mediaAssetId===null));
  const expected=createHash("sha256").update(JSON.stringify({referenceId:oldReference.id,slides:JSON.parse(JSON.stringify(h.writes[0].p_slides))})).digest("hex");assert.equal(h.writes[0].p_fingerprint,expected);
  assert.equal((await h.post({...body,slides:[...body.slides].reverse()})).status,400);
});
test("authentication and rollout gates block writes, while clear pre-write rejection can safely unlock correction",async()=>{
  const denied=harness({authError:new AuthError("Sign in",401)});assert.equal((await denied.post()).status,401);assert.equal(denied.writes.length,0);
  for(const env of [{EXPLORE_SLIDESHOW_SAVING_ENABLED:"false"},{SUPABASE_URL:"",SUPABASE_SERVICE_ROLE_KEY:""}]){const h=harness({env});const response=await h.post();assert.equal(response.status,503);assert.equal((await response.json()).outcome,"rejected");assert.equal(h.writes.length,0);}
});

