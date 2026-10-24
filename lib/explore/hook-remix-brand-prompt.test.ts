import assert from "node:assert/strict";
import test from "node:test";
import { hookBrandRemixSystemPrompt, HOOK_BRAND_REMIX_PROMPT_VERSION } from "./hook-remix-brand-prompt.ts";
import { hookRoleRemixSystemPrompt } from "./hook-remix-role-prompt.ts";
import { remixTextPrompt } from "./remix-text-prompt.ts";
import { validateRemixOutput, type ReferenceText } from "./reference-text.ts";

const source: ReferenceText = { referenceId:"explore-paired-hook-fc44f6214b6e17413600ec13",slideId:null,format:"hook",status:"ready",
  sourceSha256:"405670a27856c31e698a0ef13b178ece82c18cc379c0cec7489b0c1c1414fa1e",extractedAt:"2026-10-23T10:40:36.977Z",model:"manual-visual-review",notes:"",
  blocks:[{text:"POV: you finally understand\nhow to use Claude\nfor marketing",startMs:0,endMs:3800}] };
test("Claude example sends the exact business name with an explicit named-tool rule and accepts the intended minimal edit",()=>{
  const context={businessName:"UGCPilot",productSummary:"Marketing content for SaaS founders"};
  const prompt=hookBrandRemixSystemPrompt(source);
  assert.equal(HOOK_BRAND_REMIX_PROMPT_VERSION,8);
  assert.match(prompt,/replace that name with businessContext.businessName, using its exact spelling/);
  assert.match(prompt,/Do not replace a specific named tool with a vague category/);
  assert.deepEqual(JSON.parse(remixTextPrompt(source,context,"")),{format:"hook",referenceText:[source.blocks[0].text],businessContext:context,additionalInstructions:""});
  const desired={blocks:["POV: you finally understand\nhow to use UGCPilot\nfor marketing"],heading:"",body:""};
  assert.deepEqual(validateRemixOutput(desired,source),desired);
  assert.equal(source.blocks[0].text.includes("Claude"),true,"Source copy remains unchanged");
});
test("new rule preserves human roles, generic hooks, unsupported-claim protection and explicit no-brand instructions",()=>{
  const prompt=hookBrandRemixSystemPrompt(source);
  for(const fragment of ["a person stays a person", "Do not transfer unsupported personal history", "changing as few words as possible", "Honor an explicit user request to omit brand names", "does not add branding to otherwise suitable generic hooks"])
    assert.ok(prompt.includes(fragment),fragment);
  assert.ok(!hookRoleRemixSystemPrompt(source).includes("Named tools:"),"Historical v7 prompt remains reproducible");
  const two={...source,blocks:[...source.blocks,...source.blocks]};
  assert.match(hookBrandRemixSystemPrompt(two),/Return exactly 2 nonempty block/);
  assert.throws(()=>hookBrandRemixSystemPrompt({...source,format:"wall_text"}));
});
