import nextEnv from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Synthetic inputs only: no customer records are read or sent to a provider.
// --live spends model tokens, but does not enqueue, render or upload anything.
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const { CAROUSEL_COUNTED_BODY_REPAIR_VERSION } = await import("../worker/dist/lib/carousel-counted-body-repair.js");
const analysis = {
  businessName: "CampaignFlow", category: "marketing software", categories: ["campaign planning"],
  brandTone: "clear and practical", confidence: "high", claimsToAvoid: ["guaranteed revenue growth"],
  carouselAngles: ["A calmer campaign handoff"], ctaIdeas: ["Organize your next campaign"],
  differentiators: ["Planning and reporting stay in one workspace"],
  mainProblem: "Campaign planning and reporting are scattered across tools",
  mainPromise: "Keep campaign work in one organized workflow", painPoints: ["Missed follow-ups"],
  productSummary: "A workspace for planning and reporting marketing campaigns.",
  targetAudience: ["small marketing teams"], valueProps: ["Connect planning, follow-up, and reporting"],
  visualKeywords: ["paper calendar", "organized desk"],
};
const assignments = [
  { contentFormatId: "how_to", hookFamilyId: "curiosity", creativeSeed: "A handoff works better when the next reviewer can see the original decision." },
  { contentFormatId: "mistakes", hookFamilyId: "problem_recognition", creativeSeed: "A launch note gets buried when approval happens in a separate conversation." },
  { contentFormatId: "before_after", hookFamilyId: "specific_outcome", creativeSeed: "A missing owner turns a small campaign revision into another meeting." },
  { contentFormatId: "comparison", hookFamilyId: "question", creativeSeed: "A shared working draft and a copied attachment lead to different review habits." },
  { contentFormatId: "list", hookFamilyId: "surprise", creativeSeed: "The next campaign task needs a decision and context rather than another status label." },
];
const input = {
  analysis,
  businessDescription: analysis.productSummary,
  bodyRepairPolicy: { version: CAROUSEL_COUNTED_BODY_REPAIR_VERSION },
  recentHistory: [],
  items: assignments.map((assignment, slotIndex) => ({ ...assignment, slotIndex, candidateIndex: slotIndex,
    hookTemplateId: null, hookTemplateVersion: null, emotion: "relief", planningBrief: null })),
};
const outputDir = resolve(".tmp/carousel-planner-audit", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "input.json"), JSON.stringify(input, null, 2));
if (!process.argv.includes("--live")) {
  console.log(JSON.stringify({ live: false, inputSaved: true, outputDir }));
  process.exit(0);
}
const trace = [];
const replayPath = process.argv.find(arg => arg.startsWith("--replay-initial="))?.slice(17);
const replayInitial = replayPath ? JSON.parse(await readFile(resolve(replayPath), "utf8"))[0].response : null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (!String(url).includes("api.openai.com")) return originalFetch(url, init);
  if (trace.length >= 12) throw new Error("Audit model request budget exhausted.");
  const request = JSON.parse(init.body);
  const entry = { request, startedAt: new Date().toISOString() };
  trace.push(entry);
  const replayed = replayInitial && request.response_format?.json_schema?.name === "carousel_content_batch";
  const response = replayed ? new Response(JSON.stringify(replayInitial), { status: 200, headers: { "Content-Type": "application/json" } }) : await originalFetch(url, init);
  entry.replayed = !!replayed;
  entry.status = response.status;
  entry.response = await response.clone().json();
  entry.finishedAt = new Date().toISOString();
  await writeFile(resolve(outputDir, "trace.json"), JSON.stringify(trace, null, 2));
  return response;
};
const { buildCarouselContentPlanBatch } = await import("../worker/dist/lib/carousel-llm-slide-plan.js");
let outcome;
try {
  const completed = await buildCarouselContentPlanBatch(input);
  outcome = { completed: completed.length, completedSlots: completed.map(p => p.slotIndex), failed: 0 };
} catch (error) {
  outcome = { completed: error.completedItems?.length || 0, completedSlots: error.completedItems?.map(p => p.slotIndex) || [],
    failed: 5 - (error.completedItems?.length || 0), error: error.message,
    failures: error.failures };
}
globalThis.fetch = originalFetch;
const calls = trace.map(entry => {
  const content = entry.request.messages.at(-1).content;
  let issues;
  try { issues = JSON.parse(content).issues; } catch {
    try { issues = JSON.parse(content.match(/Validation or applicability issue:\n([\s\S]*?)\nOriginal batch item:/)?.[1]); } catch { /* Initial batch. */ }
  }
  return { schema: entry.request.response_format?.json_schema?.name, status: entry.status,
    replayed: entry.replayed,
    elapsedMs: Date.parse(entry.finishedAt) - Date.parse(entry.startedAt),
    usage: entry.response?.usage, finishReason: entry.response?.choices?.[0]?.finish_reason, issues };
});
const result = { readOnlyDatabase: true, live: true, outputDir, ...outcome, calls };
await writeFile(resolve(outputDir, "summary.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
