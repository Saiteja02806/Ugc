import "server-only";

import { analyzeWebsiteBusiness, recoverMissingWebsiteFacts } from "./analyze-business";
import { scrapeWebsitePages } from "./firecrawl";
import { getMissingUrlBusinessContext, getStoreListingName, isGenericStoreBusinessName } from "./onboarding-quality";
import {
  getWebsiteAnalysisBySourceJobId,
  insertWebsiteAnalysis,
} from "./supabase";
import { buildImportantPageUrls, validateWebsiteUrl } from "./url";
import { parseStoreProductUrl } from "@/lib/business-profiles/store-product-metadata";

export async function analyzeWebsiteInput(websiteUrl: unknown) {
  const website = await validateWebsiteUrl(websiteUrl);
  const storeProduct = parseStoreProductUrl(website.url);
  const pages = await scrapeWebsitePages({
    homepageUrl: website.url,
    importantPageUrls: storeProduct ? [] : buildImportantPageUrls(website.origin),
  });
  const analyzed = await analyzeWebsiteBusiness({
    normalizedDomain: website.normalizedDomain,
    pages,
    websiteUrl: website.url,
  });
  const listingName = storeProduct ? getStoreListingName(pages[0], website.url) : null;
  let analysis = listingName && (!analyzed.businessName?.trim() || isGenericStoreBusinessName(analyzed.businessName, website.url))
    ? { ...analyzed, businessName: listingName }
    : analyzed;
  const missing = getMissingUrlBusinessContext(analysis, website.url);
  if (Object.values(missing).some(Boolean)) {
    try {
      analysis = await recoverMissingWebsiteFacts({
        analysis: {
          ...analysis,
          businessName: missing.businessName ? null : analysis.businessName,
          productSummary: missing.productSummary ? null : analysis.productSummary,
          targetAudience: missing.targetAudience ? [] : analysis.targetAudience,
        },
        pages,
        websiteUrl: website.url,
      });
    } catch {
      // The quality gate in onboarding handles a still-incomplete result.
    }
  }

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
