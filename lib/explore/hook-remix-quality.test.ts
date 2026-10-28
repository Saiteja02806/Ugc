import assert from "node:assert/strict";
import test from "node:test";
import { acceptHookRemixReview, explicitNamedToolSlots, hookRemixReviewPayload, type HookRemixReview } from "./hook-remix-quality.ts";
import type { ReferenceText, RemixOutput } from "./reference-text.ts";

const source: ReferenceText={referenceId:"test",slideId:null,sourceSha256:"a".repeat(64),format:"hook",status:"ready",blocks:[{text:"POV: how to use Claude for marketing",startMs:0,endMs:4000}],extractedAt:"2026-10-24T00:00:00Z",model:"fixture",notes:""};
const context={businessName:"UGCPilot",productSummary:"Creates marketing content",claimsToAvoid:["Guaranteed views"]};
const draft: RemixOutput={blocks:["POV: how to use a marketing app for marketing"],heading:"",body:""};
function review(copy:string):HookRemixReview{return {decision:"revise",output:{blocks:[copy],heading:"",body:""},checks:{meaning:"pass",sourceVoice:"pass",brand:"pass",humanRoles:"not_applicable",grounding:"pass",instructions:"pass"},brandPolicy:"use_business_name",namedToolEdits:[{sourceName:"Claude",replacementName:"UGCPilot"}],reason:"Use the supplied product name."};}

test("a reviewed exact-brand correction passes without changing source or draft",()=>{
  const before=JSON.stringify({source,draft,context});
  const result=acceptHookRemixReview(review("POV: how to use UGCPilot for marketing"),source,context,"",draft);
  assert.equal(result.output.blocks[0],"POV: how to use UGCPilot for marketing");
  assert.equal(JSON.stringify({source,draft,context}),before);
});
test("a model's pass assertion cannot override a missing brand or invented tool evidence",()=>{
  assert.throws(()=>acceptHookRemixReview(review(draft.blocks[0]),source,context,"",draft),/quality checks/);
  const wrong=review("POV: how to use UGCPilot for marketing");wrong.namedToolEdits[0].sourceName="NotInSource";
  assert.throws(()=>acceptHookRemixReview(wrong,source,context,"",draft));
  const absent=review("POV: how to use UGCPilot for marketing");absent.namedToolEdits=[];
  assert.throws(()=>acceptHookRemixReview(absent,source,context,"",draft));
  assert.throws(()=>acceptHookRemixReview(review("POV: how to use Claude or UGCPilot for marketing"),source,context,"",draft));
});
test("an explicit no-brand request wins over exact-brand substitution",()=>{
  const accepted=review("POV: how to use AI for marketing");accepted.brandPolicy="omit_names";accepted.namedToolEdits=[];
  assert.equal(acceptHookRemixReview(accepted,source,context,"No brand names",draft).output.blocks[0],accepted.output.blocks[0]);
  for(const text of ["POV: how to use UGCPilot for marketing","POV: how to use Claude for marketing"]){accepted.output.blocks=[text];assert.throws(()=>acceptHookRemixReview(accepted,source,context,"No brand names",draft));}
});
test("human partner slots reject software even when the reviewer calls it acceptable",()=>{
  const human={...source,blocks:[{text:"pov: you’re dating an IT guy",startMs:0,endMs:4000}]};
  const result=review("pov: you’re dating a marketing guy");result.namedToolEdits=[];result.brandPolicy="not_needed";result.checks.humanRoles="pass";
  assert.equal(acceptHookRemixReview(result,human,context,"",draft).output.blocks[0],result.output.blocks[0]);
  for(const text of ["pov: you’re dating a marketing SaaS","pov: you’re dating UGCPilot","pov: you’re dating a content app"]){result.output.blocks=[text];assert.throws(()=>acceptHookRemixReview(result,human,context,"",draft));}
});
test("failed/missing core reviews and silent edits under keep fail closed",()=>{
  for(const check of ["fail","not_applicable"] as const){const value=review("POV: how to use UGCPilot for marketing");value.checks.meaning=check;assert.throws(()=>acceptHookRemixReview(value,source,context,"",draft));}
  const changed=review("POV: how to use UGCPilot for marketing");changed.decision="keep";
  assert.throws(()=>acceptHookRemixReview(changed,source,context,"",draft));
  changed.decision="reject";assert.throws(()=>acceptHookRemixReview(changed,source,context,"",draft));
});
test("unsupported copied quantities and disguised personal history do not pass by losing just a digit",()=>{
  const plain={...source,blocks:[{text:"3 years of editing and NOW I find this",startMs:0,endMs:4000}]};
  const value=review("3 years of marketing and NOW I find this");value.namedToolEdits=[];value.brandPolicy="not_needed";
  assert.throws(()=>acceptHookRemixReview(value,plain,context,"",draft));
  value.output.blocks=["All this time marketing my SaaS and NOW I find this"];
  assert.throws(()=>acceptHookRemixReview(value,plain,context,"",draft));
});
test("generic HELP and THIS emphasis is not incorrectly classified as a named tool",()=>{
  assert.deepEqual(explicitNamedToolSlots({...source,blocks:[{text:"no way this can HELP your MARKETING",startMs:0,endMs:4000}]}),[]);
  assert.deepEqual(explicitNamedToolSlots(source),["Claude"]);
  assert.deepEqual(explicitNamedToolSlots({...source,blocks:[{text:"POV: your first launch in June with Jamie",startMs:0,endMs:4000}]}),[]);
});

test("a SaaS developer or software engineer stays a human rather than being blocked by an industry word",()=>{
  const human={...source,blocks:[{text:"POV you married the IT guy",startMs:0,endMs:4000}]};
  for(const title of ["SaaS developer","software engineer"]){
    const value=review(`POV you married the ${title}`);value.namedToolEdits=[];value.brandPolicy="not_needed";value.checks.humanRoles="pass";
    assert.equal(acceptHookRemixReview(value,human,context,"",draft).output.blocks[0],value.output.blocks[0]);
  }
});

test("a prohibited quantity in claims-to-avoid is not evidence allowing the same claim",()=>{
  const plain={...source,blocks:[{text:"3 years of editing and NOW I find this",startMs:0,endMs:4000}]};
  const value=review("3 years of marketing and NOW I find this");value.namedToolEdits=[];value.brandPolicy="not_needed";
  assert.throws(()=>acceptHookRemixReview(value,plain,{...context,claimsToAvoid:["3 years"],mainPromise:"3 years of growth"},"",draft));
});
test("review input preserves exact source, business facts and separate preferences without eval answers",()=>{
  const data=JSON.parse(hookRemixReviewPayload(source,context,"Keep Spanish",draft));
  assert.deepEqual(data.source,[source.blocks[0].text]);assert.deepEqual(data.businessFacts,context);assert.deepEqual(data.draft,draft);
  assert.equal(data.userPreferences,"Keep Spanish");assert.equal(data.maxTotalCharacters,80);assert.equal(data.expect,undefined);
});


test("v3 accepts evidenced obsolete named-tool removal only on the rewrite policy",()=>{
  const unrelated={...source,blocks:[{text:"You use Photoshop to make this?",startMs:0,endMs:4000}]};
  const value=review("Could this create daily posts?");value.brandPolicy="not_needed";value.namedToolEdits=[{sourceName:"Photoshop",replacementName:""}];
  assert.equal(acceptHookRemixReview(value,unrelated,context,"",draft,3).output.blocks[0],value.output.blocks[0]);
  assert.throws(()=>acceptHookRemixReview(value,unrelated,context,"",draft,2));
  value.namedToolEdits=[];assert.throws(()=>acceptHookRemixReview(value,unrelated,context,"",draft,3));
  value.namedToolEdits=[{sourceName:"Imaginary",replacementName:""}];assert.throws(()=>acceptHookRemixReview(value,unrelated,context,"",draft,3));
});

test("v3 review payload and acceptance share source-relative length, preserving v2 history policy",()=>{
  const short={...source,blocks:[{text:"Wait, this works?",startMs:0,endMs:4000}]};
  const payload=JSON.parse(hookRemixReviewPayload(short,context,"",draft,3));assert.deepEqual(payload.blockCharacterBudgets,[17]);assert.equal(payload.maxTotalCharacters,17);
  const value=review("Wait, this creates all your marketing posts?");value.brandPolicy="not_needed";value.namedToolEdits=[];
  assert.throws(()=>acceptHookRemixReview(value,short,context,"",draft,3),/expanded/);
});
