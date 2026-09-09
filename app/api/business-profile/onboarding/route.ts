import { z } from "zod";
import { after } from "next/server";
import { requireFirebaseUser, FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { BusinessProfileSetupInputSchema } from "@/lib/business-profiles/setup";
import { BusinessProfileOnboardingContextSchema, PrimaryGoalsDraftSchema, PrimaryGoalsSchema } from "@/lib/business-profiles/schema";
import { inspectBusinessLogo } from "@/lib/business-profiles/logo";
import { dispatchOnboardingJobs, getOnboardingDraft, mutateOnboardingDraft, OnboardingDraftError,
  readOnboardingSession, retryOnboardingJob, toClientDraft } from "@/lib/business-profiles/onboarding-drafts";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";
import { isBackgroundOnboardingEnabled } from "@/lib/business-profiles/onboarding-rollout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const base = { draftId: z.string().uuid(), revision: z.number().int().positive() };
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), input: BusinessProfileSetupInputSchema, requestKey: z.string().uuid(), revision: z.number().int().positive().optional() }).strict(),
  z.object({ action: z.literal("identity"), ...base, businessName: BusinessProfileOnboardingContextSchema.shape.businessName, logoStorageKey: z.string().max(1000).nullable() }).strict(),
  z.object({ action: z.literal("goals"), ...base, primaryGoals: PrimaryGoalsDraftSchema }).strict(),
  z.object({ action: z.literal("submit"), ...base, primaryGoals: PrimaryGoalsSchema, timezone: z.string().min(1).max(80) }).strict(),
  z.object({ action: z.literal("edit"), ...base }).strict(),
  z.object({ action: z.literal("retry"), draftId: z.string().uuid() }).strict(),
]);
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function failure(error: unknown) {
  if (error instanceof FirebaseAuthRequestError || error instanceof OnboardingDraftError) return json({ ok: false, message: error.message }, error.status);
  console.error("Business onboarding request failed", error);
  return json({ ok: false, message: "Could not load or save your setup. Please try again." }, 500);
}
export async function GET(request: Request) {
  try { return json(await readOnboardingSession((await requireFirebaseUser(request)).uid)); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const { uid } = await requireFirebaseUser(request);
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ ok: false, message: "Check your onboarding details before continuing." }, 400);
    const input = parsed.data;
    if (input.action === "start") {
      const existing = await getOnboardingDraft(uid);
      if (!existing && !isBackgroundOnboardingEnabled(uid)) return json({ ok: false, message: "Reload to continue your setup." }, 409);
      if (getMissingBackgroundJobCloudTasksEnvVars(["media_analysis"]).length) throw new Error("Onboarding queue is not configured.");
    }
    if (input.action === "retry") {
      await retryOnboardingJob(uid, input.draftId);
      return json(await readOnboardingSession(uid));
    }
    const payload: Record<string, unknown> = { ...input };
    if (input.action === "identity") {
      try { payload.logo = input.logoStorageKey ? await inspectBusinessLogo({ key: input.logoStorageKey, userId: uid }) : null; }
      catch (error) { return json({ ok: false, message: error instanceof Error ? error.message : "The logo could not be verified." }, 400); }
    }
    const draft = await mutateOnboardingDraft(uid, input.action, payload);
    // Acceptance is already durable. Queue publication must not hold the form
    // open; the recovery scheduler also dispatches these persisted queued jobs.
    after(async () => {
      try { await dispatchOnboardingJobs(draft); }
      catch (error) { console.error("Onboarding queue publication needs recovery", error); }
    });
    return json({ ok: true, mode: "background", draft: await toClientDraft(draft) }, input.action === "start" || input.action === "submit" ? 202 : 200);
  } catch (error) { return failure(error); }
}
