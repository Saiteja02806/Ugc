import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ffmpeg from 'ffmpeg-static';
import { trimHookFrames,inspectFrameMedia } from './trim-hook-reference-frames.mjs';

test('lossless trimming excludes non-keyframe tails and head frames, verifies pixels/timing and protects originals',()=>{
 const parent=fs.realpathSync(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'hook-frame-trim-'));
 try{
  const sourcePath=path.join(dir,'source.mp4');
  execFileSync(ffmpeg,['-nostdin','-v','error','-n','-f','lavfi','-i','testsrc2=size=128x192:rate=30:duration=1','-c:v','libx264','-g','120','-pix_fmt','yuv420p',sourcePath],{windowsHide:true});
  const original=fs.readFileSync(sourcePath),expectedSha256=createHash('sha256').update(original).digest('hex');
  const plan={sourcePath,expectedSha256,keepStartFrame:2,keepEndFrameExclusive:29,outputDirectory:path.join(dir,'out')};
  const result=trimHookFrames(plan);assert.equal(result.retainedFrameCount,27);assert.equal(result.retainedDecodedPixelsExact,true);assert.equal(result.audioStreams,0);
  assert.deepEqual(fs.readFileSync(sourcePath),original);
  const firstBytes=fs.readFileSync(result.outputPath);const repeated=trimHookFrames(plan);assert.equal(repeated.outputSha256,result.outputSha256);assert.deepEqual(fs.readFileSync(result.outputPath),firstBytes);
  assert.throws(()=>trimHookFrames({...plan,expectedSha256:'0'.repeat(64)}),/hash mismatch/);
  for(const [start,end] of [[-1,29],[0,31],[5,5],[.1,29],[0,30]])assert.throws(()=>trimHookFrames({...plan,keepStartFrame:start,keepEndFrameExclusive:end}),/Invalid|No trim/);
 }finally{
  const target=fs.realpathSync(dir);if(path.dirname(target)!==parent||!path.basename(target).startsWith('hook-frame-trim-'))throw Error('Unsafe cleanup target');fs.rmSync(target,{recursive:true,force:true});
 }
});

test('variable frame spacing preserves the final performer hold until the excluded frame starts',()=>{
 const parent=fs.realpathSync(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'hook-frame-trim-'));
 try{
  const sourcePath=path.join(dir,'variable.mp4');
  execFileSync(ffmpeg,['-nostdin','-v','error','-n','-f','lavfi','-i','testsrc2=size=128x192:rate=30:duration=1','-vf','select=not(between(n\\,25\\,28))','-fps_mode','passthrough','-c:v','libx264','-bf','0',sourcePath],{windowsHide:true});
  const source=inspectFrameMedia(sourcePath),frames=source.frames.filter(f=>f.media_type==='video');
  const count=frames.length-1,targetEnd=Number(frames[count].best_effort_timestamp_time);
  assert.ok(targetEnd-Number(frames[count-1].best_effort_timestamp_time)>.1);
  const expectedSha256=createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
  const r=trimHookFrames({sourcePath,expectedSha256,keepStartFrame:0,keepEndFrameExclusive:count,outputDirectory:path.join(dir,'out')});
  assert.equal(r.retainedFrameCount,count);assert.ok(Math.abs(r.durationSeconds-targetEnd)<.002);assert.equal(r.sourceEndExclusiveSeconds,targetEnd);
 }finally{
  const target=fs.realpathSync(dir);if(path.dirname(target)!==parent||!path.basename(target).startsWith('hook-frame-trim-'))throw Error('Unsafe cleanup target');fs.rmSync(target,{recursive:true,force:true});
 }
});

test('audio-bearing sources require explicit bitstream preservation and retain original packet payloads',()=>{
 const parent=fs.realpathSync(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'hook-frame-trim-'));
 try{
  const sourcePath=path.join(dir,'native-audio.mp4');
  execFileSync(ffmpeg,['-nostdin','-v','error','-n','-f','lavfi','-i','testsrc2=size=128x192:rate=30:duration=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-c:a','aac','-shortest',sourcePath],{windowsHide:true});
  const expectedSha256=createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
  const plan={sourcePath,expectedSha256,keepStartFrame:2,keepEndFrameExclusive:29,outputDirectory:path.join(dir,'out')};
  assert.throws(()=>trimHookFrames(plan),/explicit preserveNativeAudio/);
  const result=trimHookFrames({...plan,preserveNativeAudio:true});
  assert.equal(result.retainedFrameCount,27);assert.equal(result.audioStreams,1);assert.equal(result.nativeAudioPacketsPreserved,true);assert.equal(result.audioReview,'deferred_by_user');
  const offsetSource=path.join(dir,'offset.mp4');
  execFileSync(ffmpeg,['-nostdin','-v','error','-n','-itsoffset','0.066','-i',sourcePath,'-map','0','-c','copy',offsetSource],{windowsHide:true});
  const offsetHash=createHash('sha256').update(fs.readFileSync(offsetSource)).digest('hex');
  const shifted=trimHookFrames({...plan,sourcePath:offsetSource,expectedSha256:offsetHash,preserveNativeAudio:true,outputDirectory:path.join(dir,'offset-out')});
  assert.equal(shifted.nativeAudioPacketsPreserved,true);assert.ok(shifted.sourceStartSeconds>0);assert.ok(shifted.maxTimestampErrorSeconds<.001);
 }finally{
  const target=fs.realpathSync(dir);if(path.dirname(target)!==parent||!path.basename(target).startsWith('hook-frame-trim-'))throw Error('Unsafe cleanup target');fs.rmSync(target,{recursive:true,force:true});
 }
});
