import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { test, mock, after } from 'node:test';
import { bundleStatus, claimBundleDownload, validateBundleItems } from './hook-video-bundle.ts';
import manifest from './hook-video-bundle-manifest.json' with {type:'json'};

const originalBucket = process.env.GCP_STORAGE_BUCKET;
process.env.GCP_STORAGE_BUCKET = 'bundle-adapter-test';
after(()=>{if(originalBucket===undefined)delete process.env.GCP_STORAGE_BUCKET;else process.env.GCP_STORAGE_BUCKET=originalBucket});
const objects=new Map();let denied=false,omitGeneration=false;
const storageError=code=>Object.assign(new Error('Storage fixture '+code),{code});
mock.module('@google-cloud/storage',{namedExports:{Storage:class {
  constructor(options){assert.equal(options.retryOptions.autoRetry,false)}
  bucket(name){assert.equal(name,'bundle-adapter-test');return {file(key){return {
    createReadStream(){const s=new PassThrough(), current=objects.get(key);queueMicrotask(()=>{
      if(denied){s.destroy(storageError(403));return}if(!current){s.destroy(storageError(404));return}
      s.emit('response',{headers:omitGeneration?{}:{'x-goog-generation':String(current.generation)}});s.end(current.bytes);
    });return s},
    async save(bytes,options){assert.equal(options.resumable,false);assert.equal(options.metadata.cacheControl,'no-store');
      if(denied)throw storageError(403);
      const current=objects.get(key);if(options.preconditionOpts.ifGenerationMatch!==String(current?.generation??0))throw storageError(412);
      objects.set(key,{generation:(current?.generation??10000000000000000n)+1n,bytes:Buffer.from(bytes)});
    },
    getMetadata(){throw new Error('Counter must read bytes/generation in one response')},
  }}}}
}}});
const {createHookBundleStore}=await import('./hook-video-bundle-service.ts');
const bundleHash=validateBundleItems(manifest.items);
const key=()=>`resources/hook-video-bundle/tests/${randomUUID()}/downloads.json`;
test('GCS adapter uses exact generation strings, compare-and-swap and restart readback',async()=>{
  const path=key(),store=createHookBundleStore(path);assert.equal(await store.read(),null);
  assert.equal(await claimBundleDownload(store,bundleHash,randomUUID()),'accepted');
  const saved=await store.read();assert.equal(saved.generation,'10000000000000001');
  assert.equal(await store.replace('0',saved.value),false);
  assert.equal((await bundleStatus(createHookBundleStore(path),bundleHash)).count,1);
});
test('real storage adapter contract admits exactly 100 of 110 concurrent claims',async()=>{
  const store=createHookBundleStore(key());
  const r=await Promise.all(Array.from({length:110},()=>claimBundleDownload(store,bundleHash,randomUUID(),{pause:async()=>undefined,maxAttempts:120})));
  assert.equal(r.filter(x=>x==='accepted').length,100);assert.equal(r.filter(x=>x==='exhausted').length,10);
});
test('403, corrupt JSON and missing generation never become an empty counter',async()=>{
  const path=key(),store=createHookBundleStore(path);denied=true;
  await assert.rejects(store.read(),e=>e.code===403);denied=false;
  objects.set(path,{generation:1n,bytes:Buffer.from('{bad json')});await assert.rejects(store.read());
  objects.set(path,{generation:1n,bytes:Buffer.from('{}')});omitGeneration=true;await assert.rejects(store.read());omitGeneration=false;
  assert.throws(()=>createHookBundleStore('users/private-file'));
});
