import assert from 'node:assert/strict';
import test from 'node:test';
import { generateBusinessTrendingWallTextIdeas } from '../lib/trending/generate-trending-wall-text-ideas.ts';
import { createWallTextLayout } from '../lib/trending/wall-text-feed-logic.ts';
import { getWallTextRepairBudget } from '../lib/trending/wall-text-repair-budget.ts';

test('successive fit repairs tighten the budget without dropping below the product minimum',()=>{
  const first=getWallTextRepairBudget({maxWords:32,targetWords:32});
  const second=getWallTextRepairBudget(first);
  assert.deepEqual(first,{maxWords:28,targetWords:28});
  assert.deepEqual(second,{maxWords:24,targetWords:24});
  assert.deepEqual(getWallTextRepairBudget(second),second);
});

test('a rejected layout gets a smaller rewrite and already accepted items are not regenerated', async () => {
  const originalFetch=globalThis.fetch;
  const originalKey=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='test-key';
  const requests=[];
  const accepted=[];
  const good='The notes on my desk looked clear until the day got busy. One short list helped me see what still needed my time and care.';
  const repair='A full week can leave small tasks out of sight. A clear plan brings them back into view before the day gets too busy.';
  const rejected=Array(24).fill('mischaracterization').join(' ')+'.';
  globalThis.fetch=async(_url,init)=>{
    const body=JSON.parse(init.body);
    requests.push(body.messages[1].content);
    const ideas=requests.length===1 ? [{candidateIndex:0,text:good},{candidateIndex:1,text:rejected}] : [{candidateIndex:1,text:repair}];
    return new Response(JSON.stringify({id:'test',object:'chat.completion',created:0,model:'gpt-5-mini',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({ideas}),refusal:null}}]}),{headers:{'content-type':'application/json'}});
  };
  try {
    const result=await generateBusinessTrendingWallTextIdeas({business:{claimsToAvoid:[],differentiators:[],painPoints:[],targetAudience:[],valueProps:[]},candidates:[0,1].map(candidateIndex=>({candidateIndex,durationSeconds:6,layout:createWallTextLayout(),targetWords:32,maxWords:32})),onChunkAccepted:ideas=>accepted.push(...ideas.map(x=>x.candidateIndex))});
    assert.equal(requests.length,2);
    const candidateJson=JSON.parse(requests[1].split('CANDIDATES: REQUIRED WORD RANGES AND ABSOLUTE SAFETY CEILINGS\n')[1].split('\n\nGLOBAL RULES')[0]);
    assert.equal(candidateJson.length,1);
    assert.equal(candidateJson[0].candidateIndex,1);
    assert.equal(candidateJson[0].maxWords,28);
    assert.equal(candidateJson[0].retryFeedback.rejectedText,rejected);
    assert.deepEqual(accepted,[0,1]);
    assert.equal(result[1].content.fullText,repair);
    assert.equal(result[1].content.finalLayout.fontSizePx,52);
  } finally {
    globalThis.fetch=originalFetch;
    if(originalKey===undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=originalKey;
  }
});
