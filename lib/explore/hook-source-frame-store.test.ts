import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { createStoredHookFrames, hookSourceFrameIndexKey, type HookFrameObjectStore } from "./hook-source-frame-store.ts";
import { createHookSourceFrameService } from "./hook-source-frame.ts";
const hash = (v: Buffer) => createHash("sha256").update(v).digest("hex");
const sourceSha256 = hash(Buffer.from("source"));
function frame() {
  const png = Buffer.alloc(80); Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
  png.write("IHDR",12); png.writeUInt32BE(96,16); png.writeUInt32BE(160,20);
  return { png, referenceId: "hook-01", sourceSha256, frameSha256: hash(png), frameIndex: 0 as const, frameTimeSeconds: 0 as const, width:96, height:160 };
}
function objects() {
  const files = new Map<string, Buffer>(); const writes: string[] = [];
  const store: HookFrameObjectStore = { read: async key => files.has(key) ? Buffer.from(files.get(key)!) : null,
    create: async (key, bytes) => { writes.push(key); if (!files.has(key)) files.set(key, Buffer.from(bytes)); } };
  return { files, writes, store };
}
test("prepared frame survives a fresh service; warm and cold reads never download or decode video", async () => {
  const o = objects(); let decodes = 0;
  await createStoredHookFrames(o.store).prepare(sourceSha256, async () => { decodes++; return frame(); });
  assert.match(o.writes[0], /\.png$/); assert.match(o.writes[1], /\.json$/);
  for (let i=0; i<2; i++) {
    const store = createStoredHookFrames(o.store);
    const service = createHookSourceFrameService({ items: () => [{id:"hook-01", videoSha256:sourceSha256,videoStorageKey:`explore/hooks/${sourceSha256}.mp4`,width:96,height:160}],
      readStoredFrame: store.read, download: async () => assert.fail("no MP4 download"), decode: async () => assert.fail("no decode") });
    assert.equal((await service("hook-01")).frameSha256, frame().frameSha256);
    await store.prepare(sourceSha256, async () => assert.fail("already prepared"));
  }
  assert.equal(decodes,1);
});
test("missing and corrupt stored data fail closed without decoding", async () => {
  const o=objects(), store=createStoredHookFrames(o.store);
  assert.equal(await store.read(sourceSha256),null);
  const get=createHookSourceFrameService({items:()=>[{id:"hook-01",videoSha256:sourceSha256,videoStorageKey:`explore/hooks/${sourceSha256}.mp4`,width:96,height:160}],readStoredFrame:store.read,
    download:async()=>assert.fail("must not fetch source")});
  await assert.rejects(get("hook-01"), {status:503});
  await store.prepare(sourceSha256, async()=>frame());
  o.files.get(o.writes[0])![40]=1;
  await assert.rejects(store.read(sourceSha256),/verified/);
  await assert.rejects(store.prepare(sourceSha256, async()=>assert.fail("must not silently replace")),/verified/);
});
test("upload failure cannot publish an index; retries and concurrent preparations converge", async () => {
  const o=objects(); let fail=true;
  const store=createStoredHookFrames({...o.store,create:async(key,b,t)=>{if(fail) throw Error("upload failed"); await o.store.create(key,b,t);}});
  await assert.rejects(store.prepare(sourceSha256,async()=>frame()),/upload failed/);
  assert.equal(o.files.has(hookSourceFrameIndexKey(sourceSha256)),false); fail=false;
  const results=await Promise.all([store.prepare(sourceSha256,async()=>frame()),store.prepare(sourceSha256,async()=>frame())]);
  assert.equal(results[0].frameSha256,results[1].frameSha256); assert.equal(o.files.size,2);
});
test("private sources and mismatched frame provenance cannot enter the public store", async () => {
  for (const change of [{referenceId:"creator-account-secret"},{sourceSha256:"b".repeat(64)},{frameIndex:3},{frameSha256:"c".repeat(64)}]) {
    const o=objects();
    await assert.rejects(createStoredHookFrames(o.store).prepare(sourceSha256,async()=>({...frame(),...change}) as ReturnType<typeof frame>));
    assert.equal(o.writes.length,0);
  }
});

test("real PNG stored on disk reloads through the production reader with extraction unavailable", async t => {
  const root=await mkdtemp(join(tmpdir(),"hook-frames-"));t.after(()=>{assert.equal(dirname(root),tmpdir());return rm(root,{recursive:true,force:true});});
  const png=await sharp({create:{width:96,height:160,channels:3,background:"#ef8020"}}).png().toBuffer();
  const storedFrame={...frame(),png,frameSha256:hash(png)};
  const disk:HookFrameObjectStore={read:async key=>{try{return await readFile(join(root,key));}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw e;}},
    create:async(key,b)=>{await mkdir(dirname(join(root,key)),{recursive:true});try{await writeFile(join(root,key),b,{flag:"wx"});}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;}}};
  await createStoredHookFrames(disk).prepare(sourceSha256,async()=>storedFrame);
  const get=createHookSourceFrameService({items:()=>[{id:"hook-01",videoSha256:sourceSha256,videoStorageKey:`explore/hooks/${sourceSha256}.mp4`,width:96,height:160}],
    readStoredFrame:createStoredHookFrames(disk).read,download:async()=>assert.fail("source video is offline"),decode:async()=>assert.fail("decoder is offline")});
  const restored=await get("hook-01");assert.deepEqual(restored.png,png);
  const metadata=await sharp(restored.png).metadata();assert.equal(metadata.width,96);assert.equal(metadata.height,160);
});
