import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import { WebsiteAnalysisError } from "@/lib/website-analysis/errors";
import type { ScrapedWebsitePage } from "@/lib/website-analysis/firecrawl";
import {
  WebsiteBusinessAnalysisSchema,
  type WebsiteBusinessAnalysis,
} from "@/lib/website-analysis/schema";

const MAX_PAGE_CHARS = 7_000;
const MAX_TOTAL_CHARS = 24_000;
const MAX_DESCRIPTION_CHARS = 4_000;
const DEFAULT_MODEL = "gpt-4o-mini";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new WebsiteAnalysisError("OpenAI is not configured.", 501);
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

function cleanMarkdown(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildContentDigest(pages: ScrapedWebsitePage[]) {
  let remainingChars = MAX_TOTAL_CHARS;
  const sections: string[] = [];

  for (const page of pages) {
    if (remainingChars <= 0) {
      break;
    }

    const cleaned = cleanMarkdown(page.markdown).slice(
      0,
      Math.min(MAX_PAGE_CHARS, remainingChars),
    );

    if (!cleaned) {
      continue;
    }

    sections.push(
      [
        `URL: ${page.url}`,
        page.title ? `Title: ${page.title}` : null,
        "Content:",
        cleaned,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    remainingChars -= cleaned.length;
  }

  return sections.join("\n\n---\n\n");
}

export async function analyzeWebsiteBusiness({
  normalizedDomain,
  pages,
  websiteUrl,
}: {
  normalizedDomain: string;
  pages: ScrapedWebsitePage[];
  websiteUrl: string;
}): Promise<WebsiteBusinessAnalysis> {
  const contentDigest = buildContentDigest(pages);

  if (!contentDigest) {
    throw new WebsiteAnalysisError("The website did not return readable text.", 422);
  }

  const completion = await getOpenAIClient().chat.completions.parse({
    model: process.env.OPENAI_WEBSITE_ANALYSIS_MODEL ?? DEFAULT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You analyze websites for UGC ad image and carousel generation. Return only compact, actionable facts for creative generation. Do not invent claims. Use null or empty arrays when the website does not provide enough evidence. For carousel guidance, think like a performance creative strategist: define a real slide-by-slide story, not generic marketing blurbs.",
      },
      {
        role: "user",
        content: [
          `Website URL: ${websiteUrl}`,
          `Normalized domain: ${normalizedDomain}`,
          "",
          "Extract a lean business analysis. Keep every string short. Prefer concrete product, audience, pain, promise, visual, and carousel guidance over general business research.",
          "",
          "Rules:",
          "- No raw website markdown or HTML in the response.",
          "- No competitor analysis.",
          "- No long paragraphs.",
          "- Build carousel guidance around a clear 5-slide narrative: hook, problem, solution, benefit or proof, CTA.",
          "- carouselAngles should be distinct hook-ready concepts, not repeated value props.",
          "- recommendedCarouselStructure should include compact role notes such as Hook: ..., Problem: ..., Solution: ..., Benefit: ..., CTA: ...",
          "- valueProps, painPoints, and differentiators must be specific enough to become slide copy.",
          "- businessModel must be b2b, b2c, or both only when the website supports that classification; otherwise use null.",
          "- categories should contain up to three evidence-based industry, subcategory, or product-type labels, with the primary category first.",
          "- campaignPurposes must stay empty because a website cannot prove the owner's current campaign objective.",
          "- ctaIdeas should be short action phrases, not full sentences.",
          "- Pexels image queries should be short search phrases for stock-style product/lifestyle visuals.",
          "- Claims to avoid should identify risky or unsupported promises.",
          "- Confidence should reflect how much useful website evidence was available.",
          "- Avoid filler phrases unless the website grounds them: boost productivity, improve workflow, streamline business, unlock efficiency, take it to the next level.",
          "",
          "Website content:",
          contentDigest,
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      WebsiteBusinessAnalysisSchema,
      "website_business_analysis",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new WebsiteAnalysisError("Could not structure the website analysis.", 502);
  }

  return WebsiteBusinessAnalysisSchema.parse(parsed);
}

export async function analyzeBusinessDescription(
  rawDescription: string,
): Promise<WebsiteBusinessAnalysis> {
  const description = rawDescription.trim().slice(0, MAX_DESCRIPTION_CHARS);

  if (description.length < 20) {
    throw new WebsiteAnalysisError(
      "Describe what the business offers using at least one factual sentence.",
      422,
    );
  }

  const completion = await getOpenAIClient().chat.completions.parse({
    model: process.env.OPENAI_WEBSITE_ANALYSIS_MODEL ?? DEFAULT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You turn a business owner's description into compact context for marketing creative. Use only facts explicitly supported by the description. Never invent a feature, audience, result, metric, testimonial, guarantee, or business name. Use null or an empty array for anything unsupported.",
      },
      {
        role: "user",
        content: [
          "Analyze the description below for UGC hook and carousel generation.",
          "Keep every field concise and source-grounded.",
          "Business model and category labels may be inferred only when the description clearly supports them.",
          "campaignPurposes must be an empty array because the owner did not choose a campaign goal.",
          "Claims to avoid should identify risky promises that the description does not verify.",
          "If the business name is not explicitly written, return null; the owner will enter it next.",
          "Create creative angles only from the described product, audience, pain, and benefit.",
          "Do not convert a vague marketing phrase into a factual product claim.",
          "",
          "Business description:",
          description,
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      WebsiteBusinessAnalysisSchema,
      "business_description_analysis",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new WebsiteAnalysisError(
      "Could not structure the business description.",
      502,
    );
  }

  return WebsiteBusinessAnalysisSchema.parse(parsed);
}
