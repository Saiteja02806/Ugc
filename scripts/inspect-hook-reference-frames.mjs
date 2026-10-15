import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import sharp from 'sharp';

// Sequential, local inspection. This neither analyses through a paid model nor
// marks a prompt reviewed: the agent must inspect every returned sheet first.
const ordinal=Number(process.argv[2]??1);
const inventory=JSON.parse(fs.readFileSync('.tmp/reference-prompt-pilot/inventory.json','utf8'));
if(!Number.isInteger(ordinal)||ordinal<1||ordinal>inventory.length)throw Error('Choose an existing Hook ordinal.');
const item=inventory[ordinal-1];
if(item.format!=='hook')throw Error('Only Hook references are in scope.');
const source=path.resolve('.tmp/explore-paired-references/media',item.sourceSha256+'.mp4');
if(createHash('sha256').update(fs.readFileSync(source)).digest('hex')!==item.sourceSha256)throw Error('Source hash mismatch.');
const root=path.resolve('.tmp/hook-reference-prompt-review',item.id);
fs.mkdirSync(root,{recursive:true});
const probe=JSON.parse(execFileSync(ffprobe.path,['-v','error','-show_streams','-show_format','-of','json',source],{windowsHide:true,encoding:'utf8'}));
const stream=probe.streams.find(s=>s.codec_type==='video');
execFileSync(ffmpeg,['-nostdin','-v','error','-xerror','-i',source,'-map','0:v:0','-fps_mode','passthrough','-vf','scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2','-start_number','0',path.join(root,'frame-%05d.png')],{windowsHide:true,timeout:120000});
const frames=fs.readdirSync(root).filter(f=>/^frame-\d{5}\.png$/.test(f)).sort();
if(Number(stream.nb_frames)!==frames.length)throw Error('Decoded frame count does not match source.');
const sheets=[];
for(let start=0;start<frames.length;start+=24){
 const batch=frames.slice(start,start+24),layers=[];
 for(const [i,file]of batch.entries()){
  const left=i%6*180,top=Math.floor(i/6)*344,number=start+i;
  layers.push({input:Buffer.from(`<svg width="180" height="24"><rect width="180" height="24" fill="white"/><text x="6" y="18" font-size="13">Frame ${number}</text></svg>`),left,top});
  layers.push({input:await sharp(path.join(root,file)).png().toBuffer(),left,top:top+24});
 }
 const sheet=path.join(root,`sheet-${String(start).padStart(5,'0')}.jpg`);
 await sharp({create:{width:1080,height:Math.ceil(batch.length/6)*344,channels:3,background:'white'}}).composite(layers).jpeg({quality:96}).toFile(sheet);
 sheets.push({file:sheet,firstFrame:start,lastFrame:start+batch.length-1});
}
const result={id:item.id,title:item.title,source,sourceSha256:item.sourceSha256,durationSeconds:Number(stream.duration??probe.format.duration),width:stream.width,height:stream.height,frameRate:stream.avg_frame_rate,decodedFrames:frames.length,fullVideoDecode:true,reviewStatus:'awaiting_visual_inspection',sheets};
fs.writeFileSync(path.join(root,'inspection.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
