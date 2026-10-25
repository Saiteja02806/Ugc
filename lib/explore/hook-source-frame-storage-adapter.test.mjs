import assert from "node:assert/strict";
import { mock, test } from "node:test";
let bytes=Buffer.from("persisted bytes"), declared=bytes.length, readError, createError, cancelled=0;
const uploads=[];
mock.module(new URL("../storage/storage.ts",import.meta.url),{namedExports:{
  getStorageObject:async()=>{if(readError)throw readError;return{ContentLength:declared,Body:{transformToWebStream:()=>new ReadableStream({start(controller){controller.enqueue(bytes);},cancel(){cancelled++;}})}};},
  uploadBufferToStorage:async input=>{uploads.push(input);if(createError)throw createError;},
}});
const {hookFrameObjectStore}=await import("./hook-source-frame-store.ts");
test("storage writes use immutable create-only objects and never hide real upload failures",async()=>{
  await hookFrameObjectStore.create("frame.png",bytes,"image/png");assert.equal(uploads[0].createOnly,true);assert.match(uploads[0].cacheControl,/immutable/);
  createError={code:412};await hookFrameObjectStore.create("frame.png",bytes,"image/png");
  createError=Error("storage unavailable");await assert.rejects(hookFrameObjectStore.create("frame.png",bytes,"image/png"),/storage unavailable/);createError=null;
});
test("missing objects are distinct from unavailable storage; oversized streams are cancelled",async()=>{
  readError={name:"NoSuchKey",code:"NoSuchKey",$metadata:{httpStatusCode:404}};assert.equal(await hookFrameObjectStore.read("missing",100),null);
  readError=Error("permission denied");await assert.rejects(hookFrameObjectStore.read("private",100),/permission denied/);readError=null;
  await assert.rejects(hookFrameObjectStore.read("too-large",2),/size limit/);assert.equal(cancelled,1);
  declared=undefined;await assert.rejects(hookFrameObjectStore.read("stream-too-large",2),/size limit/);assert.equal(cancelled,2);
});
