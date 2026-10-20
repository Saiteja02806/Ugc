import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const MODEL = "gpt-5.6-luna";
const PLANNER_EFFORTS = ["low", "medium"];
const WRITER_EFFORTS = ["none", "low", "medium"];
const REVIEWER_EFFORTS = ["low", "medium"];
const samples = readPositiveIntegerArgument("--samples", 2, 1, 5);
const roles = readRolesArgument("--roles", ["planner", "writer", "reviewer"]);
const execute = process.argv.includes("--execute");
const confirmed = process.argv.includes("--yes");

loadEnvFile(path.resolve(".env.local"));

if (!execute) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        model: MODEL,
        plannerEfforts: PLANNER_EFFORTS,
        reviewerEfforts: REVIEWER_EFFORTS,
        roles,
        samples,
        writerEfforts: WRITER_EFFORTS,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!confirmed) {
  throw new Error("Refusing to call the OpenAI API without --yes.");
}

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not configured.");
}

const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 120_000 });
const startedAt = new Date();
const results = [];

for (let sample = 1; sample <= samples; sample += 1) {
  if (roles.includes("planner")) {
    for (const effort of rotate(PLANNER_EFFORTS, sample - 1)) {
      results.push(await benchmarkPlanner({ effort, sample }));
    }
  }
  if (roles.includes("writer")) {
    for (const effort of rotate(WRITER_EFFORTS, sample - 1)) {
      results.push(await benchmarkWriter({ effort, sample }));
    }
  }
  if (roles.includes("reviewer")) {
    for (const effort of rotate(REVIEWER_EFFORTS, sample - 1)) {
      results.push(await benchmarkReviewer({ effort, sample }));
    }
  }
}

const completedAt = new Date();
const report = {
  completedAt: completedAt.toISOString(),
  elapsedMs: completedAt.getTime() - startedAt.getTime(),
  model: MODEL,
  results,
  roles,
  samples,
  startedAt: startedAt.toISOString(),
  summary: summarize(results),
};
const outputDirectory = path.resolve("output", "wall-text-luna-reasoning-benchmark");
mkdirSync(outputDirectory, { recursive: true });
const outputPath = path.join(
  outputDirectory,
  `${startedAt.toISOString().replaceAll(":", "-")}.json`,
);
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ outputPath, ...report }, null, 2));

async function benchmarkPlanner({ effort, sample }) {
  const schema = z
    .object({
      ideas: z
        .array(
          z
            .object({
              audience: z.string().trim().min(2),
              contentIdea: z.string().trim().min(2),
              dailyMoment: z.string().trim().min(2),
              humanObservation: z.string().trim().min(2),
              optionalSupportedFact: z.string().trim(),
              tone: z.string().trim().min(2),
            })
            .strict(),
        )
        .length(10),
    })
    .strict();

  return runRequest({
    effort,
    name: "wall_text_luna_planner_benchmark",
    parseQuality(parsed) {
      const ideas = parsed.ideas;
      const normalized = ideas.map((idea) => normalize(idea.contentIdea));
      const directiveCount = ideas.filter((idea) =>
        /^(?:show|depict|portray|capture|highlight|explore|imagine|picture|present|describe)\b/i.test(
          idea.contentIdea,
        ),
      ).length;
      const productMentionCount = ideas.filter((idea) =>
        /\b(?:cal ai|photo|app)\b/i.test(idea.contentIdea),
      ).length;
      const compliantIdeaCount = ideas.filter((idea) => {
        const words = countWords(idea.contentIdea);
        return words >= 8 && words <= 14;
      }).length;

      return {
        compliantIdeaCount,
        directiveCount,
        ideaCount: ideas.length,
        productMentionCount,
        uniqueIdeaCount: new Set(normalized).size,
      };
    },
    role: "planner",
    sample,
    schema,
    system: [
      "You create private scene cards for short Wall-of-Text social videos.",
      "Create diverse, recognizable daily situations in plain language.",
      "Do not write final overlay copy or production directions.",
      "A product fact is optional. Most ideas should work without naming the product.",
    ].join(" "),
    user: JSON.stringify({
      business: {
        audience: [
          "people trying to lose weight",
          "fitness enthusiasts",
          "busy health-conscious adults",
        ],
        facts: [
          "A meal photo can be analyzed for estimated calories and nutrients.",
          "The app supports food, water, and exercise tracking.",
        ],
        mainProblem: "Manual calorie tracking feels slow and complicated.",
        name: "cal AI",
        restrictions: [
          "Do not claim perfect accuracy.",
          "Do not guarantee weight loss.",
        ],
      },
      requirements: [
        "Return exactly ten scene cards.",
        "Each contentIdea must contain 8 to 14 words.",
        "Use ten different daily actions or settings.",
        "Do not begin contentIdea with Show, Depict, Portray, Capture, Highlight, Explore, Imagine, Picture, Present, or Describe.",
        "At most four contentIdea values may mention cal AI, an app, or a photo.",
      ],
    }),
  });
}

async function benchmarkWriter({ effort, sample }) {
  const schema = z
    .object({
      ideas: z
        .array(
          z
            .object({
              candidateIndex: z.number().int().min(0).max(2),
              text: z.string().trim().min(2),
            })
            .strict(),
        )
        .length(3),
    })
    .strict();

  return runRequest({
    effort,
    name: "wall_text_luna_writer_benchmark",
    parseQuality(parsed) {
      const byIndex = new Map(parsed.ideas.map((idea) => [idea.candidateIndex, idea]));
      const candidates = writerCandidates();
      const diagnostics = candidates.map((candidate) => {
        const text = byIndex.get(candidate.candidateIndex)?.text ?? "";
        const words = countWords(text);
        const sentences = countSentences(text);
        const estimatedReadingSeconds =
          words / 3.2 + Math.max(0, sentences - 1) * 0.25;
        return {
          candidateIndex: candidate.candidateIndex,
          durationSeconds: candidate.durationSeconds,
          estimatedReadingSeconds: round(estimatedReadingSeconds),
          hasSemicolon: text.includes(";"),
          productMention: /\bcal ai\b/i.test(text),
          readableWithCushion:
            estimatedReadingSeconds <= candidate.durationSeconds * 0.85,
          sentenceCount: sentences,
          text,
          wordCount: words,
          wordRangeCompliant:
            words >= candidate.minimumWords && words <= candidate.maximumWords,
        };
      });

      return {
        allIndexesPresent: diagnostics.every((item) => item.text.length > 0),
        diagnostics,
        passedCandidateCount: diagnostics.filter(
          (item) =>
            item.wordRangeCompliant &&
            item.readableWithCushion &&
            item.sentenceCount >= 1 &&
            item.sentenceCount <= 2 &&
            !item.hasSemicolon,
        ).length,
        productMentionCount: diagnostics.filter((item) => item.productMention).length,
      };
    },
    role: "writer",
    sample,
    schema,
    system: [
      "Write immediately understandable Wall-of-Text copy for short social videos.",
      "Use one concrete daily moment and one central thought.",
      "Use one or two short sentences with familiar spoken words.",
      "Do not use semicolons, slogans, calls to action, or forced emotional conclusions.",
      "Use only the planning details needed for the thought. A product mention is optional.",
    ].join(" "),
    user: JSON.stringify({
      businessFacts: {
        mainProblem: "Manual calorie tracking feels slow and complicated.",
        name: "cal AI",
        supportedCapability:
          "A meal photo can be analyzed for estimated calories and nutrients.",
      },
      candidates: writerCandidates(),
      requirements: [
        "Return exactly one text for each candidateIndex.",
        "Respect each candidate's inclusive minimumWords and maximumWords.",
        "Mention cal AI in no more than one of the three texts.",
      ],
    }),
  });
}

async function benchmarkReviewer({ effort, sample }) {
  const cases = reviewerCases();
  const schema = z
    .object({
      reviews: z
        .array(
          z
            .object({
              approved: z.boolean(),
              caseId: z.string().trim().min(1),
              feedback: z.string().trim().min(1).max(240),
              naturalSpokenLanguage: z.boolean(),
              oneCentralThought: z.boolean(),
              readableWithinClip: z.boolean(),
            })
            .strict(),
        )
        .length(cases.length),
    })
    .strict();

  return runRequest({
    effort,
    name: "wall_text_luna_reviewer_benchmark",
    parseQuality(parsed) {
      const expected = new Map(cases.map((item) => [item.caseId, item.expectedApproved]));
      const decisions = parsed.reviews.map((review) => ({
        actualApproved: review.approved,
        caseId: review.caseId,
        correct: expected.get(review.caseId) === review.approved,
        expectedApproved: expected.get(review.caseId),
        feedback: review.feedback,
        naturalSpokenLanguage: review.naturalSpokenLanguage,
        oneCentralThought: review.oneCentralThought,
        readableWithinClip: review.readableWithinClip,
      }));
      return {
        accuracy: round(
          decisions.filter((decision) => decision.correct).length / cases.length,
        ),
        decisions,
      };
    },
    role: "reviewer",
    sample,
    schema,
    system: [
      "Review Wall-of-Text copy; do not rewrite it.",
      "Approve only when the copy is understandable on first read, contains one central thought, sounds natural when spoken, and can be read comfortably during one native play.",
      "Use 3.2 words per second and leave roughly fifteen percent of the clip as reading cushion.",
      "A semicolon-linked marketing mini-story or forced emotional conclusion is not natural spoken language.",
      "Keep every boolean consistent with approved and feedback.",
    ].join(" "),
    user: JSON.stringify({ cases }),
  });
}

async function runRequest({
  effort,
  name,
  parseQuality,
  role,
  sample,
  schema,
  system,
  user,
}) {
  const start = performance.now();
  try {
    const response = await client.chat.completions.parse({
      messages: [
        { content: system, role: "system" },
        { content: user, role: "user" },
      ],
      model: MODEL,
      reasoning_effort: effort,
      response_format: zodResponseFormat(schema, name),
    });
    const latencyMs = performance.now() - start;
    const parsed = response.choices[0]?.message.parsed;
    if (!parsed) throw new Error("The model returned no parsed structured output.");

    return {
      effort,
      latencyMs: Math.round(latencyMs),
      ...(role === "planner" ? { output: parsed } : {}),
      quality: parseQuality(parsed),
      role,
      sample,
      success: true,
      usage: {
        completionTokens: response.usage?.completion_tokens ?? null,
        promptTokens: response.usage?.prompt_tokens ?? null,
        reasoningTokens:
          response.usage?.completion_tokens_details?.reasoning_tokens ?? null,
        totalTokens: response.usage?.total_tokens ?? null,
      },
    };
  } catch (error) {
    return {
      effort,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Math.round(performance.now() - start),
      role,
      sample,
      success: false,
    };
  }
}

function summarize(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.role}:${row.effort}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, group]) => {
    const successful = group.filter((row) => row.success);
    const latencies = successful.map((row) => row.latencyMs).sort((a, b) => a - b);
    const [role, effort] = key.split(":");
    const quality = {};
    if (role === "planner") {
      quality.averageCompliantIdeas = average(
        successful.map((row) => row.quality.compliantIdeaCount),
      );
      quality.averageDirectiveCount = average(
        successful.map((row) => row.quality.directiveCount),
      );
      quality.averageProductMentionCount = average(
        successful.map((row) => row.quality.productMentionCount),
      );
      quality.averageUniqueIdeas = average(
        successful.map((row) => row.quality.uniqueIdeaCount),
      );
    }
    if (role === "writer") {
      quality.averagePassedCandidates = average(
        successful.map((row) => row.quality.passedCandidateCount),
      );
      quality.averageProductMentionCount = average(
        successful.map((row) => row.quality.productMentionCount),
      );
    }
    if (role === "reviewer") {
      quality.averageAccuracy = average(
        successful.map((row) => row.quality.accuracy),
      );
    }

    return {
      averageLatencyMs: average(latencies),
      effort,
      failureCount: group.length - successful.length,
      medianLatencyMs: median(latencies),
      quality,
      role,
      successCount: successful.length,
    };
  });
}

function writerCandidates() {
  return [
    {
      candidateIndex: 0,
      dailyMoment: "Finishing a hard workout and not wanting to type portions into a form.",
      durationSeconds: 8.834,
      humanObservation: "The tracking habit is hardest to continue when the workout already took effort.",
      maximumWords: 26,
      minimumWords: 20,
    },
    {
      candidateIndex: 1,
      dailyMoment: "Serving dinner while a child repeatedly asks for attention.",
      durationSeconds: 6.834,
      humanObservation: "Meal logging competes with real family interruptions.",
      maximumWords: 20,
      minimumWords: 16,
    },
    {
      candidateIndex: 2,
      dailyMoment: "Eating at a networking dinner and feeling awkward opening a calorie calculator.",
      durationSeconds: 6.016,
      humanObservation: "Tracking should not pull someone out of the conversation.",
      maximumWords: 18,
      minimumWords: 14,
    },
  ];
}

function reviewerCases() {
  return [
    {
      caseId: "dense-workout",
      durationSeconds: 8.834,
      expectedApproved: false,
      text: "After a sweaty set I open my phone, dreading typing portions into a long form; the idea of snapping one photo for cal AI to analyze calories and nutrients brings real relief.",
    },
    {
      caseId: "dense-parent",
      durationSeconds: 6.834,
      expectedApproved: false,
      text: "Scooping dinner while a kid tugs my sleeve, I hesitate at a complicated logging screen; taking a quick photo for cal AI to analyze plates fits my distracted life and eases stress.",
    },
    {
      caseId: "dense-networking",
      durationSeconds: 6.016,
      expectedApproved: false,
      text: "At a networking dinner I avoid long calorie calculators that draw attention; quietly snapping one photo while maintaining the conversation and letting cal AI analyze the meal feels discreet and relieving.",
    },
    {
      caseId: "plain-workout",
      durationSeconds: 8.834,
      expectedApproved: true,
      text: "After a hard workout, the last thing I want is another form. One meal photo keeps the habit moving.",
    },
    {
      caseId: "plain-parent",
      durationSeconds: 6.834,
      expectedApproved: true,
      text: "Dinner is chaotic enough. I can snap my plate before the next call for me and keep eating.",
    },
    {
      caseId: "plain-networking",
      durationSeconds: 6.016,
      expectedApproved: true,
      text: "Logging dinner at the table feels awkward. A quick photo lets me stay in the conversation.",
    },
  ];
}

function countWords(value) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function countSentences(value) {
  return value.match(/[.!?](?=\s|$)/gu)?.length ?? 0;
}

function normalize(value) {
  return value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, " ").trim();
}

function rotate(values, offset) {
  const normalizedOffset = offset % values.length;
  return [...values.slice(normalizedOffset), ...values.slice(0, normalizedOffset)];
}

function average(values) {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values) {
  if (values.length === 0) return null;
  const midpoint = Math.floor(values.length / 2);
  return values.length % 2 === 1
    ? values[midpoint]
    : round((values[midpoint - 1] + values[midpoint]) / 2);
}

function round(value) {
  return Math.round(value * 100) / 100;
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

function readRolesArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const values = (process.argv[index + 1] ?? "")
    .split(",")
    .map((value) => value.trim().toLocaleLowerCase("en-US"))
    .filter(Boolean);
  const supported = new Set(["planner", "writer", "reviewer"]);
  if (values.length === 0 || values.some((value) => !supported.has(value))) {
    throw new Error(`${name} must be a comma-separated subset of planner, writer, reviewer.`);
  }
  return [...new Set(values)];
}

function loadEnvFile(filePath) {
  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = cleanEnvValue(match[2]);
  }
}

function cleanEnvValue(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];
  return (quote === "'" || quote === '"') && trimmed.endsWith(quote)
    ? trimmed.slice(1, -1)
    : trimmed;
}
