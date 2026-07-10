import { NextResponse } from "next/server";

import { parseAiIdeBusinessContext } from "@/lib/business-profiles/ai-context";
import {
  getBusinessProfileForUser,
  getMissingBusinessProfileEnvVars,
  saveBusinessProfile,
  updateBusinessProfilePreparation,
} from "@/lib/business-profiles/db";
import {
  BusinessProfileIntakeTypeSchema,
  ManualBusinessProfileSchema,
  buildManualBusinessAnalysis,
} from "@/lib/business-profiles/schema";
import { prepareBusinessProfileCarousels } from "@/lib/carousel/prepare-business-profile";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { analyzeWebsiteBusiness } from "@/lib/website-analysis/analyze-business";
import { WebsiteAnalysisError } from "@/lib/website-analysis/errors";
import { scrapeWebsitePages } from "@/lib/website-analysis/firecrawl";
import {
  getMissingWebsiteAnalysisEnvVars,
  insertWebsiteAnalysis,
} from "@/lib/website-analysis/supabase";
import { buildImportantPageUrls, validateWebsiteUrl } from "@/lib/website-analysis/url";

export const runtime = "nodejs";

type BusinessProfileBody = {
  aiIdeContext?: unknown;
  intakeType?: unknown;
  manual?: unknown;
  websiteUrl?: unknown;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function getUserId(request: Request) {
  try {
    return (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) throw error;
    throw new FirebaseAuthRequestError("Could not verify your sign-in session.", 500);
  }
}

export async function GET(request: Request) {
  try {
    const profile = await getBusinessProfileForUser(await getUserId(request));
    return json({ ok: true, profile: profile ? toClientProfile(profile) : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load your business profile.";
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return json({ ok: false, message }, status);
  }
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await getUserId(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify your sign-in session.";
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return json({ ok: false, message }, status);
  }

  const missingStorage = getMissingBusinessProfileEnvVars();
  if (missingStorage.length) {
    return json({ ok: false, message: `Business profile is not configured. Add ${missingStorage.join(", ")}.` }, 501);
  }

  let body: BusinessProfileBody;
  try {
    body = (await request.json()) as BusinessProfileBody;
  } catch {
    return json({ ok: false, message: "Send business profile details as JSON." }, 400);
  }

  const intakeType = BusinessProfileIntakeTypeSchema.safeParse(body.intakeType);
  if (!intakeType.success) {
    return json({ ok: false, message: "Choose website, mobile app AI prompt, or manual intake." }, 400);
  }

  try {
    const normalized = await normalizeProfileInput({ body, intakeType: intakeType.data, userId });
    const analysisId = await insertWebsiteAnalysis({
      analysis: normalized.analysis,
      normalizedDomain: normalized.normalizedDomain,
      projectId: "default-project",
      sourceContext: normalized.sourceContext,
      sourceType: intakeType.data,
      userId,
      websiteUrl: normalized.websiteUrl,
    });
    const saved = await saveBusinessProfile({
      analysis: normalized.analysis,
      analysisId,
      intakeType: intakeType.data,
      sourceContext: normalized.sourceContext,
      sourceUrl: normalized.websiteUrl,
      userId,
    });

    try {
      const preparation = await prepareBusinessProfileCarousels(saved.profile);
      return json({ ok: true, profile: toClientProfile(saved.profile), preparation });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start carousel preparation.";
      await updateBusinessProfilePreparation({
        error: message,
        profileId: saved.profile.id,
        status: "failed",
      });
      return json({ ok: false, message }, 502);
    }
  } catch (error) {
    const message = error instanceof WebsiteAnalysisError || error instanceof Error
      ? error.message
      : "Could not save your business profile.";
    const status = error instanceof WebsiteAnalysisError ? error.status : 400;
    return json({ ok: false, message }, status);
  }
}

async function normalizeProfileInput(params: {
  body: BusinessProfileBody;
  intakeType: "manual" | "mobile_app_ai_prompt" | "website";
  userId: string;
}) {
  if (params.intakeType === "website") {
    const missing = getMissingWebsiteAnalysisEnvVars();
    if (missing.length) throw new WebsiteAnalysisError(`Website intake is not configured. Add ${missing.join(", ")}.`, 501);
    const website = await validateWebsiteUrl(params.body.websiteUrl);
    const pages = await scrapeWebsitePages({
      homepageUrl: website.url,
      importantPageUrls: buildImportantPageUrls(website.origin),
    });
    return {
      analysis: await analyzeWebsiteBusiness({ normalizedDomain: website.normalizedDomain, pages, websiteUrl: website.url }),
      normalizedDomain: website.normalizedDomain,
      sourceContext: null,
      websiteUrl: website.url,
    };
  }

  if (params.intakeType === "mobile_app_ai_prompt") {
    const rawContext = typeof params.body.aiIdeContext === "string" ? params.body.aiIdeContext.trim() : "";
    return {
      analysis: await parseAiIdeBusinessContext(rawContext),
      normalizedDomain: null,
      sourceContext: rawContext,
      websiteUrl: null,
    };
  }

  const manual = ManualBusinessProfileSchema.parse(params.body.manual);
  return {
    analysis: buildManualBusinessAnalysis(manual),
    normalizedDomain: null,
    sourceContext: null,
    websiteUrl: null,
  };
}

function toClientProfile(profile: Awaited<ReturnType<typeof getBusinessProfileForUser>> extends infer T ? Exclude<T, null> : never) {
  return {
    id: profile.id,
    intakeType: profile.intakeType,
    preparationError: profile.preparationError,
    preparationStatus: profile.preparationStatus,
    profileVersion: profile.profileVersion,
  };
}
