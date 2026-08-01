import { readFileSync } from "node:fs";
import path from "node:path";

import OpenAI from "openai";

import {
  generateValidatedTrendingHookCopies,
} from "../worker/dist/lib/trending-hook-copy.js";

const execute = process.argv.includes("--execute");
const confirmed = process.argv.includes("--yes");
const quick = process.argv.includes("--quick");

loadEnvFile(path.resolve(".env.local"));

if (!execute) {
  console.log(
    "Dry run: this canary will call the Hook writer and reviewer for three sample clips. Add --execute --yes to run it.",
  );
  process.exit(0);
}

if (!confirmed) {
  throw new Error(
    "Refusing to call the model without --yes.",
  );
}

const apiKey = process.env.OPENAI_API_KEY?.trim();

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not configured.");
}

const client = new OpenAI({
  apiKey,
  maxRetries: 2,
  timeout: 60_000,
});
const capturedStages = [];
const canaryClient = {
  responses: {
    create: async (request) => {
      const response = await client.responses.create(request);

      capturedStages.push({
        output: parseJsonForDiagnostics(response.output_text),
        responseFormat: request.text?.format?.name ?? "unknown",
      });
      return response;
    },
  },
};
const testModel =
  process.env.OPENAI_TRENDING_HOOK_TEST_MODEL?.trim() ||
  "gpt-5-mini";
const sharedCandidate = {
  influencerId: "catalog:creator-001",
  influencerKey: "creator_001",
  influencerName: "Creator 001",
  sourceKind: "catalog",
  thumbnailUrl: null,
  trimStart: 0,
  visualGroup: "indoor_selfie_closeup",
};
let results;

try {
  results = await generateValidatedTrendingHookCopies({
  businessProfile: {
    brandTone: "direct, supportive, practical",
    businessName: "Calorie Fit",
    category: "Nutrition tracking app",
    claimsToAvoid: [
      "guaranteed weight loss",
      "medical claims",
    ],
    mainProblem: "Meal logging feels slow and becomes a chore.",
    mainPromise: "Make food tracking easier to stay consistent with.",
    painPoints: [
      "Giving up because logging takes too long",
    ],
    productSummary:
      "A meal and calorie tracking app designed to make logging food faster and easier.",
    targetAudience: [
      "People who want to improve nutrition without tedious meal logging",
    ],
    valueProps: [
      "Fast meal logging",
      "Simple nutrition visibility",
    ],
  },
  candidates: [
    {
      ...sharedCandidate,
      candidateIndex: 0,
      durationSeconds: 3,
      influencerVideoId: "canary-shock",
      influencerVideoTitle: "Surprised reaction",
      reactionType: "shock_surprise",
      sourceDurationSeconds: 3,
      trimEnd: 3,
    },
    {
      ...sharedCandidate,
      candidateIndex: 1,
      durationSeconds: 4,
      influencerVideoId: "canary-concern",
      influencerVideoTitle: "Concerned reaction",
      reactionType: "concern_anxiety",
      sourceDurationSeconds: 4,
      trimEnd: 4,
    },
    {
      ...sharedCandidate,
      candidateIndex: 2,
      durationSeconds: 2,
      influencerVideoId: "canary-skeptical",
      influencerVideoTitle: "Skeptical reaction",
      reactionType: "skepticism",
      sourceDurationSeconds: 2,
      trimEnd: 2,
    },
  ].slice(0, quick ? 1 : 3),
  client: canaryClient,
  model: testModel,
  });
} catch (error) {
  console.error(
    JSON.stringify(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown Hook canary failure.",
        model: testModel,
        stages: capturedStages,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
  process.exit();
}

console.log(
  JSON.stringify(
    {
      model: testModel,
      results: results.map((result) => ({
        candidateIndex: result.candidateIndex,
        durationSeconds: result.durationSeconds,
        estimatedReadingSeconds:
          result.readabilityReview.estimatedReadingSeconds,
        hookText: result.hookText,
        reactionType: result.reactionType,
        repairApplied: result.readabilityReview.repairApplied,
        visualFit: result.visualFit.fits,
      })),
    },
    null,
    2,
  ),
);

function loadEnvFile(filePath) {
  const contents = readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/u)) {
    const match = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    );

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = cleanEnvValue(match[2]);
  }
}

function cleanEnvValue(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  return (quote === "'" || quote === '"') &&
    trimmed.endsWith(quote)
    ? trimmed.slice(1, -1)
    : trimmed;
}

function parseJsonForDiagnostics(value) {
  if (!value?.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return { invalidJson: true };
  }
}
