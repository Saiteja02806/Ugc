import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import { getRecreateReferences } from '../lib/explore/recreate-catalog.ts';
import { referenceVideoPrompts } from '../lib/explore/reference-video-prompts.ts';

const root=path.resolve('.tmp/reference-prompt-pilot');
fs.mkdirSync(root,{recursive:true});
const references=getRecreateReferences();
// Scope: only the Hook video workflow's active reference gallery.
const inventory=references.filter(item=>item.format==='hook'&&!item.archived&&item.videoUrl).map(item=>{
 const review=referenceVideoPrompts[item.id];
 const matches=review&&path.basename(new URL(item.videoUrl).pathname,'.mp4')===review.sourceSha256;
 return {id:item.id,format:item.format,title:item.title,videoUrl:item.videoUrl,sourceSha256:path.basename(new URL(item.videoUrl).pathname,'.mp4'),status:matches?review.reviewMethod==='all_decoded_frames'?'frame_reviewed':'sample_reviewed':'pending_review'};
});
fs.writeFileSync(path.join(root,'inventory.json'),JSON.stringify(inventory,null,2));
for(const item of inventory.filter(item=>item.format==='hook').slice(0,3)){
 const source=path.resolve('.tmp/explore-paired-references/media',item.sourceSha256+'.mp4');
 const bytes=fs.readFileSync(source);
 if(createHash('sha256').update(bytes).digest('hex')!==item.sourceSha256)throw Error('Source checksum mismatch: '+item.id);
 const reference=references.find(ref=>ref.id===item.id);
 const layers=[];
 for(let i=0;i<12;i++){
  const t=(reference.durationSeconds-.06)*i/11;
  const frame=execFileSync(ffmpeg,['-v','error','-ss',String(t),'-i',source,'-frames:v','1','-vf','scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2','-f','image2pipe','-vcodec','png','-'],{windowsHide:true,maxBuffer:4*1024**2});
  const left=i%6*180,top=Math.floor(i/6)*344;
  layers.push({input:Buffer.from(`<svg width="180" height="24"><rect width="180" height="24" fill="white"/><text x="8" y="18" font-size="14">${t.toFixed(2)}s</text></svg>`),left,top});
  layers.push({input:await sharp(frame).png().toBuffer(),left,top:top+24});
 }
 const sheet=path.join(root,item.id+'.jpg');
 await sharp({create:{width:1080,height:688,channels:3,background:'white'}}).composite(layers).jpeg({quality:95}).toFile(sheet);
 console.log(JSON.stringify({id:item.id,title:item.title,source,sheet}));
}
console.log(JSON.stringify({inventory:inventory.length,output:path.join(root,'inventory.json')}));
