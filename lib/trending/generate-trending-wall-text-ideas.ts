import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";
import {
  getWallTextMaximumWords,
  normalizeWallTextGenerationCandidates,
  validateGeneratedWallTextIdeas,
  type GeneratedWallTextIdea,
  type WallTextGenerationCandidate,
} from "@/lib/trending/wall-text-text-logic";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_WALL_TEXT_IDEA_COUNT = 6;

const WallTextIdeaOutputSchema = z
  .object({
    ideas: z
      .array(
        z
          .object({
            body: z.string().trim().min(20).max(480),
            candidateIndex: z.number().int().min(0),
            closing: z.string().trim().min(4).max(120),
            headline: z.string().trim().min(4).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_WALL_TEXT_IDEA_COUNT),
  })
  .strict();

let openaiClient: OpenAI | null = null;

export function getTrendingWallTextModelName() {
  return process.env.OPENAI_WALL_TEXT_MODEL?.trim() || DEFAULT_MODEL;
}

export async function generateBusinessTrendingWallTextIdeas(params: {
  business: WebsiteBusinessAnalysis;
  candidates: WallTextGenerationCandidate[];
}) {
  const candidates = normalizeWallTextGenerationCandidates(params.candidates);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OpenAI is not configured.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  const completion = await openaiClient.chat.completions.parse({
    model: getTrendingWallTextModelName(),
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content: [
          "You write readable Wall-of-text overlays for vertical short-form videos.",
          "This is not Carousel slide copy and not a short Hook-video opener.",
          "Write exactly one distinct idea for every supplied candidate.",
          "Each idea must have a concise headline, a fuller body, and a brief closing line.",
          "The three blocks must read as one coherent thought based only on the business profile.",
          "Keep the total copy within that candidate's maximum word count.",
          "Vary the angle across pain, insight, misconception, outcome, objection, and practical advice.",
          "Do not invent metrics, testimonials, guarantees, features, prices, or claims.",
          "Respect claimsToAvoid and return each supplied candidateIndex unchanged.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          businessProfile: params.business,
          candidates: candidates.map((candidate) => ({
            candidateIndex: candidate.candidateIndex,
            durationSeconds: candidate.durationSeconds,
            maximumWords: getWallTextMaximumWords(candidate.durationSeconds),
          })),
        }),
      },
    ],
    response_format: zodResponseFormat(
      WallTextIdeaOutputSchema,
      "trending_wall_text_ideas",
    ),
  });
  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new Error("The AI did not return Trending Wall-of-text ideas.");
  }

  return validateGeneratedWallTextIdeas({
    candidates,
    generated: WallTextIdeaOutputSchema.parse(parsed)
      .ideas as GeneratedWallTextIdea[],
  });
}
