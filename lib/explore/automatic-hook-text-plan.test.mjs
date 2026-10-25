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
  assert.equal(plan.businessProfileVersion,2);assert.deepEqual(plan.source,source);assert.match(plan.userPrompt,/Example/);assert.match(plan.requestKey,/^[a-f0-9-]{36}$/);
  previous={input_json:{automaticHookText:plan}};const reads=profileReads,refs=referenceReads;count=20;
  assert.deepEqual(await prepareAutomaticHookText(request),plan);assert.equal(profileReads,reads);assert.equal(referenceReads,refs);
  await assert.rejects(prepareAutomaticHookText({...request,referenceId:"other"}),/different text/);
  assert.ok(filters.some(f=>f[0]==="background_jobs"&&f[1]==="user_id"&&f[2]==="owner"));
  previous=null;count=0;
});
test("missing context, unreviewed source, unavailable allowance and exhausted quota fail before work",async()=>{
  const old=profile;profile=null;await assert.rejects(prepareAutomaticHookText(request),/business context/);profile=old;
  source={...source,status:"needs_review"};await assert.rejects(prepareAutomaticHookText(request),/not prepared/);source={...source,status:"ready"};
  count=20;await assert.rejects(prepareAutomaticHookText(request),/20 text remixes/);count=0;
  error={message:"offline"};await assert.rejects(prepareAutomaticHookText(request),/saved generation/);error=null;
  assert.equal(await prepareAutomaticHookText({...request,enabled:false}),null);
  await assert.rejects(prepareAutomaticHookText({...request,format:"wall_text"}),/Hook reference/);
});
