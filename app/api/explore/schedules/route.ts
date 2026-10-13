import { after } from "next/server";
import { requireFirebaseUser, FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { isAIStudioProUser } from "@/lib/ai-studio/server-access";
import { hasTikTokBetaAccess } from "@/lib/social/tiktok-beta-access";
import { hasYouTubeBetaAccess } from "@/lib/social/youtube-beta-access";
import { ExploreFinishError, isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import { SchedulingRequestError } from "@/lib/scheduling/errors";
import { explorePendingSchedulingAvailable, getExplorePendingSchedule, reserveExplorePendingSchedule, reconcileExplorePendingSchedule } from "@/lib/explore/pending-schedule-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 256 * 1024;
const json = (body: unknown, status = 200, elapsed?: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization",
  ...(elapsed === undefined ? {} : { "Server-Timing": `schedule_ack;dur=${elapsed}` }) } });
function errorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError || error instanceof ExploreFinishError || error instanceof SchedulingRequestError) return json({ ok: false, message: error.message,
    ...(error instanceof FirebaseAuthRequestError ? {} : { code: error.code }) }, error.status);
  console.error("Explore schedule acknowledgement failed:", error);
  return json({ ok: false, message: "The schedule response is unconfirmed. Check the same saved request before trying a different schedule." }, 503);
}
async function readBody(request: Request) {
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new ExploreFinishError("Send JSON schedule details.", 415);
  const declared = request.headers.get("Content-Length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) throw new ExploreFinishError("Schedule details are too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ExploreFinishError("Choose schedule details.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength; if (size > MAX_BYTES) throw new ExploreFinishError("Schedule details are too large.", 413); chunks.push(chunk.value); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>; }
    catch { throw new ExploreFinishError("Send valid JSON schedule details."); }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request), query = new URL(request.url).searchParams;
    if (query.get("configOnly") === "1" && Array.from(query.keys()).every(key => key === "configOnly")) {
      return json({ ok: true, enabled: await explorePendingSchedulingAvailable() });
    }
    const key = query.get("requestKey");
    if (!isExploreUuid(key) || query.getAll("requestKey").length !== 1 || Array.from(query.keys()).some(name => name !== "requestKey")) throw new ExploreFinishError("Invalid saved schedule identity.");
    return json(await getExplorePendingSchedule(user.uid, key));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  const started = Date.now();
  try {
    const user = await requireFirebaseUser(request), body = await readBody(request);
    if (!isExploreUuid(body?.requestKey) || request.headers.get("Idempotency-Key")?.toLowerCase() !== body.requestKey.toLowerCase()) throw new ExploreFinishError("Keep the same schedule request identity when submitting again.");
    // Read-only recovery remains available if entitlement changes. New CPU
    // work requires the existing finishing entitlement, never anonymous input.
    const prior = await getExplorePendingSchedule(user.uid, body.requestKey);
    if (!prior.schedule && !await isAIStudioProUser(user)) throw new FirebaseAuthRequestError("Choose an active plan before preparing a new video schedule.", 403);
    const accepted = await reserveExplorePendingSchedule(user.uid, body, { allowTikTokTargets: hasTikTokBetaAccess(user), allowYouTubeTargets: hasYouTubeBetaAccess(user) });
    after(() => reconcileExplorePendingSchedule(user.uid, String(body.requestKey)).catch(error => {
      console.error("Explore schedule background acknowledgement recovery is pending:", error);
    }));
    return json({ ...accepted.result, created: accepted.created }, accepted.result.preparation.state === "preparing" ? 202 : 200, Date.now() - started);
  } catch (error) { return errorResponse(error); }
}
