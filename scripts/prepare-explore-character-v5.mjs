// Package the native AE v5 film, preserving its exact frame count and timing.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";
const out=path.resolve("design/explore-character-motion/Preview/v5");
const source=path.join(out,"ai-character-v5-master-delivery.mp4"), video=path.join(out,"ai-character-v5.mp4");
function run(exe,args,encoding="utf8"){
 const r=spawnSync(exe,args,{encoding,windowsHide:true,maxBuffer:64*1024*1024});
 if(r.status!==0)throw Error(r.stderr?.toString()||r.error?.message||"Media command failed.");
 return r.stdout;
}
function inspect(file){
 const d=JSON.parse(run(ffprobe.path,["-v","error","-show_streams","-of","json",file]));
 const v=d.streams.find(s=>s.codec_type==="video");
 if(!v||v.width!==960||v.height!==540||v.r_frame_rate!=="24/1"||Number(v.nb_frames)!==384||Math.abs(Number(v.duration)-16)>.01)throw Error("Expected 960x540, 24fps, 384 frames, 16 seconds.");
 return d;
}
inspect(source);
run(ffmpeg,["-hide_banner","-loglevel","error","-y","-i",source,"-map","0:v:0","-an","-c:v","libx264","-preset","slow","-crf","20","-pix_fmt","yuv420p","-movflags","+faststart",video]);
const metadata=inspect(video);
if(metadata.streams.some(s=>s.codec_type==="audio"))throw Error("Cover must be silent.");
run(ffmpeg,["-hide_banner","-loglevel","error","-i",video,"-map","0:v:0","-f","null","-"]);
const raw=run(ffmpeg,["-hide_banner","-loglevel","error","-i",video,"-vf","scale=96:54","-pix_fmt","rgb24","-f","rawvideo","-"],null);
const size=96*54*3,frames=[];
for(let offset=0;offset<raw.length;offset+=size){
 let hits=0;for(let i=offset;i<offset+size;i+=3)if(Math.abs(raw[i]-32)+Math.abs(raw[i+1]-32)+Math.abs(raw[i+2]-32)>24)hits++;
 frames.push(hits/(96*54));
}
if(frames.length!==384||Math.min(...frames)<.03)throw Error("Missing or almost empty frame in the timeline.");
const times=[0,.32,.65,1.2,1.7,2.05,2.4,2.85,3.5,4.5,4.8,5.1,5.35,5.6,5.9,6.5,7.3,7.8,8,8.2,8.4,8.7,9.25,9.8,10.1,10.4,11.2,11.9,12.15,12.4,12.75,13.1,13.8,14.5,14.9,15.2,15.45,15.75,383/24];
const tiles=[];
for(let i=0;i<times.length;i++){
 const f=path.join(out,"review-"+String(i).padStart(2,"0")+".png");
 run(ffmpeg,["-hide_banner","-loglevel","error","-y","-ss",String(times[i]),"-i",video,"-frames:v","1",f]);
 tiles.push({input:await sharp(f).resize(240,135).png().toBuffer(),left:i%5*240,top:Math.floor(i/5)*157});
 tiles.push({input:Buffer.from('<svg width="240" height="22"><rect width="240" height="22" fill="#161616"/><text x="8" y="16" fill="white" font-family="Arial" font-size="12">'+times[i].toFixed(3)+' s</text></svg>'),left:i%5*240,top:Math.floor(i/5)*157+135});
}
await sharp({create:{width:1200,height:Math.ceil(times.length/5)*157,channels:3,background:"#1f1f1f"}}).composite(tiles).jpeg({quality:93}).toFile(path.join(out,"storyboard-v5.jpg"));
await sharp(path.join(out,"review-03.png")).webp({quality:92}).toFile(path.join(out,"ai-character-v5.webp"));
const bytes=readFileSync(video);let fastStart=false;
for(let o=0;o+8<=bytes.length;){const n=bytes.readUInt32BE(o),t=bytes.toString("ascii",o+4,o+8);if(t==="moov"){fastStart=true;break;}if(t==="mdat"||n<8)break;o+=n;}
if(!fastStart)throw Error("Movie header must precede media.");
const manifest={version:5,width:960,height:540,fps:24,frames:384,duration:16,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),silent:true,fastStart,fullDecodeVerified:true,minVisibleFrameFraction:Math.min(...frames),reviewTimes:times,chapters:[{start:0,end:5,text:"Imagine your AI character"},{start:5,end:8,text:"Build a character of your own"},{start:8,end:12,text:"For yourself. For your business."},{start:12,end:16,text:"Create your AI character with UGCpilot"}]};
writeFileSync(path.join(out,"ai-character-v5.json"),JSON.stringify(manifest,null,2)+"\n");
writeFileSync(path.join(out,"preview.html"),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Create your AI character — v5</title><style>html{background:#1f1f1f;color:#f5f5f1;font:16px system-ui}body{margin:0;padding:24px}main{max-width:960px;margin:auto}video{display:block;width:100%;aspect-ratio:16/9;border-radius:12px}p{color:#b8b8b8}h1{font-size:24px}</style><main><h1>Create your AI character</h1><video src="ai-character-v5.mp4" poster="ai-character-v5.webp" autoplay muted loop playsinline preload="auto"></video><p>Independent examples. Create an AI character for yourself or your business.</p></main></html>');
const pub=path.resolve("public/explore/characters");mkdirSync(pub,{recursive:true});
copyFileSync(video,path.join(pub,"ai-character-create-yours-v5.mp4"));
copyFileSync(path.join(out,"ai-character-v5.webp"),path.join(pub,"ai-character-create-yours-v5.webp"));
console.log(JSON.stringify(manifest));
