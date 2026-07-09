import "server-only";

import { WebsiteAnalysisError } from "@/lib/website-analysis/errors";

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const REQUEST_TIMEOUT_MS = 35_000;
const MAX_PAGES = 4;

type FirecrawlScrapeResponse = {
  data?: {
    markdown?: unknown;
    metadata?: {
      title?: unknown;
    };
  };
  markdown?: unknown;
  metadata?: {
    title?: unknown;
  };
  success?: boolean;
};

export type ScrapedWebsitePage = {
  markdown: string;
  title: string | null;
  url: string;
};

function getFirecrawlApiKey() {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();

  if (!apiKey) {
    throw new WebsiteAnalysisError("Firecrawl is not configured.", 501);
  }

  return apiKey;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function scrapeSinglePage(url: string): Promise<ScrapedWebsitePage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getFirecrawlApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        formats: ["markdown"],
        onlyMainContent: true,
        url,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const responseText = await response.text();
    let payload: FirecrawlScrapeResponse | null = null;

    try {
      payload = JSON.parse(responseText) as FirecrawlScrapeResponse;
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.success === false) {
      throw new WebsiteAnalysisError("Could not scrape that website.", 502);
    }

    const markdown = getString(payload?.data?.markdown ?? payload?.markdown);
    const title = getString(payload?.data?.metadata?.title ?? payload?.metadata?.title);

    if (!markdown) {
      throw new WebsiteAnalysisError("The website did not return readable text.", 422);
    }

    return {
      markdown,
      title: title || null,
      url,
    };
  } catch (error) {
    if (error instanceof WebsiteAnalysisError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new WebsiteAnalysisError("Website scraping timed out.", 504);
    }

    throw new WebsiteAnalysisError("Could not scrape that website.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function scrapeWebsitePages({
  homepageUrl,
  importantPageUrls,
}: {
  homepageUrl: string;
  importantPageUrls: string[];
}) {
  const urls = [homepageUrl, ...importantPageUrls].slice(0, MAX_PAGES);
  const [homepage, ...extraUrls] = urls;
  const pages: ScrapedWebsitePage[] = [await scrapeSinglePage(homepage)];

  for (const url of extraUrls) {
    try {
      pages.push(await scrapeSinglePage(url));
    } catch {
      // Extra pages are opportunistic context; the homepage is the required source.
    }
  }

  return pages;
}
