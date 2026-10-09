import assert from "node:assert/strict";
import test from "node:test";
import { buildWallTextGenerationPrompt } from "./wall-prompt.ts";
import { BUSINESS_FACT_WRITING_PROMPT } from "../business-profiles/fact-writing-prompt.ts";

test("writer receives immutable qualifications even when the selected fact omits them", () => {
  const assignedFact = { id: "capability-1", type: "capability" as const, text: "Customers can collect bread the next day." };
  const condition = { id: "capability-2", type: "capability" as const, text: "Orders must be placed by 4 pm for pickup Tuesday through Saturday from 8 am to noon." };
  const prompt = buildWallTextGenerationPrompt({
    business: { businessName: "Bakery", brandTone: null, category: null, claimsToAvoid: [], differentiators: [], mainProblem: null, mainPromise: null, painPoints: [], productSummary: "Unrelated current description", targetAudience: [], valueProps: [] },
    candidates: [{ candidateIndex: 0, maxWords: 48, grounding: { assignedFact, contextVersion: "wall-text-grounding-v2", factSnapshot: { version: "business-facts-v1", claimsToAvoid: [], facts: [assignedFact, condition] } } }],
  });
  const candidates = JSON.parse(prompt.split("CANDIDATES: REQUIRED WORD RANGES AND ABSOLUTE SAFETY CEILINGS\n")[1]!.split("\n\nGLOBAL RULES")[0]!);
  assert.deepEqual(candidates[0].assignedBusinessFact, assignedFact);
  assert.deepEqual(candidates[0].qualificationContext, [assignedFact, condition]);
  assert.deepEqual(candidates[0].requiredWordRange, { maximum: 48, minimum: 24 });
  assert.doesNotMatch(prompt, /Unrelated current description/);
  assert.match(prompt, /Do not use qualificationContext to introduce another capability/);
});

test("shared extraction instruction preserves conditions in each standalone claim", () => {
  assert.match(BUSINESS_FACT_WRITING_PROMPT, /Include those applicable conditions every time/);
  assert.match(BUSINESS_FACT_WRITING_PROMPT, /omit that claim rather than shorten away the condition/);
});
