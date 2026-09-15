import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applyBusinessContextDraft,
  getBusinessProfileForUser,
  saveBusinessContextDraft,
  type BusinessProfileRecord,
} from "@/lib/business-profiles/db";
import { prepareBusinessContextCandidate } from "@/lib/business-profiles/business-context-candidate";
import { applyPrimaryGoals } from "@/lib/business-profiles/schema";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { analyzeBusinessDescription } from "@/lib/website-analysis/analyze-business";
import { WebsiteBusinessAnalysisSchema } from "@/lib/website-analysis/schema";

export const runtime = "nodejs";

const expectedVersionSchema = z.number().int().min(1);
// This is an opaque revision token returned by Postgres. Do not reformat it in
// the browser: its exact value is compared in the promotion/save update.
const draftRevisionSchema = z.string().trim().min(1).max(100);
const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_draft"),
    context: WebsiteBusinessAnalysisSchema,
    expectedDraftUpdatedAt: draftRevisionSchema.nullable(),
    expectedProfileVersion: expectedVersionSchema,
    source: z.string().trim().max(4_000).nullable().optional(),
  }).strict(),
  z.object({
    action: z.literal("reanalyze"),
    expectedDraftUpdatedAt: draftRevisionSchema.nullable(),
    expectedProfileVersion: expectedVersionSchema,
    source: z.string().trim().min(20).max(4_000),
  }).strict(),
  z.object({
    action: z.literal("apply"),
    expectedDraftUpdatedAt: draftRevisionSchema,
    expectedProfileVersion: expectedVersionSchema,
  }).strict(),
]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function GET(request: Request) {
  try {
    const profile = await getBusinessProfileForUser((await requireFirebaseUser(request)).uid);
    return json({ ok: true, profile: profile ? toClientContext(profile) : null });
  } catch (error) {
    return errorResponse(error, "Could not load Business Context.");
  }
}

export async function POST(request: Request) {
  try {
    const userId = (await requireFirebaseUser(request)).uid;
    const body = requestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return json({ ok: false, message: "Send a valid Business Context action." }, 400);

    const profile = await getBusinessProfileForUser(userId);
    if (!profile) return json({ ok: false, message: "Complete Business Context before editing it." }, 404);
    if (profile.profileVersion !== body.data.expectedProfileVersion) {
      return json({ ok: false, message: "Business Context changed in another tab. Reload before saving." }, 409);
    }

    if (body.data.action === "save_draft") {
      const context = applyPrimaryGoals(body.data.context, profile.primaryGoals);
      const saved = await saveBusinessContextDraft({
        context,
        expectedDraftUpdatedAt: body.data.expectedDraftUpdatedAt,
        profile,
        source: body.data.source,
      });
      return json({ ok: true, profile: toClientContext(saved) });
    }

    if (body.data.action === "reanalyze") {
      const analyzed = await analyzeBusinessDescription(body.data.source);
      const context = applyPrimaryGoals(
        WebsiteBusinessAnalysisSchema.parse({
          ...analyzed,
          businessName: analyzed.businessName ?? profile.context.businessName,
        }),
        profile.primaryGoals,
      );
      const saved = await saveBusinessContextDraft({
        context,
        expectedDraftUpdatedAt: body.data.expectedDraftUpdatedAt,
        profile,
        source: body.data.source,
      });
      return json({ ok: true, profile: toClientContext(saved) });
    }

    const applied = await applyBusinessContextDraft({
      expectedDraftUpdatedAt: body.data.expectedDraftUpdatedAt,
      expectedProfileVersion: body.data.expectedProfileVersion,
      profile,
    });
    return json({
      ok: true,
      profile: toClientContext(applied),
      refreshScope: "Your new context is active for the next local Trending day. Today's existing pack remains pinned to its previous context version.",
    });
  } catch (error) {
    if (error instanceof Error && [
      "business_context_draft_conflict",
      "business_context_draft_stale",
      "business_context_profile_conflict",
    ].includes(error.message)) {
      return json({ ok: false, message: "Your draft is stale because Business Context changed. Reload and review it again." }, 409);
    }
    if (error instanceof Error && error.message === "business_context_draft_needs_facts") {
      return json({ ok: false, message: "Add at least one factual capability, pain, audience, outcome, or differentiator before applying this context." }, 422);
    }
    return errorResponse(error, "Could not update Business Context.");
  }
}

function toClientContext(profile: BusinessProfileRecord) {
  const candidate = profile.businessContextDraftContext
    ? prepareBusinessContextCandidate(profile.businessContextDraftContext)
    : null;

  return {
    activeContext: profile.context,
    activeProfileVersion: profile.profileVersion,
    draft: profile.businessContextDraftContext
      ? {
          baseProfileVersion: profile.businessContextDraftBaseVersion,
          context: profile.businessContextDraftContext,
          factCount: candidate?.factCount ?? 0,
          readiness: candidate?.status ?? "needs_facts",
          source: profile.businessContextDraftSource,
          updatedAt: profile.businessContextDraftUpdatedAt,
        }
      : null,
  };
}

function errorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
  return json({ ok: false, message }, status);
}
