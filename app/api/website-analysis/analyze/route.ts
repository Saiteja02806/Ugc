import { NextResponse } from "next/server";

import { analyzeWebsiteBusiness } from "@/lib/website-analysis/analyze-business";
import { WebsiteAnalysisError } from "@/lib/website-analysis/errors";
import { scrapeWebsitePages } from "@/lib/website-analysis/firecrawl";
import {
  getMissingWebsiteAnalysisEnvVars,
  insertWebsiteAnalysis,
} from "@/lib/website-analysis/supabase";
import {
  buildImportantPageUrls,
  validateWebsiteUrl,
} from "@/lib/website-analysis/url";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

const DEFAULT_PROJECT_ID = "test-project-001";

type AnalyzeWebsiteBody = {
  projectId?: unknown;
  websiteUrl?: unknown;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as AnalyzeWebsiteBody;
  } catch {
    return null;
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    { status },
  );
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return errorResponse(
        error.status === 401 ? "Sign in before analyzing a website." : error.message,
        error.status,
      );
    }

    console.error("Failed to verify website analysis requester:", error);
    return errorResponse("Could not verify your sign-in session.", 500);
  }

  const missingEnvVars = getMissingWebsiteAnalysisEnvVars();

  if (missingEnvVars.length > 0) {
    return errorResponse(
      `Website analysis is not configured. Add ${missingEnvVars.join(
        ", ",
      )} in server environment variables.`,
      501,
    );
  }

  const body = await readBody(request);

  if (!body) {
    return errorResponse("Send website analysis details as JSON.", 400);
  }

  const projectId = getString(body.projectId) || DEFAULT_PROJECT_ID;

  try {
    const website = await validateWebsiteUrl(body.websiteUrl);
    const importantPageUrls = buildImportantPageUrls(website.origin);
    const pages = await scrapeWebsitePages({
      homepageUrl: website.url,
      importantPageUrls,
    });
    const analysis = await analyzeWebsiteBusiness({
      normalizedDomain: website.normalizedDomain,
      pages,
      websiteUrl: website.url,
    });
    const analysisId = await insertWebsiteAnalysis({
      analysis,
      normalizedDomain: website.normalizedDomain,
      projectId,
      userId,
      websiteUrl: website.url,
    });

    return NextResponse.json({
      ok: true,
      analysisId,
      normalizedDomain: website.normalizedDomain,
      analysis,
    });
  } catch (error) {
    if (error instanceof WebsiteAnalysisError) {
      return errorResponse(error.message, error.status);
    }

    console.error("Website analysis failed:", error);
    return errorResponse("Could not analyze the website right now.", 500);
  }
}
