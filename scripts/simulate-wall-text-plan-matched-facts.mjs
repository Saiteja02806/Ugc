import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const execute = process.argv.includes("--execute");
const confirmed = process.argv.includes("--yes");
const cardCount = readPositiveIntegerArgument("--cards", 5, 1, 5);

if (!execute) {
  console.log(JSON.stringify({
    databaseWrites: false,
    dryRun: true,
    modelCalls: false,
    cardCount,
    purpose: "Generate five new Wall plan items, map each to its selected fact, and write five cards without saving any production data.",
  }, null, 2));
  process.exit(0);
}
if (!confirmed) {
  throw new Error("Refusing to call the model without --yes.");
}

loadEnvFile(path.resolve(".env.local"));
if (!process.env.OPENAI_API_KEY?.trim()) {
  throw new Error("OPENAI_API_KEY is not configured.");
}

console.log(`Starting a ${cardCount}-card Wall fact-selection simulation with no database writes.`);

const [
  { buildWallTextPlanningContext },
  { buildWallTextFactGroundingAssignments, selectWallTextGroundingFact },
  { createWallTextLayout },
  { generateBusinessTrendingWallTextIdeas },
  { generateWallTextContentPlanChunk },
] = await Promise.all([
  import("../lib/trending/wall-text-content-plan.ts"),
  import("../lib/trending/wall-text-grounding.ts"),
  import("../lib/trending/wall-text-feed-logic.ts"),
  import("../lib/trending/generate-trending-wall-text-ideas.ts"),
  import("../worker/dist/lib/wall-text-content-plan.js"),
]);

// This fixture has the same decision shape as the reported production issue:
// a manager needs to approve content across more than one account. It never
// reads or writes a user, a plan, a reservation, or a creative row.
const business = {
  brandTone: "Clear and practical",
  businessName: "UGC Pilot",
  businessModel: "b2b_saas",
  campaignPurposes: ["product_discovery"],
  carouselAngles: [],
  categories: ["Social media marketing"],
  category: "Social media marketing",
  claimsToAvoid: [],
  confidence: "high",
  confidenceReason: "Simulation fixture",
  ctaIdeas: [],
  differentiators: ["Manage several Instagram accounts from one workspace"],
  mainProblem: "Post approvals take too much of a marketing manager's day",
  mainPromise: "Make content planning easier to manage",
  missingInfo: [],
  painPoints: ["A final approval can hold up the rest of the day's work"],
  pexelsImageQueries: [],
  productSummary: "UGC Pilot helps teams prepare social content before publishing.",
  recommendedCarouselStructure: [],
  targetAudience: ["Marketing managers"],
  valueProps: [
    "Keep human approval before a post goes live",
    "Plan content for several Instagram accounts in one workspace",
  ],
  visualKeywords: [],
};

const planningContext = buildWallTextPlanningContext(business);
const plan = await generateWallTextContentPlanChunk({
  briefIndexStart: 1,
  businessDescription: "UGC Pilot helps marketing managers prepare, review, and organize social content across Instagram accounts.",
  count: 5,
  existingItems: [],
  planningContext,
});

assert.equal(plan.items.length, 5);
console.log("Planner returned five ideas with selected fact IDs.");
const factById = new Map(
  planningContext.approvedFactSnapshot.facts.map((fact) => [fact.id, fact]),
);
for (const item of plan.items) {
  assert.ok(item.planningBrief.selectedFactId, "Planner omitted selectedFactId.");
  assert.ok(
    factById.has(item.planningBrief.selectedFactId),
    "Planner selected an ID outside the saved fact snapshot.",
  );
}

const groundingByCandidate = buildWallTextFactGroundingAssignments({
  analysis: business,
  candidateIndexes: plan.items.map((_, index) => index),
});
const selectedFactIds = plan.items.map(
  (item) => item.planningBrief.selectedFactId,
);
const writerItems = plan.items.slice(0, cardCount);
console.log(`Writing ${writerItems.length} card(s) against their plan-selected facts.`);
const generated = await generateBusinessTrendingWallTextIdeas({
  business,
  candidates: writerItems.map((item, candidateIndex) => {
    const selectedFactId = item.planningBrief.selectedFactId;
    const reservationGrounding = groundingByCandidate.get(candidateIndex);
    assert.ok(selectedFactId && reservationGrounding);
    return {
      candidateIndex,
      durationSeconds: 8,
      grounding: selectWallTextGroundingFact(reservationGrounding, selectedFactId),
      layout: createWallTextLayout(),
      maxWords: 48,
      privateCreativeContext: {
        contentIdea: item.contentIdea,
        feeling: item.feeling,
        planningBrief: item.planningBrief,
      },
      targetWords: 36,
    };
  }),
});

assert.equal(generated.length, writerItems.length);
const report = generated.map((idea) => {
  const item = plan.items[idea.candidateIndex];
  const selectedFactId = selectedFactIds[idea.candidateIndex];
  const text = idea.content.fullText;
  const wordCount = text.split(/\s+/u).filter(Boolean).length;
  assert.ok(wordCount >= 24 && wordCount <= 48);
  assert.equal(idea.content.grounding?.anchorId, selectedFactId);
  return {
    contentIdea: item.contentIdea,
    selectedFact: factById.get(selectedFactId)?.text,
    selectedFactId,
    text,
    wordCount,
  };
});

console.log(JSON.stringify({
  databaseWrites: false,
  generatedCards: report,
  plannerPromptVersion: "wall-text-content-plan-reader-profiles-v15-fact-first-structured-order",
  writerPromptVersion: "wall-text-writer-prompt-v26-plan-matched-fact-business-name-role",
}, null, 2));

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].trim();
    process.env[match[1]] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
}

function readPositiveIntegerArgument(name, fallback, minimum, maximum) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number.parseInt(process.argv[index + 1] ?? "", 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}
