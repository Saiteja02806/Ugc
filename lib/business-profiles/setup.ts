import "server-only";

import { z } from "zod";

import { parseAiIdeBusinessContext } from "./ai-context";
import {
  saveBusinessProfile,
  updateBusinessProfilePreparation,
} from "./db";
import {
  ManualBusinessProfileSchema,
  buildManualBusinessAnalysis,
} from "./schema";
import { prepareBusinessProfileCarousels } from "@/lib/carousel/prepare-business-profile";
import { analyzeWebsiteInput } from "@/lib/website-analysis/process";
import {
  getWebsiteAnalysisBySourceJobId,
  insertWebsiteAnalysis,
} from "@/lib/website-analysis/supabase";

const websiteSetupSchema = z.object({
  intakeType: z.literal("website"),
  websiteUrl: z.string().trim().min(1).max(2_048),
});

const mobileAppSetupSchema = z.object({
  aiIdeContext: z.string().trim().min(1).max(24_000),
  intakeType: z.literal("mobile_app_ai_prompt"),
});

const manualSetupSchema = z.object({
  intakeType: z.literal("manual"),
  manual: ManualBusinessProfileSchema,
});

export const BusinessProfileSetupInputSchema = z.discriminatedUnion(
  "intakeType",
  [websiteSetupSchema, mobileAppSetupSchema, manualSetupSchema],
);

export type BusinessProfileSetupInput = z.infer<
  typeof BusinessProfileSetupInputSchema
>;

export async function processBusinessProfileSetupJob(params: {
  input: BusinessProfileSetupInput;
  jobId: string;
  userId: string;
}) {
  const normalized = await getOrCreateAnalysis(params);
  const saved = await saveBusinessProfile({
    analysis: normalized.analysis,
    analysisId: normalized.analysisId,
    intakeType: params.input.intakeType,
    sourceContext: normalized.sourceContext,
    sourceUrl: normalized.websiteUrl,
    userId: params.userId,
  });

  try {
    const preparation = await prepareBusinessProfileCarousels(saved.profile);

    return {
      generationBatchId: preparation.generationBatchId,
      operation: "business_profile_setup" as const,
      profileId: saved.profile.id,
      profileVersion: saved.profile.profileVersion,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not start carousel preparation.";

    await updateBusinessProfilePreparation({
      error: message,
      profileId: saved.profile.id,
      status: "failed",
    });
    throw error;
  }
}

async function getOrCreateAnalysis(params: {
  input: BusinessProfileSetupInput;
  jobId: string;
  userId: string;
}) {
  const existing = await getWebsiteAnalysisBySourceJobId({
    sourceJobId: params.jobId,
    userId: params.userId,
  });

  if (existing) {
    return {
      analysis: existing.analysis,
      analysisId: existing.id,
      sourceContext: existing.sourceContext,
      websiteUrl: existing.websiteUrl,
    };
  }

  const normalized = await normalizeProfileInput(params.input);
  const analysisId = await insertWebsiteAnalysis({
    analysis: normalized.analysis,
    normalizedDomain: normalized.normalizedDomain,
    projectId: "default-project",
    sourceContext: normalized.sourceContext,
    sourceJobId: params.jobId,
    sourceType: params.input.intakeType,
    userId: params.userId,
    websiteUrl: normalized.websiteUrl,
  });

  return { ...normalized, analysisId };
}

async function normalizeProfileInput(input: BusinessProfileSetupInput) {
  if (input.intakeType === "website") {
    const result = await analyzeWebsiteInput(input.websiteUrl);

    return {
      analysis: result.analysis,
      normalizedDomain: result.normalizedDomain,
      sourceContext: null,
      websiteUrl: result.websiteUrl,
    };
  }

  if (input.intakeType === "mobile_app_ai_prompt") {
    return {
      analysis: await parseAiIdeBusinessContext(input.aiIdeContext),
      normalizedDomain: null,
      sourceContext: input.aiIdeContext,
      websiteUrl: null,
    };
  }

  return {
    analysis: buildManualBusinessAnalysis(input.manual),
    normalizedDomain: null,
    sourceContext: null,
    websiteUrl: null,
  };
}
