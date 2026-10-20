import type { WebsiteBusinessAnalysis } from "./schema";
import type { ScrapedWebsitePage } from "./firecrawl";
import { WebsiteAnalysisError } from "./errors";

type RequiredBusinessContext = Pick<
  WebsiteBusinessAnalysis,
  "businessName" | "confidence" | "productSummary" | "targetAudience"
>;

const STORE_HOSTS = new Set(["apps.apple.com", "itunes.apple.com", "play.google.com"]);

export function getStoreListingName(page: ScrapedWebsitePage, sourceUrl: string) {
  const hostname = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
  if (!STORE_HOSTS.has(hostname)) return null;

  const titles = [page.title, page.markdown.match(/^#\s+(.+)$/m)?.[1]];
  for (const title of titles) {
    if (!title?.trim()) continue;
    const name = hostname === "play.google.com"
      ? title.replace(/\s+-\s+Apps on Google Play$/i, "")
      : title.replace(/^‎/, "").replace(/\s+App\s+-\s+App Store$/i, "").replace(/\s+-\s+App Store$/i, "");
    const normalized = name.trim();
    if (normalized && !/^(app store|google play|apps on google play)$/i.test(normalized)) {
      return normalized;
    }
  }
  return null;
}

export function isGenericStoreBusinessName(name: string | null | undefined, sourceUrl: string) {
  const hostname = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
  if (!STORE_HOSTS.has(hostname)) return false;
  const normalized = name?.trim().toLowerCase() ?? "";
  return normalized === hostname || /^(app store|google play|apps on google play)$/.test(normalized);
}

export function getMissingUrlBusinessContext(analysis: RequiredBusinessContext, sourceUrl: string) {
  const name = analysis.businessName?.trim() ?? "";
  const hostname = new URL(sourceUrl).hostname.toLowerCase();
  const normalizedHost = hostname.replace(/^www\./, "");
  return {
    businessName: !name || name.toLowerCase() === hostname || name.toLowerCase() === normalizedHost || isGenericStoreBusinessName(name, sourceUrl),
    productSummary: (analysis.productSummary?.trim().length ?? 0) < 20,
    targetAudience: !analysis.targetAudience.some((item) => item.trim().length > 0),
  };
}

export function hasRequiredUrlBusinessContext(analysis: RequiredBusinessContext, sourceUrl: string) {
  return !Object.values(getMissingUrlBusinessContext(analysis, sourceUrl)).some(Boolean);
}

export function requireUrlBusinessContext(analysis: RequiredBusinessContext, sourceUrl: string) {
  if (!hasRequiredUrlBusinessContext(analysis, sourceUrl)) {
    throw new WebsiteAnalysisError(
      "Unable to analyze that URL. Try entering your product details manually.",
      422,
    );
  }
}
