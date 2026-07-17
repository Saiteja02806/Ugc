import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

const DEFAULT_MODEL = "gpt-4o-mini";

const HookSuggestionOutputSchema = z
  .object({
    hooks: z
      .array(
        z.object({
          text: z.string().trim().min(8).max(180),
        }),
      )
      .min(4)
      .max(8),
  })
  .strict();

let openaiClient: OpenAI | null = null;

export async function generateBusinessHookSuggestions(params: {
  business: WebsiteBusinessAnalysis;
  demoTitle: string;
  influencerName: string;
}) {
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
          "You write concise opening hooks for short-form UGC product videos.",
          "Return exactly six distinct hooks grounded only in the supplied business profile.",
          "Each hook must be natural spoken language, one sentence, and readable in roughly 2-4 seconds.",
          "Vary the angle across pain, curiosity, outcome, objection, contrast, and direct address.",
          "Do not invent metrics, testimonials, guarantees, features, prices, or claims.",
          "Respect claimsToAvoid and do not mention the influencer by name.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          businessProfile: params.business,
          productDemoTitle: params.demoTitle,
          selectedInfluencer: params.influencerName,
        }),
      },
    ],
    response_format: zodResponseFormat(
      HookSuggestionOutputSchema,
      "hook_video_suggestions",
    ),
  });
  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new Error("The AI did not return hook suggestions.");
  }

  const uniqueHooks = Array.from(
    new Set(
      HookSuggestionOutputSchema.parse(parsed).hooks.map((hook) =>
        hook.text.trim(),
      ),
    ),
  );

  if (uniqueHooks.length < 4) {
    throw new Error("The AI did not return enough distinct hook suggestions.");
  }

  return uniqueHooks.slice(0, 8);
}
