import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const command=(binary,args)=>execFileSync(binary,args,{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:32*1024**2});
export function inspectFrameMedia(file){
 return JSON.parse(command(ffprobe.path,['-v','error','-show_streams','-show_format','-show_frames','-show_entries','stream=codec_type,codec_name,pix_fmt,width,height,time_base,duration,start_time:format=duration,start_time:frame=media_type,best_effort_timestamp_time,pkt_duration_time','-of','json',file]));
}
function pictureHashes(file){
 return command(ffmpeg,['-nostdin','-v','error','-xerror','-i',file,'-map','0:v:0','-fps_mode','passthrough','-f','framemd5','pipe:1'])
  .split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>l.split(',').at(-1).trim());
}

/** Local, lossless, exact decoded-frame selection. Originals and existing outputs are never overwritten. */
export function trimHookFrames({sourcePath,expectedSha256,keepStartFrame,keepEndFrameExclusive,outputDirectory,preserveNativeAudio=false}){
 const source=path.resolve(sourcePath),directory=path.resolve(outputDirectory);
 const bytes=fs.readFileSync(source);if(sha(bytes)!==expectedSha256)throw Error('Original source hash mismatch; stop and re-audit.');
 const probe=inspectFrameMedia(source),video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.filter(s=>s.codec_type==='audio');
 const frames=probe.frames.filter(f=>f.media_type==='video');
 if(!Number.isInteger(keepStartFrame)||!Number.isInteger(keepEndFrameExclusive)||keepStartFrame<0||keepStartFrame>=keepEndFrameExclusive||keepEndFrameExclusive>frames.length)throw Error('Invalid exact frame range.');
 if(keepStartFrame===0&&keepEndFrameExclusive===frames.length)throw Error('No trim requested.');
 if(!video||!['yuv420p','yuvj420p'].includes(video.pix_fmt))throw Error('Pixel format requires individual review before lossless trimming.');
 // Native audio requires explicit bitstream preservation. Never silently drop
 // it, analyze its content, or re-encode it during this video-only operation.
 if(audio.length&&!preserveNativeAudio)throw Error('Source contains audio; explicit preserveNativeAudio is required to copy native audio without analyzing it.');
 const start=Number(frames[keepStartFrame].best_effort_timestamp_time),lastRetained=frames[keepEndFrameExclusive-1];
 // A player holds the last retained picture until the next frame's PTS,
 // including variable-frame-rate gaps. Preserve that hold at the cut.
 const retainedEnd=keepEndFrameExclusive<frames.length?Number(frames[keepEndFrameExclusive].best_effort_timestamp_time):Number(lastRetained.best_effort_timestamp_time)+Number(lastRetained.pkt_duration_time);
 const duration=retainedEnd-start;
 const expectedCount=keepEndFrameExclusive-keepStartFrame;
 const finalHoldSeconds=retainedEnd-Number(lastRetained.best_effort_timestamp_time);
 if(!Number.isFinite(duration)||duration<=0)throw Error('Invalid source sample timing');
 fs.mkdirSync(directory,{recursive:true});
 const pending=path.join(directory,`trim-${process.pid}-${Date.now()}.mp4`);
 if(fs.existsSync(pending))throw Error('Temporary destination already exists.');
 command(ffmpeg,['-nostdin','-v','error','-xerror','-n','-protocol_whitelist','file,pipe','-i',source,
  // FFmpeg normalizes each input by its container start; compensate that
  // normalization before aligning native audio with the retained video PTS.
  ...(audio.length?['-itsoffset',String(Number(probe.format.start_time??0)-start),'-protocol_whitelist','file,pipe','-i',source]:[]),
  '-map','0:v:0','-vf',`trim=start_frame=${keepStartFrame}:end_frame=${keepEndFrameExclusive},setpts=PTS-STARTPTS`,
  '-c:v','libx264','-preset','medium','-qp','0','-bf','0','-pix_fmt',video.pix_fmt,'-fps_mode','passthrough','-enc_time_base','filter',
  '-bsf:v',`setts=duration='if(eq(N,${expectedCount-1}),${finalHoldSeconds}/TB,DURATION)'`,
  ...(audio.length?['-map','1:a','-c:a','copy','-t',String(duration)]:['-an']),'-movflags','+faststart',pending]);
 const outputProbe=inspectFrameMedia(pending),outputFrames=outputProbe.frames.filter(f=>f.media_type==='video');
 if(outputFrames.length!==expectedCount||outputProbe.streams.filter(s=>s.codec_type==='audio').length!==audio.length)throw Error('Trim output stream/frame count mismatch; inspect pending output.');
 const originalPictures=pictureHashes(source).slice(keepStartFrame,keepEndFrameExclusive),outputPictures=pictureHashes(pending);
 if(JSON.stringify(originalPictures)!==JSON.stringify(outputPictures))throw Error('Trim changed retained decoded pixels; inspect pending output.');
 const outputStart=Number(outputFrames[0].best_effort_timestamp_time),outputVideo=outputProbe.streams.find(s=>s.codec_type==='video');
 if(Math.abs(outputStart)>.001||Math.abs(Number(outputVideo.duration)-duration)>.002)throw Error('Trim changed retained sample duration or start; inspect pending output.');
 let nativeAudioPacketsPreserved=null;
 if(audio.length){
  const packets=file=>JSON.parse(command(ffprobe.path,['-v','error','-select_streams','a','-show_packets','-show_data_hash','sha256','-show_entries','packet=pts_time,duration_time,data_hash','-of','json',file])).packets;
  const originals=packets(source),copied=packets(pending);if(!copied.length)throw Error('Native audio disappeared');
  for(const packet of copied){
   if(!originals.some(p=>p.data_hash===packet.data_hash&&Math.abs(Number(p.pts_time)-start-Number(packet.pts_time))<.002))throw Error('Native audio payload/timing changed; inspect pending output');
  }
  nativeAudioPacketsPreserved=true;
 }
 let maxTimestampErrorSeconds=0;
 for(let i=0;i<expectedCount;i++){
  const error=Math.abs((Number(frames[keepStartFrame+i].best_effort_timestamp_time)-start)-(Number(outputFrames[i].best_effort_timestamp_time)-outputStart));
  if(!Number.isFinite(error)||error>.001)throw Error('Trim changed retained frame timing; inspect pending output.');
  maxTimestampErrorSeconds=Math.max(maxTimestampErrorSeconds,error);
 }
 // Verify the source again before recording the derivative.
 if(sha(fs.readFileSync(source))!==expectedSha256)throw Error('Original changed during trimming.');
 const resultBytes=fs.readFileSync(pending),outputSha256=sha(resultBytes),outputPath=path.join(directory,outputSha256+'.mp4');
 if(fs.existsSync(outputPath)){
  if(sha(fs.readFileSync(outputPath))!==outputSha256)throw Error('Existing derivative hash mismatch.');
  fs.unlinkSync(pending);
 }else {
  fs.writeFileSync(outputPath,resultBytes,{flag:'wx'});
  if(sha(fs.readFileSync(outputPath))!==outputSha256)throw Error('Derivative write verification failed; preserve pending output for inspection.');
  fs.unlinkSync(pending);
 }
 const receipt={sourcePath:source,sourceSha256:expectedSha256,originalFrameCount:frames.length,keepStartFrame,keepEndFrameExclusive,retainedFrameCount:expectedCount,
  sourceStartSeconds:start,sourceEndExclusiveSeconds:retainedEnd,
  nextExcludedFrameSeconds:keepEndFrameExclusive<frames.length?Number(frames[keepEndFrameExclusive].best_effort_timestamp_time):null,
  outputPath,outputSha256,durationSeconds:Number(outputVideo.duration),containerDurationSeconds:Number(outputProbe.format.duration),width:video.width,height:video.height,
  retainedDecodedPixelsExact:true,maxTimestampErrorSeconds,sourceUnchanged:true,audioStreams:audio.length,nativeAudioPacketsPreserved,
  audioReview:'deferred_by_user',encoding:'lossless-h264',published:false};
 const receiptPath=path.join(directory,outputSha256+'.json');
 if(!fs.existsSync(receiptPath))fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 else if(fs.readFileSync(receiptPath,'utf8')!==JSON.stringify(receipt,null,2)+'\n'){
  // Retain prior evidence if a verification policy is tightened on a later run.
  const versionedReceipt=path.join(directory,outputSha256+'.'+sha(Buffer.from(JSON.stringify(receipt))).slice(0,12)+'.json');
  if(!fs.existsSync(versionedReceipt))fs.writeFileSync(versionedReceipt,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 }
 return receipt;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const file=process.argv[2];if(!file)throw Error('Supply a JSON plan: {sourcePath,expectedSha256,keepStartFrame,keepEndFrameExclusive,outputDirectory}.');
 console.log(JSON.stringify(trimHookFrames(JSON.parse(fs.readFileSync(file,'utf8'))),null,2));
}
