import {spawnSync} from "node:child_process";
import ffmpeg from "ffmpeg-static";
const filters=spawnSync(ffmpeg,["-hide_banner","-filters"],{encoding:"utf8",windowsHide:true,timeout:10000,maxBuffer:1024*1024});
if(filters.error||filters.status!==0)throw new Error("The installed test FFmpeg could not report its filters.");
const required=["drawtext","subtitles","overlay","scale","amix"],available=Object.fromEntries(required.map(name=>[name,new RegExp(`\\b${name}\\b`).test(filters.stdout)]));
const version=spawnSync(ffmpeg,["-hide_banner","-version"],{encoding:"utf8",windowsHide:true,timeout:10000,maxBuffer:65536}).stdout.split("\n")[0];
console.log(JSON.stringify({platform:process.platform,version,required_filters:available}));
const missing=required.filter(name=>!available[name]);if(missing.length)throw new Error(`The test FFmpeg lacks required filters: ${missing.join(", ")}. Use the worker-compatible test media build.`);
