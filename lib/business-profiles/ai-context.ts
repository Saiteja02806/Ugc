import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import {
  WebsiteBusinessAnalysisSchema,
  type WebsiteBusinessAnalysis,
} from "@/lib/website-analysis/schema";
import { getBusinessContextModelRequest } from "./model";

const MAX_AI_IDE_CONTEXT_CHARS = 24_000;

let openaiClient: OpenAI | null = null;

export async function parseAiIdeBusinessContext(rawContext: string) {
  const context = rawContext.trim().slice(0, MAX_AI_IDE_CONTEXT_CHARS);

  if (!context) {
    throw new Error("Paste the app context from your AI IDE first.");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OpenAI is not configured.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  const completion = await openaiClient.chat.completions.parse({
    ...getBusinessContextModelRequest(),
    messages: [
      {
        role: "system",
        content:
          "Extract a compact, evidence-based business analysis for carousel generation from the provided mobile app context. Do not invent features, claims, users, or metrics. Return null or empty lists when the context does not support a field.",
      },
      {
        role: "user",
        content: [
          "The following was produced by the business owner's AI IDE.",
          "Convert it into the required business-analysis schema.",
          "Create carousel-friendly context with reader-first hook possibilities, recognizable reader problems, and only evidence-backed product capabilities. Do not prescribe a fixed narrative or invent proof.",
          "Set wallTextPrimaryReader to the most relevant supported user category for Wall-of-Text content. Set wallTextSecondaryReader only when a distinct second supported user category exists; otherwise use null. Do not invent personas, demographics, or workflows.",
          "Classify the business model and up to three category or product-type labels only when supported. Leave campaignPurposes empty because campaign goals come directly from the owner.",
          "Keep fields concise and use visual queries suitable for object-only stock imagery.",
          "",
          context,
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      WebsiteBusinessAnalysisSchema,
      "app_business_analysis",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new Error("Could not structure the app context.");
  }

  return WebsiteBusinessAnalysisSchema.parse(parsed) satisfies WebsiteBusinessAnalysis;
}

export const AI_IDE_BUSINESS_CONTEXT_PROMPT = `Analyze this mobile app codebase and return a concise business-context report for marketing creative generation. Do not include source code, secrets, or implementation details. Use the following headings:\n\n- App name\n- Business model (B2B, B2C, both, or unknown)\n- App category and product type\n- One-sentence product summary\n- Target users\n- Primary Wall-of-Text reader category\n- Optional secondary Wall-of-Text reader category\n- Main user problem\n- Core features\n- Key benefits\n- Differentiators\n- Brand tone\n- Claims to avoid\n- Suggested visual keywords\n\nOnly state facts supported by the codebase and product copy. Keep every item short. The Wall-of-Text reader categories must be supported by the target users; do not invent personas, demographics, or workflows.`;
