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
const structure2Planner = await jiti.import(
  "../worker/src/lib/carousel-structure-2-planner.ts",
);
const structure2Formats = await jiti.import(
  "../worker/src/lib/carousel-structure-2-formats.ts",
);
const fixture = createPlanFixture();
const analysis = createAnalysisFixture();
const workerParsed = workerPlanner.parseCarouselContentPlan(fixture, 6);
const failures = [];

if (
  workerParsed.slides[0]?.layoutPreset !== "top-hook" ||
  workerParsed.slides[5]?.layoutPreset !== "middle-statement"
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
  workerPlanner.parseCarouselContentPlan(unsafeFixture, 6);
  failures.push("Worker planner accepted a prohibited human visual subject.");
} catch (error) {
  if (!String(error).includes("prohibited human subject")) {
    failures.push("Worker planner rejected unsafe input for the wrong reason.");
  }
}

const clockHandsFixture = structuredClone(fixture);
clockHandsFixture.slides[2].imageDirection =
  "A clock with hands moving quickly beside scattered campaign papers.";

try {
  workerPlanner.parseCarouselContentPlan(clockHandsFixture, 6);
} catch {
  failures.push("Planner treated clock hands as a prohibited human subject.");
}

const plannerSource = readFileSync(
  path.resolve(workspaceRoot, "worker/src/lib/carousel-llm-slide-plan.ts"),
  "utf8",
);
if (
  /allowDeterministicFallback|buildFallbackPlan|deterministic-fallback|CAROUSEL_CONTENT_PLANNER_MODE/.test(
    plannerSource,
  )
) {
  failures.push("Structure 1 still contains a runtime authored-copy fallback.");
}

const parsedBadCopy = structuredClone(workerParsed);
parsedBadCopy.slides[1] = {
  ...parsedBadCopy.slides[1],
  body: "Traditional tracking lacks guidance.. Need for context in tracking",
  subtext: "Traditional tracking lacks guidance.. Need for context in tracking",
};
const badCopyIssues = workerPlanner.partitionCarouselContentPlanValidationIssues(
  workerPlanner.validateCarouselContentPlan(parsedBadCopy),
);
if (
  !badCopyIssues.blockingIssues.some(
    (issue) => issue.code === "repeated_punctuation",
  )
) {
  failures.push("Planner did not block repeated punctuation for repair.");
}

const qualityIssues = workerPlanner.validateCarouselContentPlan({
  ...workerParsed,
  slides: workerParsed.slides.map((slide, index) =>
    index === 1
      ? {
          ...slide,
          body: "Boost your productivity effortlessly.",
          subtext: "Boost your productivity effortlessly.",
        }
      : slide,
  ),
});

if (!qualityIssues.some((issue) => issue.code === "generic_copy")) {
  failures.push("Planner quality validation missed generic copy.");
}

const unsupportedClaimFixture = structuredClone(workerParsed);
unsupportedClaimFixture.slides[5] = {
  ...unsupportedClaimFixture.slides[5],
  body: "Join millions of users and regain control over your marketing.",
  subtext: "Join millions of users and regain control over your marketing.",
};
const unsupportedClaimIssues = workerPlanner.validateCarouselContentPlan(
  unsupportedClaimFixture,
  analysis,
);

if (!unsupportedClaimIssues.some((issue) => issue.code === "unsupported_claim")) {
  failures.push("Planner quality validation missed quantified social proof.");
}

const unsupportedBrandFixture = structuredClone(workerParsed);
unsupportedBrandFixture.slides[3] = {
  ...unsupportedBrandFixture.slides[3],
  imageDirection: "A laptop displaying the OtherFlow campaign dashboard.",
};
const unsupportedBrandIssues = workerPlanner.validateCarouselContentPlan(
  unsupportedBrandFixture,
  analysis,
);

if (
  !unsupportedBrandIssues.some(
    (issue) =>
      issue.code === "unsupported_claim" &&
      issue.message.includes("OtherFlow"),
  )
) {
  failures.push("Planner quality validation missed an invented product name.");
}

const unsupportedCtaBrandFixture = structuredClone(workerParsed);
unsupportedCtaBrandFixture.slides[5] = {
  ...unsupportedCtaBrandFixture.slides[5],
  ctaText: "Get Notion free",
};
const unsupportedCtaBrandIssues = workerPlanner.validateCarouselContentPlan(
  unsupportedCtaBrandFixture,
  analysis,
);

if (
  !unsupportedCtaBrandIssues.some(
    (issue) =>
      issue.code === "unsupported_claim" && issue.message.includes("Notion"),
  )
) {
  failures.push("Planner quality validation missed a foreign CTA brand.");
}

const repeatedHeadlineFixture = structuredClone(workerParsed);
repeatedHeadlineFixture.slides[3] = {
  ...repeatedHeadlineFixture.slides[3],
  body: "Automate workflows to keep campaign management in one clear place.",
  headline: "Automate Workflows",
  subtext: "Automate workflows to keep campaign management in one clear place.",
  textMode: "headline_body",
};
const repeatedHeadlineIssues = workerPlanner.validateCarouselContentPlan(
  repeatedHeadlineFixture,
);

if (!repeatedHeadlineIssues.some((issue) => issue.code === "headline_body_repetition")) {
  failures.push("Planner did not block repeated headline and body copy.");
}

const partialHeadlineRepeatFixture = structuredClone(workerParsed);
partialHeadlineRepeatFixture.slides[0] = {
  ...partialHeadlineRepeatFixture.slides[0],
  body: "Campaign chaos leads to missed opportunities and confusion.",
  headline: "Tired of campaign chaos?",
  subtext: "Campaign chaos leads to missed opportunities and confusion.",
};
const partialHeadlineRepeatIssues = workerPlanner.validateCarouselContentPlan(
  partialHeadlineRepeatFixture,
);

if (!partialHeadlineRepeatIssues.some((issue) => issue.code === "headline_body_repetition")) {
  failures.push("Planner did not block an overlapping headline and body.");
}

const repeatedWordFixture = structuredClone(workerParsed);
repeatedWordFixture.slides[2] = {
  ...repeatedWordFixture.slides[2],
  body: "This scattered approach leads to lost leads and delayed decisions.",
  listItems: [],
  subtext: "This scattered approach leads to lost leads and delayed decisions.",
  textMode: "body_only",
};
const repeatedWordIssues =
  workerPlanner.validateCarouselContentPlan(repeatedWordFixture);

if (!repeatedWordIssues.some((issue) => issue.code === "grammar")) {
  failures.push("Planner quality validation missed a nearby repeated word.");
}

const pluralRepeatedWordFixture = structuredClone(workerParsed);
pluralRepeatedWordFixture.slides[2] = {
  ...pluralRepeatedWordFixture.slides[2],
  body: "Scattered tools lead to missed leads and delayed responses.",
  listItems: [],
  subtext: "Scattered tools lead to missed leads and delayed responses.",
  textMode: "body_only",
};
const pluralRepeatedWordIssues =
  workerPlanner.validateCarouselContentPlan(pluralRepeatedWordFixture);

if (!pluralRepeatedWordIssues.some((issue) => issue.code === "grammar")) {
  failures.push("Planner quality validation missed lead/leads repetition.");
}

const repeatedConnectorFixture = structuredClone(workerParsed);
repeatedConnectorFixture.slides[3] = {
  ...repeatedConnectorFixture.slides[3],
  body:
    "Automate workflows with CampaignFlow for better management for clearer campaign decisions.",
  listItems: [],
  subtext:
    "Automate workflows with CampaignFlow for better management for clearer campaign decisions.",
  textMode: "body_only",
};
const repeatedConnectorIssues =
  workerPlanner.validateCarouselContentPlan(repeatedConnectorFixture, analysis);

if (
  !repeatedConnectorIssues.some(
    (issue) => issue.code === "grammar" || issue.code === "generic_copy",
  )
) {
  failures.push("Planner quality validation missed a repeated connector.");
}

const publishingIssuePartition =
  workerPlanner.partitionCarouselContentPlanValidationIssues([
    ...workerPlanner.validateCarouselContentPlan(repeatedConnectorFixture, analysis),
    ...workerPlanner.validateCarouselRecentContentRepetition(
      repeatedConnectorFixture,
      [],
    ),
  ]);

if (
  !publishingIssuePartition.blockingIssues.some(
    (issue) => issue.code === "grammar" || issue.code === "generic_copy",
  )
) {
  failures.push("Planner did not block invalid copy for repair.");
}

const exactRegressionFixture = structuredClone(workerParsed);
exactRegressionFixture.slides[3] = {
  ...exactRegressionFixture.slides[3],
  body:
    Array.from({ length: 45 }, () => "workflow").join(" "),
  headline: Array.from({ length: 17 }, () => "planning").join(" "),
  subtext:
    Array.from({ length: 45 }, () => "workflow").join(" "),
  textMode: "headline_body",
};
const exactRegressionIssues = workerPlanner.validateCarouselContentPlan(
  exactRegressionFixture,
);

if (
  !exactRegressionIssues.some((issue) => issue.code === "headline_length") ||
  !exactRegressionIssues.some((issue) => issue.code === "body_length")
) {
  failures.push("Planner accepted the exact overlong production regression copy.");
}

let livePlan = null;
let liveStructure2Plans = null;

if (process.argv.includes("--live")) {
  loadEnvFile(path.resolve(workspaceRoot, ".env.local"));
  livePlan = await workerPlanner.buildCarouselContentPlan({
    analysis,
    candidateIndex: 1,
    contentFormatId: "problem_solution",
    hookFamilyId: "problem_recognition",
    recentHistory: [],
    selectedAngle: "The hidden cost of scattered campaign work",
    slideCount: 6,
  });

  if (livePlan.source !== "llm") {
    failures.push(`Live Structure 1 planner returned source ${livePlan.source}.`);
  }
  if (livePlan.model !== "gpt-4o-mini") {
    failures.push(`Live Structure 1 planner used model ${livePlan.model}.`);
  }

  liveStructure2Plans =
    await structure2Planner.buildCarouselStructure2StoryPlanBatch({
      businessDescription: analysis.productSummary,
      assignments: structure2Formats.CAROUSEL_STRUCTURE_2_FORMAT_IDS
        .slice(0, 5)
        .map((storyFormatId, slotIndex) => ({
          candidateIndex: slotIndex,
          slotIndex,
          storyFormatId,
        })),
      recentHistory: [],
    });

  if (
    liveStructure2Plans.length !== 5 ||
    liveStructure2Plans.some(
      (item) =>
        item.source !== "llm" ||
        item.model !== "gpt-4o-mini" ||
        item.validationResult.fallbackUsed,
    )
  ) {
    failures.push("Live Structure 2 planner violated the LLM-only batch contract.");
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
            fallbackReason: livePlan.fallbackReason,
            model: livePlan.model,
            plannerVersion: livePlan.plannerVersion,
            rawLlmResponse: livePlan.rawLlmResponse,
            slides: livePlan.slides,
            source: livePlan.source,
            validationResult: livePlan.validationResult,
          }
        : null,
      liveStructure2Plans: liveStructure2Plans
        ? liveStructure2Plans.map((item) => ({
            advisoryIssues: item.validationResult.advisoryIssues,
            model: item.model,
            plannerVersion: item.plannerVersion,
            slides: item.plan.slides,
            source: item.source,
            storyFormatId: item.assignedStoryFormatId,
          }))
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
        body: "Why campaign updates keep spilling into after-hours work.",
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
          "Every update becomes another file while the next action gets harder to find before launch.",
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
        body:
          "A visible next action keeps tomorrow moving without rebuilding the campaign plan again.",
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
        body:
          "Set the next decision beside the approval note before closing each campaign review.",
        ctaText: null,
        headline: null,
        imageDirection:
          "Organized campaign notes beside a clear weekly calendar with centered text space.",
        listItems: [],
        slideNumber: 5,
        slideType: "benefit",
        textMode: "body_only",
      },
      {
        body:
          "Connected planning and reporting keep the next campaign easier to launch and review.",
        ctaText: "Build your campaign",
        headline: "Put the next launch in one place",
        imageDirection:
          "Minimal laptop and notebook still life with clean central negative space.",
        listItems: [],
        slideNumber: 6,
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
