import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";
import {
  getTrendingHookMaximumWords,
  normalizeTrendingHookCandidates,
  validateGeneratedTrendingHookTexts,
  type GeneratedTrendingHookText,
  type TrendingHookTextCandidate,
} from "@/lib/trending/trending-hook-text-logic";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_HOOK_IDEA_COUNT = 12;

const TrendingHookIdeaOutputSchema = z
  .object({
    hooks: z
      .array(
        z
          .object({
            candidateIndex: z.number().int().min(0),
            text: z.string().trim().min(4).max(180),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_HOOK_IDEA_COUNT),
  })
  .strict();

let openaiClient: OpenAI | null = null;

export async function generateBusinessTrendingHookTexts(params: {
  business: WebsiteBusinessAnalysis;
  candidates: TrendingHookTextCandidate[];
}): Promise<GeneratedTrendingHookText[]> {
  const candidates = normalizeTrendingHookCandidates(params.candidates);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OpenAI is not configured.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  const completion = await openaiClient.chat.completions.parse({
    model: process.env.OPENAI_HOOK_SUGGESTION_MODEL ?? DEFAULT_MODEL,
    temperature: 0.65,
    messages: [
      {
        role: "system",
        content: [
          "You write on-screen opening hooks for short-form UGC videos.",
          "Write exactly one distinct hook for every supplied candidate.",
          "The hook is shown before a product demo is selected, so use only the business profile.",
          "Keep each hook readable within that candidate's duration and maximum word count.",
          "Vary the angle across pain, curiosity, outcome, objection, contrast, and direct address.",
          "Do not invent metrics, testimonials, guarantees, features, prices, or claims.",
          "Respect claimsToAvoid. Return the supplied candidateIndex unchanged.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          businessProfile: params.business,
          candidates: candidates.map((candidate) => ({
            candidateIndex: candidate.candidateIndex,
            durationSeconds: candidate.durationSeconds,
            maximumWords: getTrendingHookMaximumWords(
              candidate.durationSeconds,
            ),
          })),
        }),
      },
    ],
    response_format: zodResponseFormat(
      TrendingHookIdeaOutputSchema,
      "trending_hook_ideas",
    ),
  });
  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new Error("The AI did not return Trending Hook ideas.");
  }

  return validateGeneratedTrendingHookTexts({
    candidates,
    generated: TrendingHookIdeaOutputSchema.parse(parsed).hooks,
  });
}
