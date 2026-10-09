import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as mediaTypes from "../lib/media/types.ts";

function load(path, imports, globals={}) {
  const exported={};
  const code=ts.transpileModule(readFileSync(new URL(`../${path}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports:exported,require:name=>{assert.ok(name in imports,`Unexpected import ${name}`);return imports[name];},...globals});
  return exported;
}
const policy=load("lib/media/media-upload.ts",{"@/lib/media/types":mediaTypes,"@/lib/storage/storage":{buildPublicStorageUrl:()=>{throw new Error("No upload target is created by completion tests");}}});
function fixture({collection="audio",project="explore-demo",foreign=false,type=collection==="audio"?"audio/wav":collection==="image"?"image/png":"video/mp4",size=1000}={}) {
  const ready=[];let heads=0;
  const asset={id:"owned-asset",user_id:"owner",collection,project_id:project,storage_key:"owned/file",mime_type:collection==="audio"?"audio/wav":collection==="image"?"image/png":"video/mp4"};
  const route=load("app/api/media/complete-upload/route.ts",{
    "@/lib/firebase/server-auth":{FirebaseAuthRequestError:class extends Error{},requireFirebaseUser:async()=>({uid:"owner"})},
    "@/lib/media/media-storage":{
      getMediaAssetForOwner:async args=>{assert.equal(args.userId,"owner");assert.equal(args.assetId,asset.id);return foreign?null:asset;},
      markMediaAssetReady:async args=>{ready.push(args);return asset;},serializeMediaAsset:value=>value,
    },
    "@/lib/media/media-upload":policy,"@/lib/media/types":mediaTypes,
    "@/lib/storage/storage":{headStorageObject:async()=>{heads++;return {ContentType:type,ContentLength:size};}},
  },{Response,console});
  return {ready,heads:()=>heads,complete:(body={})=>route.POST(new Request("https://www.getugcpilot.com/api/media/complete-upload",{method:"POST",body:JSON.stringify({assetId:asset.id,key:asset.storage_key,...body})}))};
}

test("owned added audio completes without image dimensions and enforces separate demo/reference limits",async()=>{
  const demo=fixture();assert.equal((await demo.complete({durationSeconds:600})).status,200);
  assert.equal(demo.ready[0].width,null);assert.equal(demo.ready[0].height,null);assert.equal(demo.ready[0].ratio,"other");assert.equal(demo.ready[0].userId,"owner");
  for(const durationSeconds of [601,0,-1,null]) {const f=fixture();assert.equal((await f.complete({durationSeconds})).status,400);assert.equal(f.ready.length,0);}
  const reference=fixture({project:"ai-studio"});assert.equal((await reference.complete({durationSeconds:31})).status,400);assert.equal(reference.ready.length,0);
});
test("existing image and video uploads retain dimension and duration requirements",async()=>{
  const image=fixture({collection:"image"});assert.equal((await image.complete({width:720,height:1280})).status,200);assert.equal(image.ready[0].durationSeconds,null);assert.equal(image.ready[0].ratio,"9:16");
  const video=fixture({collection:"video"});assert.equal((await video.complete({width:720,height:1280,durationSeconds:5})).status,200);assert.equal(video.ready[0].durationSeconds,5);
  for(const body of [{durationSeconds:5},{width:720,height:1280},{width:-1,height:1280,durationSeconds:5}]) {const f=fixture({collection:"video"});assert.equal((await f.complete(body)).status,400);assert.equal(f.ready.length,0);}
});
test("foreign audio, changed MIME types and oversized objects never become ready",async()=>{
  const foreign=fixture({foreign:true});assert.equal((await foreign.complete({durationSeconds:3})).status,404);assert.equal(foreign.heads(),0);
  for(const options of [{type:"video/mp4"},{type:"audio/mpeg"},{size:30*1024*1024}]) {const f=fixture(options);assert.ok((await f.complete({durationSeconds:3})).status>=400);assert.equal(f.ready.length,0);}
});
