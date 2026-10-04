import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildWallTextGenerationPrompt, WALL_TEXT_PROMPT_VERSION } from "./wall-prompt.ts";

test("the reviewed writer and planner keep the four copy fixes and factual restrictions", () => {
  const writer = readFileSync(new URL("./wall-prompt.ts", import.meta.url), "utf8");
  const planner = readFileSync(new URL("../../worker/src/lib/wall-text-content-plan.ts", import.meta.url), "utf8");
  const appPlan = readFileSync(new URL("./wall-text-content-plan.ts", import.meta.url), "utf8");
  assert.equal(WALL_TEXT_PROMPT_VERSION, "wall-text-writer-prompt-v30-four-copy-fixes");
  for (const source of [planner, appPlan]) assert.match(source, /wall-text-content-plan-reader-profiles-v19-four-copy-fixes/);
  for (const source of [writer, planner]) {
    assert.match(source, /deletion test to EVERY sentence/);
    assert.match(source, /BOTH possible editing AND required approval/);
    assert.match(source, /simultaneous|simultaneously/);
    assert.match(source, /cadence/);
    assert.match(source, /examples demonstrate wording only/);
    assert.match(source, /not evidence/);
  }
});

test("copy examples cannot replace owner facts, word ranges or qualification context", () => {
  const assignedFact = { id: "capability-1", type: "capability" as const, text: "OwnerProduct supports more than one account." };
  const condition = { id: "condition-1", type: "capability" as const, text: "Publication requires human approval." };
  const prompt = buildWallTextGenerationPrompt({
    business: { businessName: "OwnerProduct", brandTone: null, category: null, claimsToAvoid: [], differentiators: [], mainProblem: null, mainPromise: null, painPoints: [], productSummary: "Unrelated present-day claim", targetAudience: [], valueProps: [] },
    candidates: [{ candidateIndex: 7, minWords: 26, maxWords: 44, grounding: {
      assignedFact, contextVersion: "wall-text-grounding-v2", factSnapshot: { version: "business-facts-v1", claimsToAvoid: [], facts: [assignedFact, condition] },
    } }],
  });
  const candidate = JSON.parse(prompt.split("CANDIDATES: REQUIRED WORD RANGES AND ABSOLUTE SAFETY CEILINGS\n")[1]!.split("\n\nGLOBAL RULES")[0]!)[0];
  assert.equal(candidate.candidateIndex, 7);
  assert.deepEqual(candidate.assignedBusinessFact, assignedFact);
  assert.deepEqual(candidate.qualificationContext, [assignedFact, condition]);
  assert.deepEqual(candidate.requiredWordRange, { minimum: 26, maximum: 44 });
  assert.equal(candidate.targetWords, undefined);
  assert.doesNotMatch(prompt, /Unrelated present-day claim/);
  assert.match(prompt, /WRITING EXAMPLES: STYLE ONLY, NOT BUSINESS EVIDENCE/);
});
