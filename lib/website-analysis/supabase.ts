import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { WebsiteAnalysisError } from "@/lib/website-analysis/errors";
import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

const WEBSITE_ANALYSES_TABLE = "website_analyses";

type WebsiteAnalysisDatabase = {
  public: {
    Tables: {
      website_analyses: {
        Row: {
          id: string;
        };
        Insert: WebsiteAnalysisInsert;
        Update: Partial<WebsiteAnalysisInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

type WebsiteAnalysisInsert = {
  analysis_json: WebsiteBusinessAnalysis;
  brand_tone: string | null;
  business_name: string | null;
  carousel_angles: string[];
  category: string | null;
  claims_to_avoid: string[];
  confidence: WebsiteBusinessAnalysis["confidence"];
  confidence_reason: string | null;
  cta_ideas: string[];
  differentiators: string[];
  main_problem: string | null;
  main_promise: string | null;
  missing_info: string[];
  normalized_domain: string | null;
  pain_points: string[];
  pexels_image_queries: string[];
  product_summary: string | null;
  project_id: string;
  recommended_carousel_structure: string[];
  source_context?: string | null;
  source_type?: "manual" | "mobile_app_ai_prompt" | "website";
  target_audience: string[];
  user_id: string;
  value_props: string[];
  visual_keywords: string[];
  website_url: string | null;
};

type InsertWebsiteAnalysisInput = {
  analysis: WebsiteBusinessAnalysis;
  normalizedDomain?: string | null;
  projectId: string;
  sourceContext?: string | null;
  sourceType?: "manual" | "mobile_app_ai_prompt" | "website";
  userId: string;
  websiteUrl?: string | null;
};

let supabaseServerClient: SupabaseClient<WebsiteAnalysisDatabase> | null = null;

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    ""
  );
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

export function getMissingWebsiteAnalysisEnvVars() {
  const missing: string[] = [];

  if (!process.env.FIRECRAWL_API_KEY?.trim()) {
    missing.push("FIRECRAWL_API_KEY");
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    missing.push("OPENAI_API_KEY");
  }

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

function getSupabaseServerClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new WebsiteAnalysisError("Website analysis storage is not configured.", 501);
  }

  if (!supabaseServerClient) {
    supabaseServerClient = createClient<WebsiteAnalysisDatabase>(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return supabaseServerClient;
}

export async function insertWebsiteAnalysis({
  analysis,
  normalizedDomain,
  projectId,
  sourceContext,
  sourceType = "website",
  userId,
  websiteUrl,
}: InsertWebsiteAnalysisInput) {
  const { data, error } = await getSupabaseServerClient()
    .from(WEBSITE_ANALYSES_TABLE)
    .insert({
      analysis_json: analysis,
      brand_tone: analysis.brandTone,
      business_name: analysis.businessName,
      carousel_angles: analysis.carouselAngles,
      category: analysis.category,
      claims_to_avoid: analysis.claimsToAvoid,
      confidence: analysis.confidence,
      confidence_reason: analysis.confidenceReason,
      cta_ideas: analysis.ctaIdeas,
      differentiators: analysis.differentiators,
      main_problem: analysis.mainProblem,
      main_promise: analysis.mainPromise,
      missing_info: analysis.missingInfo,
      normalized_domain: normalizedDomain ?? null,
      pain_points: analysis.painPoints,
      pexels_image_queries: analysis.pexelsImageQueries,
      product_summary: analysis.productSummary,
      project_id: projectId,
      recommended_carousel_structure: analysis.recommendedCarouselStructure,
      source_context: sourceContext?.slice(0, 24_000) ?? null,
      source_type: sourceType,
      target_audience: analysis.targetAudience,
      user_id: userId,
      value_props: analysis.valueProps,
      visual_keywords: analysis.visualKeywords,
      website_url: websiteUrl ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to store website analysis:", error);
    throw new WebsiteAnalysisError("Could not store the website analysis.", 500);
  }

  if (!data?.id || typeof data.id !== "string") {
    throw new WebsiteAnalysisError("Website analysis storage returned no ID.", 500);
  }

  return data.id;
}
