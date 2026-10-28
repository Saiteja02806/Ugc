import { hookBrandRemixSystemPrompt, HOOK_BRAND_REMIX_PROMPT_VERSION } from "./hook-remix-brand-prompt.ts";
import assert from "node:assert/strict";
import { mock, test } from "node:test";
let previous=null,count=0,error=null,profileReads=0,referenceReads=0;
let profile={id:"profile",profileVersion:2,context:{businessName:"Example",productSummary:"Video drafting"}};
let source={referenceId:"hook-test",slideId:null,sourceSha256:"a".repeat(64),format:"hook",status:"ready",blocks:[{text:"When your next video is ready",startMs:0,endMs:4000}],extractedAt:"2026-10-25T00:00:00Z",model:"reviewed",notes:""};
const filters=[];
mock.module("@supabase/supabase-js",{namedExports:{createClient:()=>({from(table){const q={select(){return q;},eq(k,v){filters.push([table,k,v]);return q;},gt:async()=>({count,error}),maybeSingle:async()=>({data:previous,error})};return q;}})}});
mock.module(new URL("../business-profiles/db.ts",import.meta.url),{namedExports:{getBusinessProfileForUser:async()=>{profileReads++;return profile;}}});
mock.module(new URL("./reference-text-store.ts",import.meta.url),{namedExports:{getReferenceText:()=>{referenceReads++;return source;}}});
const {prepareAutomaticHookText}=await import("./automatic-hook-text-plan.ts");
const request={enabled:true,format:"hook",referenceId:"hook-test",owner:{uid:"owner",email:null,emailVerified:true},requestKey:"batch",firstJobKey:"batch:1"};
process.env.EXPLORE_AUTOMATIC_HOOK_TEXT_ENABLED="true";process.env.EXPLORE_TEXT_REMIX_ENABLED="true";process.env.OPENAI_API_KEY="fixture-not-a-secret";
test("preflight freezes reviewed source and business; replay never refreshes context or consumes allowance",async()=>{
  const plan=await prepareAutomaticHookText(request);
  assert.equal(plan.promptVersion,9);assert.equal(plan.promptVersion,HOOK_BRAND_REMIX_PROMPT_VERSION);assert.equal(plan.systemPrompt,hookBrandRemixSystemPrompt(source,profile.context));
  assert.equal(plan.businessProfileVersion,2);assert.deepEqual(plan.source,source);assert.match(plan.userPrompt,/Example/);assert.match(plan.requestKey,/^[a-f0-9-]{36}$/);
  assert.equal(plan.layoutVersion,1);
  const frozen={...plan,promptVersion:8,systemPrompt:"historical frozen prompt"};delete frozen.layoutVersion;previous={input_json:{automaticHookText:frozen}};const reads=profileReads,refs=referenceReads;count=20;
  assert.deepEqual(await prepareAutomaticHookText(request),frozen);assert.equal(profileReads,reads);assert.equal(referenceReads,refs);
  await assert.rejects(prepareAutomaticHookText({...request,referenceId:"other"}),/different text/);
  assert.ok(filters.some(f=>f[0]==="background_jobs"&&f[1]==="user_id"&&f[2]==="owner"));
  previous=null;count=0;
});

test("recovery preserves the frozen new layout version without rebuilding its plan", async()=>{
  const frozen=await prepareAutomaticHookText(request);
  previous={input_json:{automaticHookText:frozen}};
  const reads=profileReads,refs=referenceReads;
  assert.deepEqual(await prepareAutomaticHookText(request),frozen);
  assert.equal(profileReads,reads);assert.equal(referenceReads,refs);
  previous=null;
});
test("missing context, unreviewed source, unavailable allowance and exhausted quota fail before work",async()=>{
  const old=profile;profile=null;await assert.rejects(prepareAutomaticHookText(request),/business context/);profile=old;
  source={...source,status:"needs_review"};await assert.rejects(prepareAutomaticHookText(request),/not prepared/);source={...source,status:"ready"};
  count=20;await assert.rejects(prepareAutomaticHookText(request),/20 text remixes/);count=0;
  error={message:"offline"};await assert.rejects(prepareAutomaticHookText(request),/saved generation/);error=null;
  assert.equal(await prepareAutomaticHookText({...request,enabled:false}),null);
  await assert.rejects(prepareAutomaticHookText({...request,format:"wall_text"}),/Automatic text is unavailable/);
});

test("Wall admission is independently gated and freezes its own source-bound layout and copy prompt", async()=>{
  const old=source;
  const release=(await import("../../worker/src/lib/explore-wall-money-reference-release.json",{with:{type:"json"}})).default;
  const catalog=(await import("./reference-text-catalog.json",{with:{type:"json"}})).default;
  source=catalog.items.find(s=>s.referenceId===release.items[5].id);
  process.env.EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED="true";
  const req={...request,format:"wall_text",referenceId:source.referenceId};
  try {
    const plan=await prepareAutomaticHookText(req);
    assert.equal(plan.layoutVersion,undefined);assert.equal(plan.wallLayout.sourceLines,10);
    assert.equal(plan.wallLayout.sourceSha256,source.sourceSha256);assert.equal(plan.promptVersion,2);
    assert.match(plan.userPrompt,/not a short Hook/);
    previous={input_json:{automaticHookText:plan}};
    delete process.env.EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED;
    assert.deepEqual(await prepareAutomaticHookText(req),plan,"accepted jobs recover while new admission is disabled");
    previous=null;
    process.env.EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED="true";
    source={...source,sourceSha256:"f".repeat(64)};
    await assert.rejects(prepareAutomaticHookText(req),/layout is not prepared/);
  } finally {source=old;previous=null;delete process.env.EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED;}
});

test("Wall 04 freezes source and business context with explicit separate heading and complete body",async()=>{
 const previousSource=source,catalog=(await import('./reference-text-catalog.json',{with:{type:'json'}})).default;
 source=catalog.items.find(item=>item.referenceId==='explore-wall-text-04');process.env.EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED='true';
 try {const p=await prepareAutomaticHookText({...request,format:'wall_text',referenceId:source.referenceId});
  assert.equal(p.wallLayout.structure,'heading-body-v1');assert.equal(p.wallHeadingFitVersion,1);assert.equal(p.promptVersion,3);assert.match(p.systemPrompt,/adapted heading in heading/);assert.match(p.systemPrompt,/empty blocks array/);assert.match(p.systemPrompt,/Never promise improvement/);assert.match(p.systemPrompt,/named laws or authorities/);
  assert.match(p.userPrompt,/5 most famous laws/);assert.match(p.userPrompt,/Example/);
  previous={input_json:{automaticHookText:p}};source={...source,sourceSha256:'f'.repeat(64)};
  assert.deepEqual(await prepareAutomaticHookText({...request,format:'wall_text',referenceId:p.source.referenceId}),p);
 }finally{source=previousSource;previous=null;delete process.env.EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED;}
});
