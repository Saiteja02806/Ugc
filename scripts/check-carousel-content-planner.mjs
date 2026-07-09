import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@": workspaceRoot,
  },
});

const workerPlanner = await jiti.import(
  "../worker/src/lib/carousel-llm-slide-plan.ts",
);
const fixture = createPlanFixture();
const workerParsed = workerPlanner.parseCarouselContentPlan(fixture, 5);
const failures = [];

if (
  workerParsed.slides[0]?.layoutPreset !== "top-hook" ||
  workerParsed.slides[4]?.layoutPreset !== "middle-statement"
) {
  failures.push("Planner did not derive the expected renderer layout presets.");
}

if (
  workerParsed.slides[1]?.textMode !== "body_only" ||
  workerParsed.slides[1]?.headline !== null ||
  workerParsed.slides[2]?.textMode !== "question_list" ||
  workerParsed.slides[2]?.listItems.length !== 3
) {
  failures.push("Planner did not preserve the flexible text-mode contract.");
}

const unsafeFixture = structuredClone(fixture);
unsafeFixture.slides[1].imageDirection =
  "A person holding a phone beside an overloaded calendar.";

try {
  workerPlanner.parseCarouselContentPlan(unsafeFixture, 5);
  failures.push("Worker planner accepted a prohibited human visual subject.");
} catch (error) {
  if (!String(error).includes("prohibited human subject")) {
    failures.push("Worker planner rejected unsafe input for the wrong reason.");
  }
}

process.env.CAROUSEL_CONTENT_PLANNER_MODE = "deterministic";
const analysis = createAnalysisFixture();
const fallbackPlan = await workerPlanner.buildCarouselContentPlan({
  analysis,
  candidateIndex: 0,
  selectedAngle: "Why campaign work keeps leaking into the evening",
  slideCount: 5,
});

if (
  fallbackPlan.source !== "deterministic-fallback" ||
  fallbackPlan.slides.length !== 5 ||
  fallbackPlan.plannerVersion !== "llm-carousel-planner-v1"
) {
  failures.push("Deterministic planner fallback contract is invalid.");
}

let livePlan = null;

if (process.argv.includes("--live")) {
  loadEnvFile(path.resolve(workspaceRoot, ".env.local"));
  delete process.env.CAROUSEL_CONTENT_PLANNER_MODE;
  livePlan = await workerPlanner.buildCarouselContentPlan({
    analysis,
    candidateIndex: 1,
    selectedAngle: "The hidden cost of scattered campaign work",
    slideCount: 5,
  });

  if (livePlan.source !== "llm") {
    failures.push(`Live planner used fallback: ${livePlan.fallbackReason}`);
  }
}

console.log(
  JSON.stringify(
    {
      fixture: {
        broadSituations: workerParsed.broadSituations,
        concept: workerParsed.concept,
        slideTypes: workerParsed.slides.map((slide) => slide.slideType),
      },
      livePlan: livePlan
        ? {
            broadSituations: livePlan.broadSituations,
            concept: livePlan.concept,
            model: livePlan.model,
            plannerVersion: livePlan.plannerVersion,
            slides: livePlan.slides,
            source: livePlan.source,
          }
        : null,
      plannerVersion: workerPlanner.CAROUSEL_CONTENT_PLANNER_VERSION,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}

function createPlanFixture() {
  return {
    broadSituations: [
      "deadline overload before a campaign launch",
      "scattered reporting across too many files",
      "late-night checks caused by missed follow-ups",
    ],
    concept: "The campaign workday that never ends",
    slides: [
      {
        body: "Scattered work turns every launch into an after-hours scramble.",
        ctaText: null,
        headline: "Your campaign should not follow you home",
        imageDirection:
          "Overloaded paper calendar beside a closed laptop with open space at the top.",
        listItems: [],
        slideNumber: 1,
        slideType: "hook",
        textMode: "headline_body",
      },
      {
        body:
          "Every update becomes another file, and the next action gets harder to find.",
        ctaText: null,
        headline: null,
        imageDirection:
          "Messy spreadsheet printouts beside a calculator with clear lower text space.",
        listItems: [],
        slideNumber: 2,
        slideType: "problem",
        textMode: "body_only",
      },
      {
        body: null,
        ctaText: null,
        headline: "which work keeps slipping?",
        imageDirection:
          "Clean analytics dashboard on a monitor with balanced center text space.",
        listItems: [
          "reporting updates",
          "follow-up reminders",
          "approval notes",
        ],
        slideNumber: 3,
        slideType: "differentiator",
        textMode: "question_list",
      },
      {
        body: "The next action is already clear before tomorrow begins.",
        ctaText: null,
        headline: null,
        imageDirection:
          "Closed laptop on an organized evening desk with a lamp and open upper space.",
        listItems: [],
        slideNumber: 4,
        slideType: "benefit",
        textMode: "single_statement",
      },
      {
        body: "Build your campaign",
        ctaText: "Build your campaign",
        headline: "Put the next launch in one place",
        imageDirection:
          "Minimal laptop and notebook still life with clean central negative space.",
        listItems: [],
        slideNumber: 5,
        slideType: "cta",
        textMode: "cta_takeaway",
      },
    ],
  };
}

function createAnalysisFixture() {
  return {
    brandTone: "clear and practical",
    businessName: "CampaignFlow",
    carouselAngles: [
      "Why campaign work keeps leaking into the evening",
      "The hidden cost of scattered campaign work",
    ],
    category: "marketing SaaS",
    claimsToAvoid: ["guaranteed revenue growth"],
    confidence: "high",
    confidenceReason: "The product and workflow are clearly described.",
    ctaIdeas: ["Build your campaign"],
    differentiators: ["Planning and reporting stay in one workspace"],
    mainProblem: "Campaign planning and reporting are scattered across tools",
    mainPromise: "Keep campaign work in one organized workflow",
    missingInfo: [],
    painPoints: [
      "Missed follow-ups",
      "Manual spreadsheet reporting",
      "Late-night campaign checks",
    ],
    pexelsImageQueries: ["organized laptop desk", "paper calendar overhead"],
    productSummary: "A workspace for planning and reporting marketing campaigns.",
    recommendedCarouselStructure: [],
    targetAudience: ["small marketing teams"],
    valueProps: ["Connect planning, follow-up, and reporting"],
    visualKeywords: ["calendar overload", "spreadsheet clutter", "organized desk"],
  };
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line
      .trim()
      .match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}
