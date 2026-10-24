import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {referenceVideoPrompts,getReferenceVideoPrompt} from '../lib/explore/reference-video-prompts.ts';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const release=read('./data/hook-reference-scene-release.json');
const audit=read('./data/hook-reference-scene-audit-2026-10-19.json');
const manifests=['explore-hook-reference-release.json','explore-hook-reference-addition-release.json','explore-hook-reference-new-batch-release.json'].map(f=>read('../worker/src/lib/'+f));
const active=manifests.flatMap(m=>m.items.filter(i=>audit.items.some(row=>row.id===i.id)));
const captions=read('../lib/explore/reference-text-catalog.json');
test('exactly the 18 approved scene trims activate matching source, gallery preview, duration, prompt and text identities',()=>{
 assert.equal(active.length,98);assert.equal(release.items.length,18);
 assert.deepEqual(release.items.map(i=>i.ordinal),[1,2,3,4,6,7,20,30,39,40,42,43,53,54,71,78,88,89]);
 for(const row of release.items){
  const current=active.find(i=>i.id===row.id),decision=audit.items.find(i=>i.id===row.id),next=row.replacement;
  assert.equal(decision.approval,'approved_by_user');assert.equal(row.original.videoSha256,decision.sourceSha256);
  assert.equal(next.videoSha256,decision.outputSha256);assert.notEqual(current.videoSha256,row.original.videoSha256);
  for(const key of ['videoSha256','videoStorageKey','previewSha256','previewStorageKey','durationSeconds'])assert.equal(current[key],next[key]);
  assert.equal(current.videoStorageKey,`explore/paired-references/v1/${current.videoSha256}.mp4`);
  assert.equal(current.previewStorageKey,`explore/paired-references/v1/${current.previewSha256}.mp4`);
  for(const key of ['id','audioStorageKey','audioSha256','audioPolicy','posterStorageKey','posterSha256','sourceFolder'])assert.equal(current[key],row.original[key]);
  const prompt=referenceVideoPrompts[row.id],text=captions.items.find(t=>t.referenceId===row.id&&t.slideId===null);
  assert.equal(prompt.sourceSha256,current.videoSha256);assert.equal(prompt.reviewedFrameCount,next.frames);
  assert.ok(getReferenceVideoPrompt(row.id,'https://storage.googleapis.com/ugcsaas-media/'+current.videoStorageKey));
  assert.equal(getReferenceVideoPrompt(row.id,'https://storage.googleapis.com/ugcsaas-media/'+row.original.videoStorageKey),undefined);
  assert.equal(text.sourceSha256,current.videoSha256);assert.deepEqual(text.blocks,decision.proposedRemixText.blocks);
  assert.ok(text.blocks.every(b=>b.startMs>=0&&b.endMs>b.startMs&&b.endMs<=Math.ceil(current.durationSeconds*1000)));
 }
});
test('Hook 18 and all three rejected-audio decisions survive scene activation; old source identities are archived',()=>{
 const hook18=audit.items[17],current=active.find(i=>i.id===hook18.id);assert.equal(current.videoSha256,hook18.sourceSha256);
 assert.ok(!release.items.some(i=>i.id===hook18.id));
 const rejected=read('./data/hook-reference-rejected-background-audio.json');
 assert.deepEqual(active.filter(i=>i.audioPolicy==='silent').map(i=>i.id).sort(),rejected.items.map(i=>i.referenceId).sort());
 assert.equal(active.find(i=>i.id===audit.items[2].id).previewSha256,active.find(i=>i.id===audit.items[2].id).videoSha256);
 assert.ok(release.items.every(i=>i.original.videoStorageKey.endsWith(i.original.videoSha256+'.mp4')&&i.originalText.sourceSha256===i.original.videoSha256&&i.originalPrompt.sourceSha256===i.original.videoSha256));
});
