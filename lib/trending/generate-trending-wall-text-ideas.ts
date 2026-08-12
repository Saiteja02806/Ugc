import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";
import { createAuthoritativeWallTextContent } from "@/lib/trending/wall-layout-engine";
import {
  getEligibleWallTextFormatIds,
  getEligibleWallTextFormats,
  getWallTextFormat,
} from "@/lib/trending/wall-formats";
import {
  buildWallTextGenerationPrompt,
  getWallTextWordBudget,
} from "@/lib/trending/wall-prompt";
import { createWallTextLayout } from "@/lib/trending/wall-text-feed-logic";
import {
  buildWallTextBusinessContext,
  normalizeWallTextGenerationCandidates,
  type WallTextGenerationCandidate,
} from "@/lib/trending/wall-text-text-logic";
import {
  type TrendingWallTextLayout,
  type WallTextFormatId,
  type WallTextSourceContent,
} from "@/lib/trending/wall-text-types";

const DEFAULT_MODEL = "gpt-5-mini";
const MAX_WALL_TEXT_IDEA_COUNT = 6;

const WallTextSourceContentSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("prose"),
      text: z.string().trim().min(8).max(600),
    })
    .strict(),
  z
    .object({
      items: z.array(z.string().trim().min(2).max(100)).min(3).max(5),
      kind: z.literal("list"),
      title: z.string().trim().min(2).max(100),
    })
    .strict(),
]);

const EligibleWallTextFormatIdSchema = z.enum(
  getEligibleWallTextFormatIds(),
);

const WallTextIdeaOutputSchema = z
  .object({
    ideas: z
      .array(
        z
          .object({
            candidateIndex: z.number().int().min(0),
            content: WallTextSourceContentSchema,
            formatId: EligibleWallTextFormatIdSchema,
          })
          .strict(),
      )
      .min(1)
      .max(MAX_WALL_TEXT_IDEA_COUNT),
  })
  .strict();

const PROMOTIONAL_OR_CTA_PATTERNS = [
  /\b(?:book a call|download now|get started|join the waitlist|link in bio|shop now|try it|unlock your)\b/iu,
  /\b(?:game[- ]changer|revolutioni[sz]e|seamless(?:ly)?|supercharge)\b/iu,
] as const;

let openaiClient: OpenAI | null = null;

export function getTrendingWallTextModelName() {
  return process.env.OPENAI_WALL_TEXT_MODEL?.trim() || DEFAULT_MODEL;
}

export async function generateBusinessTrendingWallTextIdeas(params: {
  business: WebsiteBusinessAnalysis;
  candidates: Array<WallTextGenerationCandidate & { layout?: TrendingWallTextLayout }>;
}) {
  const candidates = normalizeWallTextGenerationCandidates(params.candidates);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI is not configured.");
  if (!openaiClient) openaiClient = new OpenAI({ apiKey });

  const business = buildWallTextBusinessContext(params.business);
  const completion = await openaiClient.chat.completions.parse({
    model: getTrendingWallTextModelName(),
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content:
          "You write grounded Wall-of-Text social posts. Return structured content, never visual line breaks.",
      },
      {
        role: "user",
        content: buildWallTextGenerationPrompt({ business, candidates }),
      },
    ],
    response_format: zodResponseFormat(
      WallTextIdeaOutputSchema,
      "trending_wall_text_ideas_v6",
    ),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("OpenAI returned no structured Wall-of-text ideas.");

  const layoutsByIndex = new Map(
    params.candidates.map((candidate) => [
      candidate.candidateIndex,
      candidate.layout ?? createWallTextLayout(),
    ]),
  );
  const guarded = validateOneCallOutput({
    business,
    candidates,
    ideas: parsed.ideas,
  });

  return Promise.all(
    guarded.map(async (idea) => {
      const result = await createAuthoritativeWallTextContent({
        content: idea.content,
        formatId: idea.formatId,
        layout: layoutsByIndex.get(idea.candidateIndex)!,
      });
      return {
        candidateIndex: idea.candidateIndex,
        content: result.content,
        layout: result.layout,
      };
    }),
  );
}

function validateOneCallOutput(params: {
  business: ReturnType<typeof buildWallTextBusinessContext>;
  candidates: ReturnType<typeof normalizeWallTextGenerationCandidates>;
  ideas: Array<{
    candidateIndex: number;
    content: WallTextSourceContent;
    formatId: WallTextFormatId;
  }>;
}) {
  const candidateByIndex = new Map(
    params.candidates.map((candidate) => [candidate.candidateIndex, candidate]),
  );
  const eligibleIds = new Set(getEligibleWallTextFormats().map((format) => format.id));
  const seenCandidates = new Set<number>();
  const seenCopy = new Set<string>();

  if (params.ideas.length !== params.candidates.length) {
    throw new Error("AI did not return one Wall-of-text idea for every candidate.");
  }

  const validated = params.ideas.map((idea) => {
    const candidate = candidateByIndex.get(idea.candidateIndex);
    if (!candidate || seenCandidates.has(idea.candidateIndex)) {
      throw new Error("AI returned an invalid Wall-of-text candidate mapping.");
    }
    seenCandidates.add(idea.candidateIndex);

    if (!eligibleIds.has(idea.formatId)) {
      throw new Error("AI selected a Wall-of-text format that is not eligible.");
    }
    const format = getWallTextFormat(idea.formatId);
    if (format.contentKind !== idea.content.kind) {
      throw new Error("AI returned content that does not match its Wall format.");
    }

    const content = normalizeSourceContent(idea.content);
    const fullText = toFullText(content);
    const budget = getWallTextWordBudget(candidate.durationSeconds);
    const wordCount = fullText.split(/\s+/u).filter(Boolean).length;
    if (wordCount < budget.minimum || wordCount > budget.maximum) {
      throw new Error(
        `Wall-of-text candidate ${idea.candidateIndex + 1} must contain ${budget.minimum}-${budget.maximum} words for its clip.`,
      );
    }
    if (PROMOTIONAL_OR_CTA_PATTERNS.some((pattern) => pattern.test(fullText))) {
      throw new Error("AI returned promotional language instead of Wall-of-text copy.");
    }
    if (idea.formatId === "community_prompt") {
      const questions = [...fullText].filter((character) => character === "?").length;
      if (questions !== 1 || !fullText.endsWith("?")) {
        throw new Error("A community prompt must end immediately after one question.");
      }
    }
    for (const avoidedClaim of params.business.claimsToAvoid) {
      const normalizedClaim = normalizeComparison(avoidedClaim);
      if (normalizedClaim.length >= 5 && normalizeComparison(fullText).includes(normalizedClaim)) {
        throw new Error("AI used a claim that the Business Profile explicitly forbids.");
      }
    }
    const comparison = normalizeComparison(fullText);
    if (seenCopy.has(comparison)) {
      throw new Error("AI returned duplicate Wall-of-text ideas.");
    }
    seenCopy.add(comparison);
    return { ...idea, content };
  });

  return validated.sort((left, right) => left.candidateIndex - right.candidateIndex);
}

function normalizeSourceContent(content: WallTextSourceContent): WallTextSourceContent {
  if (content.kind === "prose") {
    return { kind: "prose", text: normalizeText(content.text) };
  }
  return {
    items: content.items.map(normalizeText),
    kind: "list",
    title: normalizeText(content.title),
  };
}

function toFullText(content: WallTextSourceContent) {
  return content.kind === "prose"
    ? content.text
    : `${content.title}: ${content.items.join("; ")}.`;
}

function normalizeText(value: string) {
  return value.replace(/[\r\n]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function normalizeComparison(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
