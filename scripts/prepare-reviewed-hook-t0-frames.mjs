/** Explicit public-reference t=0 preparation. No AI generation, private media or catalogue activation. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getHookReferenceGalleryItems } from '../worker/src/lib/explore-hook-reference-release.ts';
import { decodeHookFirstFrame } from '../lib/explore/hook-source-frame.ts';
import { createStoredHookFrames, hookSourceFrameIndexKey } from '../lib/explore/hook-source-frame-store.ts';
import { hookKeyframeSnapshotKey } from '../worker/src/lib/hook-keyframe-generation-contract.ts';

const args=process.argv.slice(2), mode=args.shift();
if(!['--prepare-local','--verify-local','--publish'].includes(mode))throw Error('Choose --prepare-local, --verify-local or --publish');
const options={sources:'.tmp/active-hook-local-sources-20261026.json',out:'.tmp/hook-t0-prepared-20261026'};
while(args.length){const key=args.shift(),value=args.shift();if(!['--sources','--out'].includes(key)||!value)throw Error('Invalid preparation argument');options[key.slice(2)]=value;}
const folder=resolve(options.out),objectsRoot=join(folder,'objects');
const sources=JSON.parse(await readFile(options.sources,'utf8')).items;
const active=getHookReferenceGalleryItems();
if(sources.length!==active.length||new Set(sources.map(r=>r.referenceId)).size!==active.length)throw Error('Source inventory must cover exactly the active gallery');
for(const row of sources){const item=active.find(x=>x.id===row.referenceId);if(!item||row.referenceId.startsWith('creator-account-')||item.videoSha256!==row.sourceSha256||!row.sourceFile)throw Error('Unknown, private, missing or changed source');}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function objectPath(key){const result=resolve(objectsRoot,key);const rel=relative(objectsRoot,result);if(rel.startsWith('..')||!rel||!/^[A-Za-z0-9/_.-]+$/.test(key))throw Error('Invalid object path');return result;}
const local=createStoredHookFrames({
 read:async(key,limit)=>{try{const bytes=await readFile(objectPath(key));if(bytes.length>limit)throw Error('Local object size limit');return bytes;}catch(error){if(error.code==='ENOENT')return null;throw error;}},
 create:async(key,bytes)=>{const path=objectPath(key);await mkdir(dirname(path),{recursive:true});try{await writeFile(path,bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}},
});
const remote=mode==='--publish'?createStoredHookFrames():null;
await mkdir(folder,{recursive:true});
const rows=[];
try{
 for(const row of sources){
  const frame=mode==='--prepare-local'?await local.prepare(row.sourceSha256,async()=>{
   const video=await readFile(row.sourceFile);if(hash(video)!==row.sourceSha256)throw Error('Actual source bytes changed');
   const png=await decodeHookFirstFrame(video),meta=await sharp(png).metadata();
   if(meta.width!==row.width||meta.height!==row.height)throw Error('Original opening dimensions differ from canonical source');
   return{referenceId:row.referenceId,sourceSha256:row.sourceSha256,frameIndex:0,frameTimeSeconds:0,frameSha256:hash(png),width:meta.width,height:meta.height,png};
  }):await local.read(row.sourceSha256);
  if(!frame)throw Error('Local starting frame missing: '+row.referenceId);
  let stored=frame;
  if(remote){stored=await remote.prepare(row.sourceSha256,async()=>({...frame,referenceId:row.referenceId}));if(stored.frameSha256!==frame.frameSha256)throw Error('Hosted t=0 does not match verified local pixels');}
  const item={referenceId:row.referenceId,title:row.title,sourceSha256:row.sourceSha256,frameIndex:0,frameTimeSeconds:0,frameSha256:stored.frameSha256,width:stored.width,height:stored.height,bytes:stored.png.length,indexKey:hookSourceFrameIndexKey(row.sourceSha256),imageKey:hookKeyframeSnapshotKey({sourceSha256:row.sourceSha256,sourceFrame:{sha256:stored.frameSha256}}),state:remote?'hosted-readback-verified':'local-readback-verified'};
  rows.push(item);console.log(JSON.stringify(item));
 }
 const receipt={date:'2026-10-26',mode,count:rows.length,expectedCount:active.length,allVerified:rows.length===active.length,paidGenerations:0,privateSourceUploads:0,sourceDecodes:mode==='--prepare-local'?'only missing local frames':'none',rows};
 await writeFile(join(folder,mode==='--publish'?'hosted-receipt.json':'local-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({status:'verified',mode,count:rows.length,privateSourceUploads:0,paidGenerations:0}));
}catch(error){await writeFile(join(folder,'incomplete-receipt.json'),JSON.stringify({mode,completed:rows.length,expected:active.length,error:String(error.message).replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]'),rows},null,2)+'\n');console.error(JSON.stringify({status:'incomplete',mode,completed:rows.length,error:String(error.message).replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').slice(0,500)}));process.exitCode=1;}
