import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import {ImageOptimizerCache, optimizeImage} from 'next/dist/server/image-optimizer.js';
import imageConfig from 'next/dist/shared/lib/image-config.js';
import {imagePickerThumbnailUrl} from '../lib/media/image-picker.ts';
import {prepareReferenceImageBatch, validateReferenceImageFiles} from '../lib/explore/reference-image-batch.ts';

test('small previews optimize only known public media; signed/private/blob originals never enter a shared cache',()=>{
  const original='https://storage.googleapis.com/ugcsaas-media/media/owner/image/original.png';
  const preview=new URL(imagePickerThumbnailUrl(original),'https://getugcpilot.com');
  assert.equal(preview.pathname,'/_next/image');assert.equal(preview.searchParams.get('w'),'256');assert.equal(preview.searchParams.get('url'),original);
  assert.match(imagePickerThumbnailUrl('/ai-studio/creator-references/creator-01.png'),/^\/_next\/image\?/);
  for(const source of ['https://getugcpilot.com/api/media/delivery/id?signature=secret','/api/media/delivery/id?signature=secret','blob:https://getugcpilot.com/id',original+'?X-Goog-Signature=secret','https://storage.googleapis.com/private-bucket/secret.png','https://untrusted.example/photo.png'])assert.equal(imagePickerThumbnailUrl(source),source);
  assert.equal(imagePickerThumbnailUrl(undefined),undefined);
});

test('installed Next optimizer accepts the thumbnail configuration and decodes a real local image into a small preview',async()=>{
  const exports={};
  const source=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,process:{env:{}}});
  const config={...exports.default,images:{...imageConfig.imageConfigDefault,...exports.default.images}};
  const original='https://storage.googleapis.com/ugcsaas-media/media/owner/image/original.png';
  const query=Object.fromEntries(new URL(imagePickerThumbnailUrl(original),'http://localhost').searchParams);
  const params=ImageOptimizerCache.validateParams({headers:{accept:'image/webp'}},query,config,false);
  assert.equal(params.errorMessage,undefined);assert.equal(params.width,256);assert.equal(params.mimeType,'image/webp');
  assert.match(ImageOptimizerCache.validateParams({headers:{}},{...query,url:original+'?X-Goog-Signature=secret'},config,false).errorMessage,/not allowed/);
  const input=readFileSync(new URL('../public/ai-studio/creator-references/creator-01.png',import.meta.url));
  const output=await optimizeImage({buffer:input,contentType:params.mimeType,quality:params.quality,width:params.width});
  const metadata=await sharp(output).metadata();
  assert.equal(metadata.format,'webp');assert.ok(metadata.width<=256);assert.ok(output.length<input.length);
});
test('multi-file upload validates capacity, type, empty files and model size before any upload',()=>{
  const valid=new File(['image'],'first.png',{type:'image/png'});
  assert.doesNotThrow(()=>validateReferenceImageFiles([valid,valid],2,1024));
  assert.throws(()=>validateReferenceImageFiles([valid,valid],1,1024),/1 more image/);
  assert.throws(()=>validateReferenceImageFiles([new File(['bad'],'bad.exe')],2,1024),/bad.exe/);
  assert.throws(()=>validateReferenceImageFiles([new File([],'empty.png',{type:'image/png'})],2,1024),/empty.png/);
  assert.throws(()=>validateReferenceImageFiles([valid],1,1),/up to/);
});
test('batch uploads bound concurrency, preserve file order, retain successes after a failed middle file, and report progress',async()=>{
  const files=['first','second','third','fourth'].map(name=>new File(['image'],name+'.png',{type:'image/png'}));
  const pending=new Map(),progress=[];let active=0,maximum=0;
  const task=prepareReferenceImageBatch(files,file=>new Promise((resolve,reject)=>{active++;maximum=Math.max(maximum,active);pending.set(file.name,{resolve:v=>{active--;resolve(v)},reject:e=>{active--;reject(e)}});}),()=>true,(...args)=>progress.push(args));
  assert.equal(pending.size,2);
  pending.get('second.png').reject(Error('Retry this file'));await Promise.resolve();await Promise.resolve();
  assert.ok(pending.has('third.png'));
  pending.get('third.png').resolve('third');await Promise.resolve();await Promise.resolve();
  pending.get('fourth.png').resolve('fourth');pending.get('first.png').resolve('first');
  const results=await task;
  assert.equal(maximum,2);assert.deepEqual(results.flatMap(r=>r?.value?[r.value]:[]),['first','third','fourth']);assert.match(results[1].error,/second.png: Retry/);assert.deepEqual(progress.at(-1),[4,4]);
});
test('owner cancellation stops queued uploads and suppresses late progress',async()=>{
  let current=true;const resolvers=[],started=[],progress=[];
  const task=prepareReferenceImageBatch([1,2,3,4],file=>{started.push(file);return new Promise(resolve=>resolvers.push(resolve));},()=>current,done=>progress.push(done));
  current=false;resolvers.forEach(resolve=>resolve('late'));await task;
  assert.deepEqual(started,[1,2]);assert.deepEqual(progress,[]);
});
