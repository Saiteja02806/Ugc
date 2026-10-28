import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticHookEdit, runAutomaticHookText, validateAutomaticHookText, type AutomaticHookTextPlan, type AutomaticHookTextDependencies } from "./automatic-hook-text.ts";
import { formatTextLayout, createFormatTextSvg, parseExploreFormatEdit } from "./explore-format-edit.ts";
import { wallTextProfile } from "./wall-initial-text-layout.ts";
const plan: AutomaticHookTextPlan={version:1,requestKey:"11111111-1111-4111-8111-111111111111",model:"test-model",systemPrompt:"frozen",userPrompt:"frozen",promptVersion:8,
  source:{referenceId:"hook-test",sourceSha256:"a".repeat(64),format:"hook",status:"ready",blocks:[{text:"When you finally finish your videos",startMs:0,endMs:4000}]},businessProfileId:"profile",businessProfileVersion:1,businessContext:{}};
const output={blocks:["When your next video is already drafted"],heading:"",body:""};
function receipts(generate:()=>Promise<unknown>=async()=>output) {
  let row: {status:string;output?:unknown}|null=null, calls=0;
  const deps:AutomaticHookTextDependencies={claim:async()=>{if(row)return{claimed:false,...row};row={status:"pending"};return{claimed:true,status:"pending"};},
    read:async()=>row,generate:async()=>{calls++;return generate();},complete:async value=>{row={status:"completed",output:value};},fail:async()=>{row={status:"failed"};},wait:async()=>{await new Promise(resolve=>setTimeout(resolve,0));}};
  return {deps,calls:()=>calls,row:()=>row};
}
test("four concurrent batch outputs and a restarted worker reuse one durable text result",async()=>{
  const r=receipts();const results=await Promise.all(Array.from({length:4},()=>runAutomaticHookText(plan,r.deps)));
  for(const result of results)assert.deepEqual(result,output);
  assert.deepEqual(await runAutomaticHookText(plan,r.deps),output);assert.equal(r.calls(),1);
});
test("provider timeout or invalid response becomes terminal without automatic resubmission",async()=>{
  for(const generate of [async()=>{throw Error("timeout");},async()=>({...output,blocks:[]})]){
    const r=receipts(generate);assert.equal(await runAutomaticHookText(plan,r.deps),null);
    assert.equal(await runAutomaticHookText(plan,r.deps),null);assert.equal(r.calls(),1);assert.equal(r.row()?.status,"failed");
  }
});
test("an uncertain saved response never repeats the model call",async()=>{
  const r=receipts();const complete=r.deps.complete;r.deps.complete=async value=>{await complete(value);throw Error("lost response");};
  await assert.rejects(runAutomaticHookText(plan,r.deps),/lost response/);
  assert.deepEqual(await runAutomaticHookText(plan,r.deps),output);assert.equal(r.calls(),1);
});
test("an abandoned pending claim is read without generating again",async()=>{
  const r=receipts();await r.deps.claim();assert.equal(await runAutomaticHookText(plan,r.deps),null);assert.equal(r.calls(),0);
});
test("claim failure makes no provider call",async()=>{
  const r=receipts();r.deps.claim=async()=>{throw Error("daily limit");};
  await assert.rejects(runAutomaticHookText(plan,r.deps),/daily limit/);assert.equal(r.calls(),0);
});

test("structured Wall copy is preserved in two independently editable full-duration layers and recovered without another call",async()=>{
  const profile=wallTextProfile("explore-wall-text-04")!;
  const p:AutomaticHookTextPlan={...plan,promptVersion:2,wallLayout:profile,source:{referenceId:profile.referenceId,sourceSha256:profile.sourceSha256,format:"wall_text",status:"ready",blocks:[{text:"Original source ".repeat(30),startMs:0,endMs:7000}]}};
  const result={blocks:[],heading:"Five video ideas",body:"Choose a clear topic.\n\nFind a useful reference.\n\nWrite your message.\n\nReview the final video."};
  const r=receipts(async()=>result);assert.deepEqual(await runAutomaticHookText(p,r.deps),result);assert.deepEqual(await runAutomaticHookText(p,r.deps),result);assert.equal(r.calls(),1);
  const edit=automaticHookEdit(result,p,12,"9:16");assert.equal(edit.trimEndMs,12000);
  assert.deepEqual(edit.textOverlays!.map(t=>t.value),[result.heading,result.body]);assert.ok(edit.textOverlays!.every(t=>t.startMs===0&&t.endMs===12000));
  assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))),edit);
  for(const bad of [{...result,heading:""},{...result,heading:"Line one\nLine two"},{...result,body:"word\n".repeat(300)},{...result,blocks:["extra"]}])assert.throws(()=>automaticHookEdit(bad,p,12,"9:16"));
});

test("new Wall heading layout fits the real longer heading without altering historic plans or user words",()=>{
 const profile=wallTextProfile("explore-wall-text-04")!;
 const p:AutomaticHookTextPlan={...plan,promptVersion:3,wallLayout:profile,wallHeadingFitVersion:1,source:{referenceId:profile.referenceId,sourceSha256:profile.sourceSha256,format:"wall_text",status:"ready",blocks:[{text:"Original source ".repeat(30),startMs:0,endMs:7000}]}};
 const result={blocks:[],heading:"5 marketing laws worth knowing",body:"Choose a topic.\n\nReview your video."};
 const edit=automaticHookEdit(result,p,12,"9:16");assert.equal(edit.textOverlays![0].fontSize,61);assert.equal(edit.textOverlays![0].value,result.heading);assert.equal(edit.textOverlays![1].value,result.body);assert.equal(edit.trimEndMs,12000);
 const old={...p};delete old.wallHeadingFitVersion;assert.throws(()=>automaticHookEdit(result,old,12,"9:16"),/heading.*fit/);
 assert.throws(()=>automaticHookEdit({...result,heading:"A ".repeat(70)},p,12,"9:16"),/heading.*fit/);
 assert.equal(automaticHookEdit({...result,heading:"5 most famous laws"},p,12,"9:16").textOverlays![0].fontSize,65);
});
test("single Hook fills the actual output duration and roundtrips as editable, fitted text",()=>{
  for(const ratio of ["9:16","16:9"])for(const duration of [4,6.25,30]){
    const edit=automaticHookEdit(output,plan,duration,ratio),text=edit.textOverlays![0];
    assert.equal(text.startMs,0);assert.equal(text.endMs,duration*1000);assert.equal(text.value,output.blocks[0]);
    const height=ratio==="16:9"?608:1920;
    assert.equal(formatTextLayout(text,1080,height).fits,true);
    assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(edit))),edit);
    assert.ok(createFormatTextSvg(text,1080,height).includes("<svg"));
  }
});
test("multi-beat timing scales to generated duration; longer copy shrinks without truncation",()=>{
  const p={...plan,source:{...plan.source,blocks:[{text:"original ".repeat(45),startMs:0,endMs:2000},{text:"Next beat",startMs:2000,endMs:4000}]}};
  const o={...output,blocks:["A readable sentence about the next video. ".repeat(6),"Next video"]};
  const edit=automaticHookEdit(o,p,6,"16:9");assert.equal(edit.textOverlays![0].endMs,3000);assert.equal(edit.textOverlays![1].startMs,3000);
  assert.equal(edit.textOverlays![1].endMs,6000);assert.equal(edit.textOverlays![0].value,o.blocks[0].trim());assert.ok(edit.textOverlays![0].fontSize<48);
});
test("oversize, unsupported symbols, malformed and extra text cannot enter the editor",()=>{
  for(const value of [null,{...output,body:"extra"},{...output,blocks:["x".repeat(601)]},{...output,blocks:["bad\u0000"]},{...output,extra:true}])assert.throws(()=>validateAutomaticHookText(value,plan));
  const p={...plan,source:{...plan.source,blocks:[{text:"x".repeat(6000),startMs:0,endMs:4000}]}};
  assert.throws(()=>automaticHookEdit({...output,blocks:["word\n".repeat(100)]},p,4,"16:9"),/fit/);
});


test("v9 source-relative limits apply only to new plans; old automatic receipts remain valid",async()=>{
  const short={...plan,promptVersion:9,source:{...plan.source,blocks:[{text:"Wait, this works?",startMs:0,endMs:4000}]}};
  assert.throws(()=>validateAutomaticHookText(output,short),/expanded/);
  assert.deepEqual(validateAutomaticHookText(output,{...short,promptVersion:8}),output);
  const r=receipts();assert.equal(await runAutomaticHookText(short,r.deps),null);
  assert.equal(await runAutomaticHookText(short,r.deps),null);assert.equal(r.calls(),1);
  assert.deepEqual(validateAutomaticHookText({blocks:["Wait, this works?"],heading:"",body:""},short).blocks,["Wait, this works?"]);
});

test("only frozen layout-version1 plans use the new fitter; historical results retain exact layout",()=>{
  const value="You're telling me this is\nwhat the cool girls use for\ntheir Pinterest??";
  const p={...plan,source:{...plan.source,blocks:[{text:value,startMs:0,endMs:3000}]}};
  const o={blocks:[value],heading:"",body:""};
  const historical=automaticHookEdit(o,p,3,"9:16");
  assert.deepEqual(historical.textOverlays![0],{value,width:.84,y:.18,fontSize:48,font:"proximanovaa",fontWeight:600,color:"#ffffff",outlineWidth:8,startMs:0,endMs:3000});
  const fresh=automaticHookEdit(o,{...p,layoutVersion:1},3,"9:16");
  assert.equal(fresh.textOverlays![0].width,.94);assert.equal(fresh.textOverlays![0].fontSize,84);
  assert.deepEqual(automaticHookEdit(o,JSON.parse(JSON.stringify(p)),3,"9:16"),historical);
  assert.deepEqual(automaticHookEdit(o,JSON.parse(JSON.stringify({...p,layoutVersion:1})),3,"9:16"),fresh);
  assert.throws(()=>automaticHookEdit(o,{...p,layoutVersion:2} as unknown as AutomaticHookTextPlan,3,"9:16"),/layout version/);
});

test("new-layout automatic blocks remain editable and keep full-duration or scaled timing",()=>{
  for(const ratio of ["9:16","16:9"]) {
    const p={...plan,layoutVersion:1 as const,source:{...plan.source,blocks:[{text:"First reaction",startMs:0,endMs:1000},{text:"Next reaction",startMs:1000,endMs:3000}]}};
    const result=automaticHookEdit({blocks:["First reaction","Next reaction"],heading:"",body:""},p,6,ratio);
    assert.deepEqual(result.textOverlays!.map(t=>[t.startMs,t.endMs]),[[0,2000],[2000,6000]]);
    assert.deepEqual(parseExploreFormatEdit(JSON.parse(JSON.stringify(result))),result);
    assert.ok(result.textOverlays!.every(t=>formatTextLayout(t,1080,ratio==="16:9"?608:1920).fits));
  }
});
