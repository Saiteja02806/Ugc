import "server-only";

import { analyzeWebsiteBusiness } from "./analyze-business";
import { scrapeWebsitePages } from "./firecrawl";
import {
  getWebsiteAnalysisBySourceJobId,
  insertWebsiteAnalysis,
} from "./supabase";
import { buildImportantPageUrls, validateWebsiteUrl } from "./url";

export async function analyzeWebsiteInput(websiteUrl: unknown) {
  const website = await validateWebsiteUrl(websiteUrl);
  const pages = await scrapeWebsitePages({
    homepageUrl: website.url,
    importantPageUrls: buildImportantPageUrls(website.origin),
  });
  const analysis = await analyzeWebsiteBusiness({
    normalizedDomain: website.normalizedDomain,
    pages,
    websiteUrl: website.url,
  });

  return {
    analysis,
    normalizedDomain: website.normalizedDomain,
    websiteUrl: website.url,
  };
}

export async function processWebsiteAnalysisJob(params: {
  jobId: string;
  projectId: string;
  userId: string;
  websiteUrl: unknown;
}) {
  const existing = await getWebsiteAnalysisBySourceJobId({
    sourceJobId: params.jobId,
    userId: params.userId,
  });

  if (existing) {
    return {
      analysisId: existing.id,
      normalizedDomain: existing.normalizedDomain,
    };
  }

  const result = await analyzeWebsiteInput(params.websiteUrl);
  const analysisId = await insertWebsiteAnalysis({
    analysis: result.analysis,
    normalizedDomain: result.normalizedDomain,
    projectId: params.projectId,
    sourceJobId: params.jobId,
    userId: params.userId,
    websiteUrl: result.websiteUrl,
  });

  return {
    analysisId,
    normalizedDomain: result.normalizedDomain,
  };
}
