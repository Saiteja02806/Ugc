import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticHookEdit, runAutomaticHookText, validateAutomaticHookText, type AutomaticHookTextPlan, type AutomaticHookTextDependencies } from "./automatic-hook-text.ts";
import { formatTextLayout, createFormatTextSvg, parseExploreFormatEdit } from "./explore-format-edit.ts";
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
