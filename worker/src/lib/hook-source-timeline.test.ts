import assert from 'node:assert/strict';
import test from 'node:test';
import {createHookSourceTimeline,parseHookSourceTimeline} from './hook-source-timeline.ts';
const receipt={version:5,promptVersion:7,referenceId:'hook-test',sourceSha256:'a'.repeat(64),sourceFrame:{index:0,timeSeconds:0}};
test('new original-opening policy preserves source speed and reversible trim; legacy and altered timelines fail',()=>{
 const t=createHookSourceTimeline(receipt,73/30,3);assert.equal(t.trimEndMs,2433);assert.equal(t.actionDurationSeconds,73/30);assert.deepEqual(parseHookSourceTimeline(JSON.parse(JSON.stringify(t)),receipt,3),t);
 assert.equal(createHookSourceTimeline(receipt,8,3).trimEndMs,3000);
 assert.equal(createHookSourceTimeline(receipt,.8,3).trimEndMs,800);
 for(const patch of [{version:4},{promptVersion:5},{sourceFrame:{index:36,timeSeconds:1.2}}])assert.throws(()=>createHookSourceTimeline({...receipt,...patch},2.4,3));
 for(const patch of [{trimEndMs:3000},{referenceId:'foreign'},{extra:true},{generatedDurationSeconds:4}])assert.throws(()=>parseHookSourceTimeline({...t,...patch},receipt,3));
});


test('new requests retain 4s and 5s sources and trim only generated excess; legacy compressed receipts still parse',()=>{
 for(const [source,generated,end] of [[4,4,4000],[5,5,5000],[4.3,5,4300],[2.3,4,2300]]){
  const t=createHookSourceTimeline(receipt,source,generated,{preserveFullSource:true});assert.equal(t.trimEndMs,end);assert.equal(t.actionDurationSeconds,source);
 }
 for(const source of [4,5])assert.throws(()=>createHookSourceTimeline(receipt,source,3,{preserveFullSource:true}),/preserve the full source/);
 const old=createHookSourceTimeline(receipt,5,3);assert.equal(parseHookSourceTimeline(old,receipt,3).trimEndMs,3000);
});
