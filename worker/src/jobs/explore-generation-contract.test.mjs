import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'explore-contract-test-'));
const source=join(dir,'source.mp4');
execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=64x96:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','4','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
const original=readFileSync(source);
let received, uploaded;
mock.module('../../dist/lib/reapi-video.js',{namedExports:{generateReapiVideoBuffer:async input=>{
  received=input; await input.onOperationCreated('same-paid-task');
  await input.onOperationSucceeded('same-paid-task',undefined,{generationId:'same-paid-task',costUsd:1}); return original;
}}});
mock.module('../../dist/lib/storage.js',{namedExports:{getStoredObject:async()=>null,uploadBufferToStorage:async p=>{uploaded=p.buffer;return{key:p.key,url:'https://owned.example/result.mp4'};}}});
const {runGenerateHookVideoJob}=await import('../../dist/jobs/generate-hook-video.js');
const {getAssetReferenceSoundtrack}=await import('../../dist/lib/explore-reference-soundtrack.js');
after(()=>{mock.restoreAll();rmSync(dir,{recursive:true,force:true});});
const probe=path=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',path],{encoding:'utf8'}));
const pictureHash=path=>execFileSync('ffmpeg',['-v','error','-i',path,'-map','0:v:0','-f','hash','-hash','sha256','-'],{encoding:'utf8'});

test('both formats persist source edits and silence after provider output; opt-in audio and images-only generation stay usable',async()=>{
  for(const format of ['hook','wall_text'])for(const operation of ['source_edit','generate'])for(const sound of ['off','on']){
    let operationRecord;
    const contract={version:1,operation,sound};
    const store={
      getGenerationProviderOperation:async({operationKey})=>operationKey==='primary-higgsfield'?null:operationRecord??null,
      reserveGenerationProviderOperation:async p=>({shouldSubmit:true,operation:operationRecord={status:'reserved',provider_operation_id:null,metadata:p.metadata}}),
      markGenerationProviderSubmitted:async p=>{operationRecord.provider_operation_id=p.providerOperationId;},
      markGenerationProviderSucceeded:async p=>{operationRecord.metadata=p.metadata;},
      markGenerationOutputPersisted:async p=>{operationRecord.metadata=p.metadata;},
    };
    const input={model:'seedance_2_5',provider:'reapi',projectId:'ai-studio',userId:'owner',videoId:'fixture',exploreFormat:format,promptMode:'direct',
      hookIdea:'Change the face. Remove captions.',aspectRatio:'9:16',resolution:'720p',durationSeconds:4,
      referenceImageUrls:['https://owned.example/face-one.png','https://owned.example/face-two.png'],referenceAudioUrls:[],referenceAudioDurationSeconds:[],exploreGeneration:contract,
      ...(operation==='source_edit'?{referenceVideoMode:'edit',referenceVideoUrl:'https://owned.example/source.mp4',referenceVideoDurationSeconds:4}:{})};
    const result=await runGenerateHookVideoJob({id:'job',user_id:'owner',input_json:input},{store,checkpoint:async()=>{}});
    assert.deepEqual(received.exploreGeneration,contract);assert.deepEqual(received.referenceImageUrls,input.referenceImageUrls);
    assert.ok(received.prompt.endsWith(input.hookIdea));assert.equal(received.referenceVideoUrl,input.referenceVideoUrl);
    assert.deepEqual(result.exploreGeneration,contract);assert.deepEqual(operationRecord.metadata.exploreGeneration,contract);
    const path=join(dir,'output.mp4');writeFileSync(path,uploaded);
    assert.equal(probe(path).streams.some(s=>s.codec_type==='audio'),sound==='on');
    assert.equal(pictureHash(path),pictureHash(source),'mute must preserve every decoded picture');
    if(operation==='source_edit')assert.ok(Math.abs(result.durationSeconds-4)<.25);
    assert.equal(getAssetReferenceSoundtrack({exploreGeneration:{version:1,operation,sound:'off'},exploreReferenceId:'unused'}),null);
  }
});
