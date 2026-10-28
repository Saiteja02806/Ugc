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
