import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {withReadDeadline} from "../http/read-deadline.ts";
function fixture({token="owned-token",asset={id:"photo",status:"ready",collection:"influencer",sourceType:"generated_image",mimeType:"image/png"},status=200}={}) {
 const owners=[],reads=[],assets=[];const exports={};
 const imports={"../firebase/auth":{getCurrentUserIdToken:async owner=>{owners.push(owner);return token;}},"../ai-studio/media-client":{fetchAIStudioMediaAsset:async(id,auth,options)=>{assets.push({id,auth,options});return asset;}},"../http/read-deadline":{withReadDeadline}};
 const source=ts.transpileModule(readFileSync(new URL("./photo-library-client.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,Error,require:name=>{assert.ok(name in imports);return imports[name];},fetch:async(url,init)=>{reads.push({url,init});return Response.json(status===200?{ok:true,images:[],nextCursor:null}:{ok:false,error:"History unavailable"},{status});}});
 return {api:exports,owners,reads,assets};
}
test("influencer library reads the existing owner-bound history and encodes cursor without generating",async()=>{
 const h=fixture();await h.api.fetchInfluencerPhotoLibrary("owner-a","cursor?&");
 assert.deepEqual(h.owners,["owner-a"]);assert.equal(h.reads[0].url,"/api/characters/history?cursor=cursor%3F%26");
 assert.equal(h.reads[0].init.method??"GET","GET");assert.equal(h.reads[0].init.headers.Authorization,"Bearer owned-token");assert.equal(h.reads[0].init.cache,"no-store");assert.equal(h.assets.length,0);
});
test("missing auth prevents history and asset reads",async()=>{
 const h=fixture({token:null});await assert.rejects(h.api.fetchInfluencerPhotoLibrary("owner-a",null),/Sign in/);await assert.rejects(h.api.resolveInfluencerPhoto("owner-a","photo"),/Sign in/);
 assert.equal(h.reads.length,0);assert.equal(h.assets.length,0);
});
test("owned saved influencer is resolved before selection and invalid asset roles are rejected",async()=>{
 const h=fixture();assert.equal((await h.api.resolveInfluencerPhoto("owner-a","photo")).id,"photo");assert.equal(h.assets[0].auth,"owned-token");
 for(const patch of [{id:"other"},{status:"deleted"},{sourceType:"upload"},{collection:"video"},{mimeType:"video/mp4"}]){
  const invalid=fixture({asset:{id:"photo",status:"ready",collection:"influencer",sourceType:"generated_image",mimeType:"image/png",...patch}});
  await assert.rejects(invalid.api.resolveInfluencerPhoto("owner-a","photo"),/unavailable/);
 }
});
test("failed history is recoverable by another read, not a generation request",async()=>{
 const h=fixture({status:503});await assert.rejects(h.api.fetchInfluencerPhotoLibrary("owner-a",null),/History unavailable/);assert.equal(h.reads.length,1);assert.equal(h.assets.length,0);
});
