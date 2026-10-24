import assert from 'node:assert/strict';
import test from 'node:test';
import {assessHookRemixFixture} from './hook-remix-eval.ts';
import type {ReferenceText} from './reference-text.ts';
const source:ReferenceText={referenceId:'eval',slideId:null,format:'hook',status:'ready',blocks:[{text:'I lost 10kg in a week with this app 😭',startMs:0,endMs:4000}],sourceSha256:'a'.repeat(64),extractedAt:'2026-10-24T00:00:00Z',model:'fixture',notes:''};
test('a weekly meal plan is not an unverified one-week weight-loss claim',()=>{
  const expected={forbidden:['10\\s*kg','lost.*weight','lost.*kg','\\ba week\\b']};
  assert.equal(assessHookRemixFixture({blocks:['Me getting a weekly meal plan with MealMap 😭'],heading:'',body:''},source,expected).pass,true);
  assert.equal(assessHookRemixFixture({blocks:['I lost 10kg in a week'],heading:'',body:''},source,expected).pass,false);
});
