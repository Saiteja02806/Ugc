import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import nextEnv from '@next/env';
import {atomicJsonSync} from './reference-text-atomic-write.mjs';
import {ReferenceTextSchema} from '../lib/explore/reference-text.ts';
import {validateHookAdditionRelease} from './hook-reference-addition-release-readiness.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const root=process.cwd(),dir=path.join(root,'.tmp/explore-upload-batch-20261023'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'upload-manifest.json')));
const batchPath='lib/explore/reference-upload-batches.json',textPath='lib/explore/reference-text-catalog.json';
const frozen=new Map([...manifest.files,batchPath,textPath].map(f=>[f,fs.readFileSync(f,'utf8')]));
const text=JSON.parse(frozen.get(textPath));
validateHookAdditionRelease(JSON.parse(frozen.get(manifest.files[1])),text);
const slideshows=JSON.parse(frozen.get(manifest.files[0]));
for(const item of slideshows.items)for(const slide of item.slides){const reviewed=text.items.find(t=>t.referenceId===item.id&&t.slideId===slide.id);if(!reviewed||ReferenceTextSchema.parse(reviewed).sourceSha256!==slide.file.split('.')[0])throw Error('Missing matching slide text review');}
const objects=manifest.objects.map(o=>{if(!/^explore\/(recreate|paired-references)\/v1\/[a-f0-9]{64}\.(png|jpe?g|webp|mp[34])$/.test(o.key)||path.basename(o.file)!==o.file)throw Error('Unexpected destination');const bytes=fs.readFileSync(path.join(dir,'media',o.file));if(bytes.length!==o.bytes||sha(bytes)!==o.sha256)throw Error('Staged bytes changed');return {...o,bytes};});
console.log(JSON.stringify({mode:process.argv.includes('--execute')?'publish':'dry-run',slideshows:slideshows.items.length,hooks:1,objects:objects.length,totalBytes:objects.reduce((n,o)=>n+o.bytes.length,0),storagePrefixes:['explore/recreate/v1/','explore/paired-references/v1/'],excluded:manifest.omitted}));
if(!process.argv.includes('--execute'))process.exit(0);
nextEnv.loadEnvConfig(root);
const {uploadBufferToStorage,getStorageObject,headStorageObject}=await import('../lib/storage/storage.ts');
async function verify(o){const h=await headStorageObject({key:o.key});if(h.ContentLength!==o.bytes.length||h.ContentType!==o.contentType)throw Error('Stored object metadata mismatch');const r=await getStorageObject({key:o.key});if(!r.Body)throw Error('Stored object missing body');const bytes=Buffer.from(await new Response(r.Body.transformToWebStream()).arrayBuffer());if(bytes.length!==o.bytes.length||sha(bytes)!==o.sha256)throw Error('Stored object bytes mismatch');}
let index=0,verified=0,uploaded=0;
const results=await Promise.allSettled(Array.from({length:3},async()=>{while(index<objects.length){const o=objects[index++];try{await verify(o);}catch(e){if(![404,'NoSuchKey','NotFound'].includes(e.code)&&e.$metadata?.httpStatusCode!==404)throw e;await uploadBufferToStorage({key:o.key,buffer:o.bytes,contentType:o.contentType,cacheControl:'public, max-age=31536000, immutable'});uploaded++;await verify(o);}console.log(JSON.stringify({verified:++verified,total:objects.length,key:o.key}));}}));
const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
for(const [f,before]of frozen)if(fs.readFileSync(f,'utf8')!==before)throw Error('Sources changed during publication; no activation performed');
for(const f of manifest.files){const m=JSON.parse(frozen.get(f));atomicJsonSync(f,{...m,mediaStatus:'published',...(m.activation?{activation:'active'}:{})});}
const batches=JSON.parse(frozen.get(batchPath));batches.batches=batches.batches.map(b=>b.id.startsWith('explore-20261023-')?{...b,status:'published'}:b);atomicJsonSync(batchPath,batches);
const receipt={publishedAt:new Date().toISOString(),objects:objects.map(({bytes,...o})=>({...o,bytes:bytes.length})),uploaded,verified,websiteDeployed:false,workerDeployed:false,excluded:manifest.omitted};atomicJsonSync(path.join(dir,'publication-receipt.json'),receipt);
console.log(JSON.stringify({uploaded,verified,localManifestActivated:true,websiteDeployed:false,workerDeployed:false}));
