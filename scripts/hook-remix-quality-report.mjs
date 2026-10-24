/* Offline re-scoring/report only. This script cannot call a provider. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assessHookRemixFixture } from "../lib/explore/hook-remix-eval.ts";
import { acceptHookRemixReview,hookRemixReviewPayload } from "../lib/explore/hook-remix-quality.ts";
import { HOOK_REMIX_CALIBRATED_REVIEW_PROMPT } from "../lib/explore/hook-remix-quality-policy.ts";

const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
const original=read("docs/hook-remix-quality-pilot-results-2026-10-24.json");
const calibrated=read("docs/hook-remix-quality-calibrated-results-2026-10-24.json");
const fixture=read("lib/explore/fixtures/hook-remix-quality-v1.json");
assert.equal(calibrated.reviewSystem,HOOK_REMIX_CALIBRATED_REVIEW_PROMPT);
assert.equal(original.results.length,24);assert.equal(calibrated.results.length,23);
assert.equal(new Set(calibrated.results.map(row=>row.calibrated.requestId)).size,23);
assert.equal(new Set(calibrated.results.map(row=>row.calibrated.providerResponseId)).size,23);
const rows=original.results.map(row=>{
  const expectation=fixture.cases.find(item=>item.id===row.id).expect;
  const later=calibrated.results.find(item=>item.id===row.id);
  const baseline=assessHookRemixFixture(row.draft.output,row.source,expectation);
  const first=assessHookRemixFixture(row.review.acceptance?.accepted?row.review.acceptance.output:null,row.source,expectation);
  let accepted=null,blockReason=null;
  if(later){
    assert.equal(later.draft.providerResponseId,row.draft.providerResponseId);
    assert.deepEqual(later.draft.output,row.draft.output);
    assert.equal(later.reviewerUser,hookRemixReviewPayload(row.source,row.context,row.instructions,row.draft.output));
    assert.equal(later.calibrated.state,"completed");
    try{accepted=acceptHookRemixReview(later.calibrated.output,row.source,row.context,row.instructions,row.draft.output).output;}
    catch(error){blockReason=error.code??error.message;}
    assert.equal(Boolean(accepted),later.calibrated.acceptance.accepted,"Current guard replay differs from captured acceptance");
  }
  return {id:row.id,category:row.category,context:row.context.businessName,source:row.blocks,draft:row.draft.output??null,firstReview:row.review.output?.output??null,
    finalReview:later?.calibrated.output?.output??null,delivered:accepted,blockReason,draftState:row.draft.state,
    baseline,firstReviewed:first,calibrated:assessHookRemixFixture(accepted,row.source,expectation),
    draftLatencyMs:row.draft.latencyMs??null,reviewLatencyMs:later?.calibrated.latencyMs??null,
    decision:later?.calibrated.output?.decision??null};
});
const comparable=rows.filter(row=>row.draftState==="completed");
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const summary={totalCases:24,contexts:6,resolvedDrafts:23,unresolvedDrafts:1,baselinePass:comparable.filter(row=>row.baseline.pass).length,
  firstReviewPassCorrected:comparable.filter(row=>row.firstReviewed.pass).length,calibratedPass:comparable.filter(row=>row.calibrated.pass).length,
  calibratedBlocked:comparable.filter(row=>!row.delivered).length,deliveredRuleFailures:comparable.filter(row=>row.delivered&&!row.calibrated.pass).length,
  baselinePassingRegressions:comparable.filter(row=>row.baseline.pass&&!row.calibrated.pass).map(row=>row.id),
  baselineFailuresRepaired:comparable.filter(row=>!row.baseline.pass&&row.calibrated.pass).map(row=>row.id),
  calibratedDecisions:Object.fromEntries(["keep","revise","reject"].map(decision=>[decision,comparable.filter(row=>row.decision===decision).length])),
  latencyMs:{draftMedian:percentile(comparable.map(row=>row.draftLatencyMs),.5),draftP95:percentile(comparable.map(row=>row.draftLatencyMs),.95),
    reviewMedian:percentile(comparable.map(row=>row.reviewLatencyMs),.5),reviewP95:percentile(comparable.map(row=>row.reviewLatencyMs),.95),
    combinedMedian:percentile(comparable.map(row=>row.draftLatencyMs+row.reviewLatencyMs),.5),combinedP95:percentile(comparable.map(row=>row.draftLatencyMs+row.reviewLatencyMs),.95)},
  completedCalls:original.summary.completedCalls+calibrated.summary.additionalCompletedCalls,unresolvedProviderCalls:1,notSubmitted:1,
  reportedTokens:original.summary.tokens+calibrated.summary.totalTokens};
const hash=file=>createHash("sha256").update(fs.readFileSync(file)).digest("hex");
fs.writeFileSync("docs/hook-remix-quality-summary-2026-10-24.json",JSON.stringify({generatedAt:new Date().toISOString(),scorerFixtureVersion:fixture.version,
  scorerCorrection:"a week was changed to a word-bounded phrase so it does not match a weekly meal plan. Raw original results/scores were not overwritten.",
  guardVersionHashes:{guards:hash("lib/explore/hook-remix-quality.ts"),reviewPrompt:hash("lib/explore/hook-remix-quality-policy.ts"),scorer:hash("lib/explore/hook-remix-eval.ts")},summary,rows},null,2)+"\n");
console.log(JSON.stringify(summary));
const cell=value=>String(value??"").replaceAll("|","\\|").replaceAll("\n","<br>");
const table=rows.map((row,index)=>{
  const source=cell(row.source.join("\n\n")),draft=cell(row.draft?.blocks.join("\n\n")??"No usable result"),final=cell(row.delivered?.blocks.join("\n\n")??(row.draftState!=="completed"?"Unresolved draft — not retried":"Withheld: "+row.blockReason));
  const status=row.draftState!=="completed"?"Unresolved":row.delivered?"Passes fixed checks":"Blocked";
  return `| ${index+1}. ${row.id} | ${cell(row.context)} | ${source} | ${draft} | ${final} | ${status} |`;
}).join("\n");
fs.writeFileSync("docs/hook-remix-quality-all-cases-2026-10-24.md",`# Hook Remix quality pilot: all 24 cases\n\nActual saved provider text; no output edited for this table. Five business profiles are synthetic fixtures; UGCPilot uses its saved account context. One draft is unresolved and was not retried. The final column uses the calibrated review plus code checks, with failures withheld rather than replaced by the draft. Passing fixed checks is not an audience-performance or general semantic-quality claim.\n\nThis reviewer was calibrated on the first round's observed failures. These are in-sample results, not a held-out benchmark. Original outputs remain in the JSON evidence. See [method, costs, limits and release state](hook-remix-quality-system-2026-10-24.md).\n\n| Case | Business | Source | Single-pass draft | Final result | Status |\n| --- | --- | --- | --- | --- | --- |\n${table}\n`);
