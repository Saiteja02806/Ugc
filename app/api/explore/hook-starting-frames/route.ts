import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { BillingAccessError } from "@/lib/billing/subscription-db";
import { HookKeyframeGenerationError } from "@/lib/explore/hook-keyframe-result";
import { listRecentHookStartingFrames, resolveRecentHookStartingFrame } from "@/lib/explore/hook-starting-frame-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(request: Request) {
  if (process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION !== "true") return Response.json({ ok: false, message: "Starting frames are not enabled." }, { status: 404, headers });
  try {
    const user = await requireAIStudioProUser(request);
    const query = new URL(request.url).searchParams;
    if (!query.size) return Response.json({ ok: true, frames: await listRecentHookStartingFrames(user.uid) }, { headers });
    const jobId = query.get("jobId"), assetId = query.get("assetId");
    if (query.size !== 2 || !uuid.test(jobId ?? "") || !uuid.test(assetId ?? "")) return Response.json({ ok: false, message: "Choose a valid starting frame." }, { status: 400, headers });
    return Response.json({ ok: true, frame: await resolveRecentHookStartingFrame(user.uid, jobId!, assetId!) }, { headers });
  } catch (error) {
    const known = error instanceof FirebaseAuthRequestError || error instanceof BillingAccessError || error instanceof HookKeyframeGenerationError;
    return Response.json({ ok: false, message: known ? error.message : "Could not load your starting frames. Try again." }, { status: known ? error.status : 503, headers });
  }
}
