import assert from 'node:assert/strict';
import test from 'node:test';
import { generateBusinessTrendingWallTextIdeas } from '../lib/trending/generate-trending-wall-text-ideas.ts';
import { createWallTextLayout } from '../lib/trending/wall-text-feed-logic.ts';
import { getWallTextRepairBudget } from '../lib/trending/wall-text-repair-budget.ts';

test('successive fit repairs tighten the budget without dropping below the general copy minimum',()=>{
  const first=getWallTextRepairBudget({maxWords:32,minWords:12,targetWords:32});
  const second=getWallTextRepairBudget(first);
  assert.deepEqual(first,{maxWords:28,targetWords:28});
  assert.deepEqual(second,{maxWords:24,targetWords:24});
  assert.deepEqual(getWallTextRepairBudget(getWallTextRepairBudget(second)),{maxWords:16,targetWords:16});
  assert.deepEqual(getWallTextRepairBudget({maxWords:12,minWords:12,targetWords:12}),{maxWords:12,targetWords:12});
});

test('a rejected candidate gets a targeted rewrite and already accepted items are not regenerated', async () => {
  const originalFetch=globalThis.fetch;
  const originalKey=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='test-key';
  const requests=[];
  const accepted=[];
  const good='My notes looked clear until the day got busy. One list helped.';
  const repair='A full week hides small tasks. One clear plan brings them back.';
  const rejected=Array(24).fill('mischaracterization').join(' ')+'.';
  globalThis.fetch=async(_url,init)=>{
    const body=JSON.parse(init.body);
    const schemaName=body.response_format?.json_schema?.name;
    if(schemaName==='trending_wall_text_review_v9') {
      const reviewCandidates=JSON.parse(body.messages[1].content).candidates;
      const reviews=reviewCandidates.map(candidate=>({approved:true,candidateIndex:candidate.candidateIndex,feedback:'Clear and natural.',naturalSpokenLanguage:true,oneCentralThought:true}));
      return new Response(JSON.stringify({id:'test',object:'chat.completion',created:0,model:'gpt-5.6-luna',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({reviews}),refusal:null}}]}),{headers:{'content-type':'application/json'}});
    }
    requests.push(body.messages[1].content);
    const ideas=requests.length===1 ? [{candidateIndex:0,text:good},{candidateIndex:1,text:rejected}] : [{candidateIndex:1,text:repair}];
    return new Response(JSON.stringify({id:'test',object:'chat.completion',created:0,model:'gpt-5.6-luna',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({ideas}),refusal:null}}]}),{headers:{'content-type':'application/json'}});
  };
  try {
    const result=await generateBusinessTrendingWallTextIdeas({business:{claimsToAvoid:[],differentiators:[],painPoints:[],targetAudience:[],valueProps:[]},candidates:[0,1].map(candidateIndex=>({candidateIndex,durationSeconds:6,layout:createWallTextLayout(),targetWords:32,maxWords:32})),onChunkAccepted:ideas=>accepted.push(...ideas.map(x=>x.candidateIndex))});
    assert.equal(requests.length,2);
    const candidateJson=JSON.parse(requests[1].split('CANDIDATES: REQUIRED WORD RANGES AND ABSOLUTE SAFETY CEILINGS\n')[1].split('\n\nGLOBAL RULES')[0]);
    assert.equal(candidateJson.length,1);
    assert.equal(candidateJson[0].candidateIndex,1);
    assert.equal(candidateJson[0].maxWords,15);
    assert.equal(candidateJson[0].retryFeedback.reason,'layout_fit');
    assert.deepEqual(accepted,[0,1]);
    assert.equal(result[1].content.fullText,repair);
    assert.equal(result[1].content.finalLayout.fontSizePx,52);
  } finally {
    globalThis.fetch=originalFetch;
    if(originalKey===undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=originalKey;
  }
});
