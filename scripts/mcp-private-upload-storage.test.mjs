import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
let calls=[], state={};
const envNames=["PRIVATE_USER_MEDIA_ENABLED","MCP_PRIVATE_UPLOADS_ENABLED","GCP_PRIVATE_MEDIA_BUCKET","GCP_STORAGE_BUCKET","MEDIA_DELIVERY_SIGNING_SECRET","APP_BASE_URL"];
const previous=Object.fromEntries(envNames.map(n=>[n,process.env[n]]));
const file={async getSignedUrl(options){calls.push({sign:options});return ["https://storage.googleapis.com/offline-private/media/owner/video/fixture.mp4?signature=fixture"];},
 async getMetadata(){if(state.objectError)throw state.objectError;return [{generation:"42",size:"1024",contentType:"video/mp4"}];},
 async save(bytes,options){calls.push({save:options,bytes});if(state.saveError)throw state.saveError;},
 async delete(options){calls.push({delete:options});}};
mock.module("@google-cloud/storage",{namedExports:{Storage:class{bucket(name){calls.push({bucket:name});return {
  async getMetadata(){if(state.bucketError)throw state.bucketError;return [{iamConfiguration:{publicAccessPrevention:state.prevention??"enforced"}}];},
  file(key){calls.push({key});return file;}};}}}});
mock.module("@/lib/gcp/credentials",{namedExports:{getGoogleServiceAccountCredentials:()=>null}});
mock.module("@/lib/storage/storage",{namedExports:{
 buildPublicStorageUrl: key => `https://public.example/${key}`,
 createSignedPutUrl:async params=>{calls.push({publicSign:params});return "https://public.example/fixture";},
 headStorageObject:async params=>{calls.push({publicHead:params});return {ContentLength:1024,ContentType:"video/mp4"};},
 uploadBufferToStorage:async params=>{calls.push({publicSave:params});},
 deleteStorageObject:async params=>{calls.push({publicDelete:params});},
}});
const {privateMcpUploadsSelected,privateMcpUploadTarget,signMcpUpload,headMcpUpload,sealMcpUpload,removeMcpUpload}=await import("../lib/mcp/upload-storage.ts");
beforeEach(()=>{calls=[];state={};process.env.PRIVATE_USER_MEDIA_ENABLED="true";process.env.MCP_PRIVATE_UPLOADS_ENABLED="true";
 process.env.GCP_PRIVATE_MEDIA_BUCKET="offline-private";process.env.GCP_STORAGE_BUCKET="offline-public";process.env.MEDIA_DELIVERY_SIGNING_SECRET="offline-private-delivery-signing-secret-32-chars";process.env.APP_BASE_URL="https://getugcpilot.com";});
after(()=>{mock.restoreAll();for(const[n,v]of Object.entries(previous)){if(v===undefined)delete process.env[n];else process.env[n]=v;}});
const row=()=>({id:"fixture",storage_key:"media/owner/video/fixture.mp4",mime_type:"video/mp4",file_size_bytes:1024,
 url:"https://storage.googleapis.com/offline-private/media/owner/video/fixture.mp4",status:"uploading",deleted_at:null,metadata:{mcpUpload:true,storageLocation:"private_user_media"}});
test("explicit MCP gate and checked separate private bucket precede signing",async()=>{
 delete process.env.PRIVATE_USER_MEDIA_ENABLED;delete process.env.MCP_PRIVATE_UPLOADS_ENABLED;assert.equal(privateMcpUploadsSelected(),false);
 process.env.PRIVATE_USER_MEDIA_ENABLED="true";delete process.env.MCP_PRIVATE_UPLOADS_ENABLED;
 assert.throws(privateMcpUploadsSelected,e=>e.code==="PRIVATE_UPLOAD_UNAVAILABLE");assert.equal(calls.length,0);
 process.env.MCP_PRIVATE_UPLOADS_ENABLED="true";process.env.GCP_PRIVATE_MEDIA_BUCKET="offline-public";
 assert.throws(privateMcpUploadsSelected,/separate/);assert.equal(calls.length,0);
 process.env.GCP_PRIVATE_MEDIA_BUCKET="offline-private";
 for(const prevention of ["inherited","",false]){state.prevention=prevention;
  await assert.rejects(signMcpUpload(row(),60),e=>e.code==="PRIVATE_UPLOAD_UNAVAILABLE");}
 assert.equal(calls.some(c=>c.sign||c.publicSign),false);
});
test("private reservation requires delivery readiness before any bucket access",async()=>{
 delete process.env.MEDIA_DELIVERY_SIGNING_SECRET;
 await assert.rejects(privateMcpUploadTarget(row().storage_key),e=>e.code==="PRIVATE_UPLOAD_UNAVAILABLE");
 assert.equal(calls.length,0);
 process.env.MEDIA_DELIVERY_SIGNING_SECRET="offline-private-delivery-signing-secret-32-chars";
 process.env.APP_BASE_URL="http://getugcpilot.com";
 await assert.rejects(privateMcpUploadTarget(row().storage_key),e=>e.code==="PRIVATE_UPLOAD_UNAVAILABLE");
 assert.equal(calls.length,0);
});
test("private signing keeps exact key/size/create-only lease; legacy public upload stays public across flag changes",async()=>{
 assert.equal(await privateMcpUploadTarget(row().storage_key),"https://storage.googleapis.com/offline-private/media/owner/video/fixture.mp4");
 await signMcpUpload(row(),60);
 const signed=calls.find(c=>c.sign).sign;
 assert.deepEqual(signed.extensionHeaders,{"x-goog-content-length-range":"1,1024","x-goog-if-generation-match":"0"});
 delete process.env.PRIVATE_USER_MEDIA_ENABLED;assert.equal(privateMcpUploadsSelected(),true);
 assert.equal(signed.version,"v4");assert.ok(signed.expires>Date.now()&&signed.expires<=Date.now()+60000);
 calls=[];await signMcpUpload({...row(),metadata:{mcpUpload:true}},60);assert.ok(calls.some(c=>c.publicSign));
 for(const seconds of [0,601,1.5])await assert.rejects(signMcpUpload(row(),seconds),/Invalid upload lease/);
});
test("confirmation reads private storage even when creation is off and distinguishes only object 404 as absence",async()=>{
 delete process.env.MCP_PRIVATE_UPLOADS_ENABLED;delete process.env.PRIVATE_USER_MEDIA_ENABLED;
 assert.deepEqual(await headMcpUpload(row()),{ContentLength:1024,ContentType:"video/mp4"});assert.equal(calls.some(c=>c.publicHead),false);
 state.objectError={code:404};await assert.rejects(headMcpUpload(row()),e=>e.name==="NoSuchKey");
 state.objectError={code:403};await assert.rejects(headMcpUpload(row()),e=>e.code===403);
});
test("recorded private identity cannot silently move to a different configured object",async()=>{
 const changed={...row(),url:"https://storage.googleapis.com/old-private/media/owner/video/fixture.mp4"};
 for(const action of [()=>signMcpUpload(changed,60),()=>headMcpUpload(changed),
  ()=>sealMcpUpload({...changed,deleted_at:"deleted"},Buffer.from([0])),()=>removeMcpUpload({...changed,deleted_at:"deleted"})])
  await assert.rejects(action(),/identity changed/);
 assert.equal(calls.length,0);
});
test("private cleanup refuses active/ready rows and uses checked object generation for tombstone and deletion",async()=>{
 const deleted={...row(),deleted_at:"2026-10-12T00:00:00Z"};
 for(const invalid of [row(),{...deleted,status:"ready"},{...deleted,metadata:{}}])await assert.rejects(sealMcpUpload(invalid,Buffer.from([0])),/deleted MCP reservation/);
 assert.equal(calls.length,0);await sealMcpUpload(deleted,Buffer.from([0]));
 const saved=calls.find(c=>c.save).save;assert.equal(saved.preconditionOpts.ifGenerationMatch,"42");assert.equal(saved.validation,"crc32c");
 assert.equal(saved.metadata.cacheControl,"private, no-store");await removeMcpUpload(deleted);assert.equal(calls.find(c=>c.delete).delete.ifGenerationMatch,"42");
 calls=[];state.objectError={code:404};await sealMcpUpload(deleted,Buffer.from([0]));assert.equal(calls.find(c=>c.save).save.preconditionOpts.ifGenerationMatch,0);
 calls=[];state.objectError={code:503};await assert.rejects(sealMcpUpload(deleted,Buffer.from([0])));assert.equal(calls.some(c=>c.save),false);
 delete process.env.MCP_PRIVATE_UPLOADS_ENABLED;await assert.rejects(removeMcpUpload(deleted),e=>e.code==="PRIVATE_UPLOAD_UNAVAILABLE");
});
