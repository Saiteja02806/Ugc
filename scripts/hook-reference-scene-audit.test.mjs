import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const record=JSON.parse(fs.readFileSync(new URL('./data/hook-reference-scene-audit-2026-10-19.json',import.meta.url),'utf8'));
const sceneRelease=JSON.parse(fs.readFileSync(new URL('./data/hook-reference-scene-release.json',import.meta.url),'utf8'));
const batches=['explore-hook-reference-release.json','explore-hook-reference-addition-release.json','explore-hook-reference-new-batch-release.json'].map(f=>JSON.parse(fs.readFileSync(new URL('../worker/src/lib/'+f,import.meta.url),'utf8')));
const active=batches.flatMap(b=>b.mediaStatus==='published'&&b.activation==='active'?b.items.filter(i=>record.items.some(row=>row.id===i.id)):[]);
// Preserve the historical audit cohort even when later discovery policy hides entries.
test('all historically audited Hooks have unique source-bound scene reviews; ambiguous reveal is not trimmed',()=>{
 assert.equal(record.items.length,98);assert.equal(active.length,record.items.length);assert.equal(new Set(record.items.map(i=>i.id)).size,98);
 for(const [n,item]of record.items.entries()){
  assert.equal(item.ordinal,n+1);assert.equal(item.id,active[n].id);
  const released=sceneRelease.items.find(r=>r.id===item.id);
  assert.equal(item.sourceSha256,released?.original.videoSha256??active[n].videoSha256);
  assert.equal(active[n].videoSha256,released?.replacement.videoSha256??item.sourceSha256);
  assert.equal(item.audio,'deferred_by_user');
 }
 assert.equal(record.items.reduce((sum,r)=>sum+r.originalFrameCount,0),9773);
 assert.equal(record.items.filter(r=>r.status==='clean').length,79);
 assert.deepEqual(record.items.filter(r=>r.status==='needs_review').map(r=>r.ordinal),[]);
 assert.deepEqual(record.items.filter(r=>r.status==='keep_by_user').map(r=>r.ordinal),[18]);
 assert.equal(record.items[17].outputSha256,undefined);
 assert.equal(record.activation,'staged_only_not_published');
});
test('cleanup records remove exactly reviewed contiguous tails and pair prompts/captions with the new media hash',()=>{
 const trims=record.items.filter(r=>r.status==='trim_boundary');assert.equal(trims.length,18);let removed=0;
 for(const row of trims){
  assert.equal(row.approval,'approved_by_user');
  assert.equal(row.keepStartFrame,0);assert.equal(row.outputFrameCount,row.keepEndFrameExclusive);
  assert.deepEqual(row.unwantedRanges.flatMap(r=>Array.from({length:r.endFrame-r.startFrame+1},(_,i)=>r.startFrame+i)),Array.from({length:row.originalFrameCount-row.outputFrameCount},(_,i)=>row.outputFrameCount+i));
  assert.notEqual(row.outputSha256,row.sourceSha256);assert.equal(row.proposedRemixText.sourceSha256,row.outputSha256);
  assert.ok(row.proposedPerformance.length>100);assert.ok(row.maxTimestampErrorSeconds<.001);assert.equal(row.retainedDecodedPixelsExact,true);
  for(const b of row.proposedRemixText.blocks){assert.ok(b.startMs>=0);assert.ok(b.endMs>b.startMs);assert.ok(b.endMs<=Math.ceil(row.outputDurationSeconds*1000));}
  if(row.nativeAudioStreams)assert.equal(row.nativeAudioPacketsPreserved,true);
  removed+=row.originalFrameCount-row.outputFrameCount;
 }
 assert.equal(removed,22);
 assert.deepEqual(trims.filter(r=>r.nativeAudioStreams).map(r=>r.ordinal),[6,53,54,88]);
});
