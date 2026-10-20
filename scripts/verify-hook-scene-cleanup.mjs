import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import {inspectFrameMedia} from './trim-hook-reference-frames.mjs';

const root=path.resolve('outputs/hook-reference-audit-2026-10-19');
const audit=JSON.parse(fs.readFileSync(path.join(root,'audit.json')));
const inventory=JSON.parse(fs.readFileSync(path.join(root,'inventory.json')));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=(binary,args)=>execFileSync(binary,args,{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:32*1024**2});
const pictures=file=>run(ffmpeg,['-nostdin','-v','error','-xerror','-i',file,'-map','0:v:0','-fps_mode','passthrough','-f','framemd5','pipe:1']).split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>l.split(',').at(-1).trim());
const audioPackets=file=>JSON.parse(run(ffprobe.path,['-v','error','-select_streams','a','-show_packets','-show_data_hash','sha256','-show_entries','packet=pts_time,duration_time,data_hash','-of','json',file])).packets;
const checks=[];
for(const row of audit.items.filter(r=>r.receipt)){
 const receipt=row.receipt,item=inventory[row.ordinal-1];
 if(row.approval!=='approved_by_user'||sha(item.sourcePath)!==row.sourceSha256||sha(receipt.outputPath)!==receipt.outputSha256)throw Error('Source/output approval or checksum mismatch');
 const original=inspectFrameMedia(item.sourcePath),corrected=inspectFrameMedia(receipt.outputPath);
 const sourceFrames=original.frames.filter(f=>f.media_type==='video'),outputFrames=corrected.frames.filter(f=>f.media_type==='video');
 const expected=sourceFrames.slice(row.keepStartFrame,row.keepEndFrameExclusive);
 if(expected.length!==outputFrames.length||outputFrames.length!==receipt.retainedFrameCount)throw Error('Frame count mismatch');
 const firstPts=Number(expected[0].best_effort_timestamp_time),end=Number(sourceFrames[row.keepEndFrameExclusive].best_effort_timestamp_time),targetDuration=end-firstPts;
 const sourceVideo=original.streams.find(s=>s.codec_type==='video'),outputVideo=corrected.streams.find(s=>s.codec_type==='video');
 if(sourceVideo.width!==outputVideo.width||sourceVideo.height!==outputVideo.height||Math.abs(Number(outputVideo.duration)-targetDuration)>.002)throw Error('Video dimensions/end boundary changed');
 let maxPtsError=0;
 for(let n=0;n<expected.length;n++)maxPtsError=Math.max(maxPtsError,Math.abs(Number(expected[n].best_effort_timestamp_time)-firstPts-Number(outputFrames[n].best_effort_timestamp_time)));
 if(maxPtsError>.001)throw Error('Retained frame timestamps changed');
 const sourcePictures=pictures(item.sourcePath).slice(row.keepStartFrame,row.keepEndFrameExclusive),actualPictures=pictures(receipt.outputPath);
 if(JSON.stringify(sourcePictures)!==JSON.stringify(actualPictures))throw Error('Retained decoded image pixels differ');
 const nativeSource=original.streams.filter(s=>s.codec_type==='audio'),nativeOutput=corrected.streams.filter(s=>s.codec_type==='audio');
 if(nativeSource.length!==nativeOutput.length)throw Error('Native audio stream missing/added');
 if(nativeSource.length){
  const sourcePackets=audioPackets(item.sourcePath),outputPackets=audioPackets(receipt.outputPath);
  for(const packet of outputPackets)if(!sourcePackets.some(p=>p.data_hash===packet.data_hash&&Math.abs(Number(p.pts_time)-firstPts-Number(packet.pts_time))<.002))throw Error('Native audio payload/timing changed');
  for(const packet of sourcePackets.filter(p=>Number(p.pts_time)>=firstPts&&Number(p.pts_time)<end))if(!outputPackets.some(p=>p.data_hash===packet.data_hash&&Math.abs(Number(packet.pts_time)-firstPts-Number(p.pts_time))<.002))throw Error('Native audio packet lost inside retained interval');
 }
 checks.push({ordinal:row.ordinal,id:row.id,sourceSha256:row.sourceSha256,outputSha256:receipt.outputSha256,outputPath:receipt.outputPath,retainedFrames:outputFrames.length,removedFrames:sourceFrames.length-outputFrames.length,
  exactRetainedDecodedPixels:true,maxPtsErrorSeconds:maxPtsError,endBoundarySeconds:end,videoDurationSeconds:Number(outputVideo.duration),finalDisplayHoldSeconds:end-Number(expected.at(-1).best_effort_timestamp_time),nativeAudioStreams:nativeOutput.length,nativeAudioPacketIntegrity:true,fullVideoDecode:true});
 console.log(`Reverified Hook ${row.ordinal}: ${outputFrames.length} exact frames, correct cut/hold, ${nativeOutput.length} native audio stream(s)`);
}
if(checks.length!==18)throw Error('Expected18 approved trims');
const hook18=inventory[17];if(sha(hook18.sourcePath)!==hook18.videoSha256||sha(audit.manualReview.videoPath)!==hook18.videoSha256)throw Error('Hook18 original changed');
const audioMap=JSON.parse(fs.readFileSync('outputs/Hook Reference Audio Review/AUDIO-MAP.json'));
for(const item of audioMap.items){
 const dir=path.resolve('outputs/Hook Reference Audio Review',item.folderName);
 if(item.backgroundAudio&&sha(path.join(dir,item.backgroundAudio.file))!==item.backgroundAudio.sha256)throw Error('Manual-review background audio changed');
 for(const native of item.nativeVideoAudio)if(sha(path.join(dir,native.file))!==native.sha256)throw Error('Manual-review native audio changed');
}
const audioCount=audioMap.items.reduce((sum,r)=>sum+Number(Boolean(r.backgroundAudio))+r.nativeVideoAudio.length,0);
const record={version:1,verifiedAt:new Date().toISOString(),scope:'Read-only fresh verification of current 18 corrected media files',checks,hook18Unchanged:true,manualAudioFilesUnchanged:audioCount,audioContentAnalyzed:false,paidModelCalls:0};
fs.writeFileSync(path.join(root,'reverification.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({verified:checks.length,hook18Unchanged:true,manualAudioFilesUnchanged:audioCount}));
