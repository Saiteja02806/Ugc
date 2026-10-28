import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {renderExploreFormatEdit} from '../worker/dist/lib/explore-format-render.js';
import {runMediaCommand} from '../worker/dist/subtitles/media.js';
import {initialWallText,wallTextProfile} from '../worker/dist/lib/wall-initial-text-layout.js';
import {formatTextLayout} from '../worker/dist/lib/explore-format-edit.js';
import release from '../worker/src/lib/explore-wall-money-reference-release.json' with {type:'json'};
import catalog from '../lib/explore/reference-text-catalog.json' with {type:'json'};
const out=path.resolve('outputs/wall-layout-pilot-20261028/export-'+Date.now());await fs.mkdir(out,{recursive:true});
const tools={ffmpeg:'ffmpeg',ffprobe:'ffprobe',fontsDir:path.resolve('worker/src/assets/fonts')};
const source=path.join(out,'neutral-12s.mp4');
await runMediaCommand(tools.ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x282a30:s=720x1280:r=30:d=12','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t','12','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',source]);
const results=[];
const cases=release.items.map((item,i)=>({name:'reference-'+(i+1),editing:{version:1,format:'wall_text',trimStartMs:0,trimEndMs:12000,originalVolume:1,musicVolume:.2,text:null,textOverlays:[initialWallText(catalog.items.find(s=>s.referenceId===item.id).blocks[0].text,wallTextProfile(item.id,item.videoSha256),12000)]}}));
cases.push({name:'browser-saved-edit',editing:JSON.parse(await fs.readFile('.tmp/wall-automatic-text-browser/saved-export.json','utf8'))});
for(const c of cases){const workDir=path.join(out,c.name);await fs.mkdir(workDir);const result=await renderExploreFormatEdit({sourcePath:source,width:720,height:1280,durationMs:12000,editing:c.editing,workDir,tools});
 const probe=JSON.parse((await runMediaCommand(tools.ffprobe,['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',result.outputPath])).stdout);
 assert.ok(Math.abs(Number(probe.format.duration)-12)<.1);assert.ok(probe.streams.some(s=>s.codec_type==='audio'));
 for(const [name,time] of [['opening',0],['ending',11.9]]){const file=path.join(workDir,name+'.png');await runMediaCommand(tools.ffmpeg,['-hide_banner','-loglevel','error','-ss',String(time),'-i',result.outputPath,'-frames:v','1',file]);const {data,info}=await sharp(file).raw().toBuffer({resolveWithObject:true});let ink=0;for(let i=0;i<data.length;i+=info.channels)if(data[i]>190&&data[i+1]>190&&data[i+2]>190)ink++;assert.ok(ink>100,`${c.name} text missing at ${time}`);}
 const profile=c.editing.textOverlays[0],layout=formatTextLayout(profile,720,1280);
 const original=Number(c.name.split('-')[1]);if(original>=1&&original<=6){await sharp({create:{width:720,height:640,channels:4,background:'#181818'}}).composite([{input:await sharp(path.resolve(`outputs/wall-layout-pilot-20261028/wall-money-0${original}-original.png`)).resize(360,640).toBuffer(),left:0,top:0},{input:await sharp(path.join(workDir,'opening.png')).resize(360,640).toBuffer(),left:360,top:0}]).png().toFile(path.join(workDir,'source-v-export.png'));}
 results.push({name:c.name,outputPath:result.outputPath,duration:Number(probe.format.duration),lines:layout.lines.length,fontSize:profile.fontSize,lineHeight:profile.lineHeight,width:profile.width,y:profile.y});
}
await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({out,results},null,2));
