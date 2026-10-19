import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import ffprobe from 'ffprobe-static';

export const auditRoot=path.resolve('outputs/hook-reference-audit-2026-10-19');
const batches=['explore-hook-reference-release.json','explore-hook-reference-addition-release.json','explore-hook-reference-new-batch-release.json'].map(f=>JSON.parse(fs.readFileSync(path.join('worker/src/lib',f),'utf8')));
const active=batches.flatMap(b=>b.mediaStatus==='published'&&b.activation==='active'?b.items.filter(i=>!b.excludedReferenceIds.includes(i.id)):[]);
export const inventory=active.map((item,index)=>{
 const directory=path.resolve('.tmp/hook-reference-prompt-review',item.id);
 const inspection=JSON.parse(fs.readFileSync(path.join(directory,'inspection.json'),'utf8'));
 const source=path.resolve('.tmp/explore-paired-references/media',path.basename(item.videoStorageKey));
 if(createHash('sha256').update(fs.readFileSync(source)).digest('hex')!==item.videoSha256)throw Error('Source mismatch '+item.id);
 if(inspection.sourceSha256!==item.videoSha256)throw Error('Prior frame evidence mismatch '+item.id);
 return {...item,ordinal:index+1,sourcePath:source,audioPath:path.resolve('.tmp/explore-paired-references/media',path.basename(item.audioStorageKey)),previewPath:path.resolve('.tmp/explore-paired-references/media',path.basename(item.previewStorageKey)),inspectionPath:path.join(directory,'inspection.json'),frameDirectory:directory,frameCount:inspection.decodedFrames};
});
fs.mkdirSync(auditRoot,{recursive:true});
// Immutable inventory snapshot for this audit; do not overwrite a changed selection.
const manifest=path.join(auditRoot,'inventory.json');
if(fs.existsSync(manifest)){
 const prior=JSON.parse(fs.readFileSync(manifest,'utf8'));
 if(JSON.stringify(prior.map(i=>[i.id,i.videoSha256]))!==JSON.stringify(inventory.map(i=>[i.id,i.videoSha256])))throw Error('Audit inventory changed');
}else fs.writeFileSync(manifest,JSON.stringify(inventory,null,2)+'\n',{flag:'wx'});

if(process.argv.includes('--inventory')){
 console.log(JSON.stringify({references:inventory.length,frames:inventory.reduce((a,i)=>a+i.frameCount,0),audioMinutes:inventory.reduce((a,i)=>a+i.audioDurationSeconds/60,0),manifest}));
}else {
 const ordinal=Number(process.argv[2]);const item=inventory[ordinal-1];if(!item)throw Error('Supply a valid ordinal or --inventory');
 const dir=path.join(auditRoot,'frames',String(ordinal).padStart(3,'0'));fs.mkdirSync(dir,{recursive:true});
 const probe=JSON.parse(execFileSync(ffprobe.path,['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time,pkt_duration_time','-of','json',item.sourcePath],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024**2}));
 if(probe.frames.length!==item.frameCount)throw Error('Decoded frame count changed');
 const sheets=[];
 for(let start=0;start<item.frameCount;start+=120){
  const count=Math.min(120,item.frameCount-start),layers=[];const file=path.join(dir,`all-${String(start).padStart(5,'0')}.jpg`);
  if(!fs.existsSync(file)){
   for(let i=0;i<count;i++){
    const n=start+i,left=(i%12)*80,top=Math.floor(i/12)*158;
    const frame=path.join(item.frameDirectory,`frame-${String(n).padStart(5,'0')}.png`);
    layers.push({input:Buffer.from(`<svg width="80" height="16"><rect width="80" height="16" fill="white"/><text x="2" y="12" font-size="11">${n}</text></svg>`),left,top});
    layers.push({input:await sharp(frame).resize(80,142,{fit:'contain',background:'#fff'}).png().toBuffer(),left,top:top+16});
   }
   await sharp({create:{width:960,height:Math.ceil(count/12)*158,channels:3,background:'white'}}).composite(layers).jpeg({quality:92}).toFile(file);
  }
  sheets.push({file,firstFrame:start,lastFrame:start+count-1});
 }
 const record={id:item.id,ordinal,sourceSha256:item.videoSha256,frameCount:item.frameCount,frames:probe.frames.map((f,i)=>({index:i,ptsSeconds:Number(f.best_effort_timestamp_time),durationSeconds:Number(f.pkt_duration_time)})),sheets};
 fs.writeFileSync(path.join(dir,'frames.json'),JSON.stringify(record,null,2)+'\n');
 console.log(JSON.stringify(record.sheets));
}
